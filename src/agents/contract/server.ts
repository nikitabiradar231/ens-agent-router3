import express, { Router, Request, Response } from 'express';

export const contractAgentRouter = Router();

contractAgentRouter.post('/', (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter string required' });
  }

  const answer = `[Contract Specialist] Regarding your contract query ("${query}"): ` +
    `Legal agreements and termination clauses require strict adherence to specified notice periods and cure windows. ` +
    `Ensure all obligations, indemnification limits, and governing law sections are cross-referenced before execution.`;

  return res.json({ answer });
});

/**
 * Creates an independent Express app for standalone deployment of the Contract Agent.
 */
export function createContractAgentApp() {
  const app = express();
  app.use(express.json());
  app.use('/', contractAgentRouter);
  return app;
}
