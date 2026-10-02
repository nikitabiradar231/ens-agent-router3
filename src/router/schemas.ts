import { z } from 'zod';

export const UserQuerySchema = z.object({
  query: z.string().min(1, 'Query string cannot be empty'),
});

export const RoutingDecisionSchema = z.object({
  agent: z.string().nullable(),
  reasoning: z.string().optional(),
});

export const AgentResponseSchema = z.object({
  answer: z.string().min(1, 'Agent response answer cannot be empty'),
});

export type UserQuery = z.infer<typeof UserQuerySchema>;
export type RoutingDecisionType = z.infer<typeof RoutingDecisionSchema>;
export type AgentResponseType = z.infer<typeof AgentResponseSchema>;
