import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { ENSResolver, ViemENSResolver } from './ens/client.js';
import { discoverAgents } from './router/discover.js';
import { routeQuery } from './router/route.js';
import { forwardToAgent } from './router/forward.js';
import { UserQuerySchema } from './router/schemas.js';
import { RouterResult } from './types.js';

// Specialist agent routes
import { invoiceAgentRouter } from './agents/invoice/server.js';
import { contractAgentRouter } from './agents/contract/server.js';
import { brandAgentRouter } from './agents/brand/server.js';
import { researchAgentRouter } from './agents/research/server.js';

export interface AppOptions {
  ensResolver?: ENSResolver;
  discoveryName?: string;
}

export function createApp(options?: AppOptions): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const ensResolver = options?.ensResolver || new ViemENSResolver(config.ensRpcUrl);
  const discoveryName = options?.discoveryName || config.ensDiscoveryName;

  // Mount specialist agent endpoints for local development / testing
  app.use('/api/agents/invoice', invoiceAgentRouter);
  app.use('/api/agents/contract', contractAgentRouter);
  app.use('/api/agents/brand', brandAgentRouter);
  app.use('/api/agents/research', researchAgentRouter);

  // Health and discovery status check endpoint
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const discovered = await discoverAgents(ensResolver, discoveryName);
      res.json({
        status: 'healthy',
        discoveryName,
        discoveredAgentCount: discovered.length,
        agents: discovered,
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Main HTTP router endpoint
  app.post('/route', async (req: Request, res: Response) => {
    try {
      // 1. Validate incoming query format
      const parseResult = UserQuerySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          status: 'error',
          answer: null,
          agent: null,
          message: `Invalid request payload: ${parseResult.error.errors.map(e => e.message).join(', ')}`,
        });
      }

      const { query } = parseResult.data;

      // 2. Discover agents dynamically from ENS text records on Sepolia
      const discoveredAgents = await discoverAgents(ensResolver, discoveryName);

      if (discoveredAgents.length === 0) {
        const noAgentRes: RouterResult = {
          status: 'no_suitable_agent',
          answer: null,
          agent: null,
          message: 'No active specialist agents were discovered on ENS.',
        };
        return res.status(200).json(noAgentRes);
      }

      // 3. Model-driven agent selection
      const { selectedAgent, reasoning } = await routeQuery(query, discoveredAgents);

      // 4. Handle case when no suitable agent was selected
      if (!selectedAgent) {
        const noSuitableRes: RouterResult = {
          status: 'no_suitable_agent',
          answer: null,
          agent: null,
          message: 'No suitable specialist agent was discovered for this request.',
        };
        return res.status(200).json(noSuitableRes);
      }

      // 5. Forward user query to the selected agent endpoint with HTTPS & timeout checks
      try {
        const downstreamRes = await forwardToAgent(selectedAgent, query);

        const successRes: RouterResult = {
          status: 'success',
          answer: downstreamRes.answer,
          agent: {
            name: selectedAgent.name,
            ensName: selectedAgent.ensName,
          },
          reasoning,
        };

        return res.status(200).json(successRes);
      } catch (forwardError) {
        console.error(`[Router Forward Error] Failed to forward to ${selectedAgent.name}:`, forwardError);
        const errorRes: RouterResult = {
          status: 'error',
          answer: null,
          agent: null,
          message: `Forwarding failed: ${forwardError instanceof Error ? forwardError.message : 'Unknown downstream error'}`,
        };
        return res.status(502).json(errorRes);
      }
    } catch (globalError) {
      console.error('[Router Global Error]:', globalError);
      const errorRes: RouterResult = {
        status: 'error',
        answer: null,
        agent: null,
        message: globalError instanceof Error ? globalError.message : 'Internal router error',
      };
      return res.status(500).json(errorRes);
    }
  });

  return app;
}
