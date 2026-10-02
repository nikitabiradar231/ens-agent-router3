export interface DiscoveredAgent {
  name: string;
  description: string;
  endpoint: string;
  input: string;
  ensName: string;
}

export interface RawAgentRecord {
  'agent.name'?: string;
  'agent.description'?: string;
  'agent.endpoint'?: string;
  'agent.input'?: string;
  [key: string]: string | undefined;
}

export interface RoutingDecision {
  agent: string | null;
  reasoning?: string;
}

export interface AgentResponse {
  answer: string;
  [key: string]: unknown;
}

export interface SuccessfulRouteResult {
  status: 'success';
  answer: string;
  agent: {
    name: string;
    ensName: string;
  };
  reasoning?: string;
}

export interface NoSuitableAgentResult {
  status: 'no_suitable_agent';
  answer: null;
  agent: null;
  message: string;
}

export interface RouterErrorResult {
  status: 'error';
  answer: null;
  agent: null;
  message: string;
}

export type RouterResult = SuccessfulRouteResult | NoSuitableAgentResult | RouterErrorResult;
