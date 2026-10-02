import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  ensRpcUrl: process.env.ENS_RPC_URL || 'https://rpc.sepolia.org',
  ensDiscoveryName: process.env.ENS_DISCOVERY_NAME || 'devcon-router.eth',
  llmApiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  agentTimeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '10000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') !== 'production',
};
