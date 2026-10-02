import { createContractAgentApp } from './server.js';

const port = parseInt(process.env.PORT || '3002', 10);
const app = createContractAgentApp();

app.listen(port, () => {
  console.log(`[Contract Agent Microservice] Running on http://localhost:${port}`);
});
