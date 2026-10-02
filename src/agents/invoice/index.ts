import { createInvoiceAgentApp } from './server.js';

const port = parseInt(process.env.PORT || '3001', 10);
const app = createInvoiceAgentApp();

app.listen(port, () => {
  console.log(`[Invoice Agent Microservice] Running on http://localhost:${port}`);
});
