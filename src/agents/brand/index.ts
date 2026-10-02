import { createBrandAgentApp } from './server.js';

const port = parseInt(process.env.PORT || '3003', 10);
const app = createBrandAgentApp();

app.listen(port, () => {
  console.log(`[Brand Copy Agent Microservice] Running on http://localhost:${port}`);
});
