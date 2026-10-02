import { Router, Request, Response } from 'express';

export const invoiceAgentRouter = Router();

invoiceAgentRouter.post('/', (req: Request, res: Response) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter string required' });
  }

  // Invoice domain expert logic
  const answer = `[Invoice Specialist] Regarding your query ("${query}"): ` +
    `For overdue invoices and billing inquiries, we recommend reviewing invoice payment terms (e.g. Net 30/60). ` +
    `If an invoice is over 30 days past due, issue a formal payment reminder with accrued late fee interest details attached.`;

  return res.json({ answer });
});
