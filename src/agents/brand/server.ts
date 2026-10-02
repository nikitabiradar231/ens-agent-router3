import express, { Router, Request, Response } from 'express';

export const brandAgentRouter = Router();

brandAgentRouter.post('/', (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter string required' });
  }

  const answer = `[Brand Copy Specialist] Here is your brand copywriting response for ("${query}"): ` +
    `"Elevate your brand presence with bold clarity and uncompromised quality. Crafted for impact, built for the future."`;

  return res.json({ answer });
});

/**
 * Creates an independent Express app for standalone deployment of the Brand Copy Agent.
 */
export function createBrandAgentApp() {
  const app = express();
  app.use(express.json());
  app.use('/', brandAgentRouter);
  return app;
}
