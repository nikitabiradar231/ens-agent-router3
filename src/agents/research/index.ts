import { createResearchAgentApp } from './server.js';

const port = parseInt(process.env.PORT || '3004', 10);
const app = createResearchAgentApp();

app.listen(port, () => {
  console.log(`[Research Agent Microservice] Running on http://localhost:${port}`);
});
