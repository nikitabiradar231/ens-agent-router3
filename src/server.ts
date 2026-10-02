import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`🚀 ENS Agent Router listening on http://localhost:${config.port}`);
  console.log(`📡 Connected to Sepolia RPC: ${config.ensRpcUrl}`);
  console.log(`🔍 Root ENS Discovery Name: ${config.ensDiscoveryName}`);
});
