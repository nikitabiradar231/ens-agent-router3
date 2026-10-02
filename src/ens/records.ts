import { z } from 'zod';
import { DiscoveredAgent, RawAgentRecord } from '../types.js';

export const AgentRecordSchema = z.object({
  name: z.string().min(1, 'Agent name is required').regex(/^[a-z0-9-]+$/, 'Agent name must be lower-case alphanumeric with hyphens'),
  description: z.string().min(5, 'Agent description must be at least 5 characters long'),
  endpoint: z.string().url('Agent endpoint must be a valid URL'),
  input: z.string().default('application/json'),
});

export type ValidatedAgentRecord = z.infer<typeof AgentRecordSchema>;

/**
 * Validates raw ENS text records for an agent.
 * Returns a DiscoveredAgent if valid, or null if the record is malformed.
 */
export function validateAgentRecord(
  rawRecord: RawAgentRecord,
  ensName: string
): DiscoveredAgent | null {
  try {
    const parsed = AgentRecordSchema.parse({
      name: rawRecord['agent.name'],
      description: rawRecord['agent.description'],
      endpoint: rawRecord['agent.endpoint'],
      input: rawRecord['agent.input'] || 'application/json',
    });

    return {
      name: parsed.name,
      description: parsed.description,
      endpoint: parsed.endpoint,
      input: parsed.input,
      ensName,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn(`[ENS Discovery] Invalid record for ${ensName}:`, error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    } else {
      console.warn(`[ENS Discovery] Failed to parse records for ${ensName}:`, error);
    }
    return null;
  }
}
