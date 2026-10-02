import { config } from '../config/index.js';
import { DiscoveredAgent, RoutingDecision } from '../types.js';
import { RoutingDecisionSchema } from './schemas.js';

export interface RouteOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Route a user query to one of the dynamically discovered agents using an LLM.
 * Strictly enforces that the model-selected agent exists in discoveredAgents.
 */
export async function routeQuery(
  query: string,
  discoveredAgents: DiscoveredAgent[],
  options?: RouteOptions
): Promise<{ selectedAgent: DiscoveredAgent | null; reasoning?: string }> {
  if (!discoveredAgents || discoveredAgents.length === 0) {
    return { selectedAgent: null, reasoning: 'No discovered agents available' };
  }

  const apiKey = options?.apiKey || config.llmApiKey;
  let rawDecision: RoutingDecision | null = null;

  if (apiKey) {
    try {
      rawDecision = await callLLMRouter(query, discoveredAgents, {
        apiKey,
        baseUrl: options?.baseUrl || config.llmBaseUrl,
        model: options?.model || config.llmModel,
      });
    } catch (error) {
      console.warn('[Router] LLM API call failed, falling back to heuristic classification:', error);
      rawDecision = fallbackIntentClassifier(query, discoveredAgents);
    }
  } else {
    // No API key configured - use fallback classifier
    rawDecision = fallbackIntentClassifier(query, discoveredAgents);
  }

  if (!rawDecision || !rawDecision.agent) {
    return { selectedAgent: null, reasoning: rawDecision?.reasoning || 'No suitable agent selected by router model' };
  }

  // CRITICAL SECURITY REQUIREMENT: Validate model output against discovered agents
  const matchedAgent = discoveredAgents.find(a => a.name === rawDecision!.agent);

  if (!matchedAgent) {
    console.warn(`[Security Check Failed] Model selected agent '${rawDecision.agent}' which was NOT found in discovered agents list.`);
    return {
      selectedAgent: null,
      reasoning: `Model selected agent '${rawDecision.agent}' is invalid or undiscovered.`,
    };
  }

  return {
    selectedAgent: matchedAgent,
    reasoning: rawDecision.reasoning || `Routed to ${matchedAgent.name}`,
  };
}

/**
 * Calls OpenAI-compatible Chat Completion API for structured routing decision.
 */
async function callLLMRouter(
  query: string,
  discoveredAgents: DiscoveredAgent[],
  llmConfig: { apiKey: string; baseUrl: string; model: string }
): Promise<RoutingDecision> {
  const agentListText = discoveredAgents
    .map(a => `- agent.name: "${a.name}"\n  description: "${a.description}"`)
    .join('\n\n');

  const systemPrompt = `You are a strict query router. Determine which specialist AI agent from the available list should answer the user's request.

Available agents:
${agentListText}

Rules:
1. Return ONLY a valid JSON object matching this schema:
   {
     "agent": "<exact-agent-name-or-null>",
     "reasoning": "<brief explanation>"
   }
2. If none of the available agents match the query topic (e.g. general knowledge, unrelated topics), set "agent": null.
3. You MUST only select an agent name from the list above. Do NOT invent new agent names.`;

  const userPrompt = `User Query: "${query}"`;

  const url = `${llmConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API returned status ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('LLM API returned empty response content');
  }

  const jsonParsed = JSON.parse(content);
  return RoutingDecisionSchema.parse(jsonParsed);
}

/**
 * Fallback heuristic classifier for offline testing & fallback mode.
 * Dynamically compares query keywords with discovered agents' descriptions.
 */
export function fallbackIntentClassifier(
  query: string,
  discoveredAgents: DiscoveredAgent[]
): RoutingDecision {
  const lowerQuery = query.toLowerCase();

  let bestMatch: DiscoveredAgent | null = null;
  let highestScore = 0;

  for (const agent of discoveredAgents) {
    const descLower = agent.description.toLowerCase();
    const nameLower = agent.name.toLowerCase();
    let score = 0;

    // Extract keywords from agent description and name
    const keywords = [...descLower.split(/\W+/), ...nameLower.split(/\W+/)].filter(w => w.length > 3);

    for (const kw of keywords) {
      if (lowerQuery.includes(kw)) {
        score += 1;
      }
    }

    // Specific domain triggers for standard agents
    if (nameLower.includes('invoice') || descLower.includes('invoice') || descLower.includes('billing')) {
      if (/\b(invoice|invoices|overdue|billing|payment|paid|reminder|receipt)\b/.test(lowerQuery)) {
        score += 5;
      }
    }

    if (nameLower.includes('contract') || descLower.includes('contract') || descLower.includes('legal')) {
      if (/\b(contract|agreement|clause|legal|termination|liability|terms|obligations|breach)\b/.test(lowerQuery)) {
        score += 5;
      }
    }

    if (nameLower.includes('brand') || descLower.includes('brand') || descLower.includes('copy')) {
      if (/\b(brand|copy|tagline|slogan|marketing|product description|headline|ad copy)\b/.test(lowerQuery)) {
        score += 5;
      }
    }

    if (nameLower.includes('research') || descLower.includes('research')) {
      if (/\b(research|paper|study|literature|analysis|survey|citations)\b/.test(lowerQuery)) {
        score += 5;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = agent;
    }
  }

  if (bestMatch && highestScore >= 2) {
    return {
      agent: bestMatch.name,
      reasoning: `Matched keywords for ${bestMatch.name} (score: ${highestScore})`,
    };
  }

  return {
    agent: null,
    reasoning: 'No suitable agent matched query keywords or intent',
  };
}
