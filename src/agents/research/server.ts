import express, { Router, Request, Response } from 'express';

export const researchAgentRouter = Router();

researchAgentRouter.post('/', (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter string required' });
  }

  const answer = `[Research Specialist] Academic & market research summary for ("${query}"): ` +
    `Key findings indicate strong growth trajectories across decentralized AI agent routing frameworks and verifiable ENS record resolution standardizations.`;

  return res.json({ answer });
});

/**
 * Creates an independent Express app for standalone deployment of the Research Agent.
 */
export function createResearchAgentApp() {
  const app = express();
  app.use(express.json());
  app.use('/', researchAgentRouter);
  return app;
}
