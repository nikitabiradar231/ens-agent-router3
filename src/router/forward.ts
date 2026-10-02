import { config } from '../config/index.js';
import { DiscoveredAgent } from '../types.js';
import { AgentResponseSchema } from './schemas.js';

export interface ForwardOptions {
  timeoutMs?: number;
  isDevelopment?: boolean;
}

/**
 * Validates endpoint URL according to HTTPS security requirements.
 * Throws error if endpoint is not HTTPS (except allowed localhost HTTP in dev).
 */
export function validateEndpointUrl(endpointStr: string, isDevelopment = config.isDevelopment): URL {
  let url: URL;
  try {
    url = new URL(endpointStr);
  } catch {
    throw new Error(`Invalid agent endpoint URL format: "${endpointStr}"`);
  }

  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';

  if (url.protocol === 'https:') {
    return url;
  }

  if (isDevelopment && url.protocol === 'http:' && isLocalhost) {
    return url;
  }

  throw new Error(`Security Exception: Endpoint URL "${endpointStr}" must use HTTPS (only localhost HTTP is permitted in development).`);
}

/**
 * Forwards user request to selected agent endpoint with explicit timeout and security checks.
 */
export async function forwardToAgent(
  agent: DiscoveredAgent,
  query: string,
  options?: ForwardOptions
): Promise<{ answer: string }> {
  // 1. HTTPS Validation
  const validatedUrl = validateEndpointUrl(agent.endpoint, options?.isDevelopment ?? config.isDevelopment);

  const timeoutMs = options?.timeoutMs || config.agentTimeoutMs;

  // 2. Explicit Timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validatedUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ENS-Agent-Router/1.0',
      },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Agent downstream HTTP error: ${response.status} ${response.statusText}`);
    }

    // 3. Untrusted Response Handling
    const rawBody = await response.json();
    const validatedResponse = AgentResponseSchema.parse(rawBody);

    return {
      answer: validatedResponse.answer,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Agent downstream request timed out after ${timeoutMs}ms`);
    }

    throw error;
  }
}
