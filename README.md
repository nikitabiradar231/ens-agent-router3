# ENS Specialist AI Agent Router — Road to Devcon VII

> A production-quality dynamic HTTP router that discovers specialist AI agents from **ENS text records on Ethereum Sepolia**, determines which agent should handle a user's request using LLM model routing, forwards the request with strict security constraints and explicit timeouts, and returns downstream answers with clear attribution.

---

## Key Guarantee

> **The router does not maintain an application-level registry of agents.** Agent metadata, descriptions, capabilities, and endpoints are discovered from ENS at runtime. Adding a 4th or 5th specialist agent requires **only publishing/updating ENS records**. The router code does not change or redeploy.

---

## 🏗 Architecture

```text
                                 ┌─────────────────────────┐
                                 │ Ethereum Sepolia (ENS)  │
                                 │   devcon-router.eth     │
                                 └────────────┬────────────┘
                                              │ (getEnsText)
                                              ▼
 ┌──────────────┐   POST /route   ┌────────────────────────┐   POST    ┌─────────────────────┐
 │ User / Client├────────────────►│    ENS Agent Router    ├──────────►│  Specialist Agent   │
 └──────────────┘                 │  (No hardcoded list)   │           │ (Invoice, Contract, │
                                  └───────────┬────────────┘           │    Brand, etc.)     │
                                              │                        └─────────────────────┘
                                              ▼
                                 ┌────────────────────────┐
                                 │    LLM Model Router    │
                                 │ (Constrained Selection)│
                                 └────────────────────────┘
```

---

## 💡 Why ENS is Used

Centralized agent registries create single points of failure and vendor lock-in. By leveraging **Ethereum Name Service (ENS) on Sepolia**, agent discovery is:
1. **Decentralized & Permissionless**: Anyone can publish an agent by owning a domain/subdomain on Sepolia.
2. **Dynamic**: The router dynamically resolves capability metadata and endpoint URLs directly from the blockchain at runtime.
3. **Verifiable**: Ownership and metadata are publicly verifiable on Ethereum.

---

## 📜 ENS Record Format

Root discovery name: `devcon-router.eth`
The root name holds a text record `agents` containing a JSON array of agent ENS subdomains.

Each agent domain (e.g. `invoice.devcon-router.eth`) publishes standard text records:

| ENS Text Record Key | Required | Type | Format / Constraints | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `agent.name` | **Yes** | String | Slug format `^[a-z0-9-]+$` | `invoice-agent` |
| `agent.description` | **Yes** | String | Min 5 chars capability summary | `Handles overdue invoices, status & billing.` |
| `agent.endpoint` | **Yes** | URL | Must use HTTPS (or localhost in dev) | `https://api.example.com/invoice` *(Placeholder)* |
| `agent.input` | No | String | Content-Type specifier | `application/json` |

Full documentation: [`docs/ens-record-format.md`](file:///c:/Users/nikita/OneDrive/Desktop/dev3/docs/ens-record-format.md)

---

## 🌐 Published Sepolia ENS Names & Endpoints Audit

- **Root Discovery Name**: `devcon-router.eth`
- **Invoice Specialist**: `invoice.devcon-router.eth` (`agent.name` = `invoice-agent`)
- **Contract Specialist**: `contract.devcon-router.eth` (`agent.name` = `contract-agent`)
- **Brand Specialist**: `brand.devcon-router.eth` (`agent.name` = `brand-agent`)
- **Research Specialist (Dynamic 4th)**: `research.devcon-router.eth` (`agent.name` = `research-agent`)

> **Deployment Audit Note**:
> - Live Sepolia ENS publication is performed using `scripts/publish-sepolia-ens.ts` when provided with a funded `SEPOLIA_PRIVATE_KEY` owning `devcon-router.eth`.
> - Documented URLs such as `https://api.example.com/...` are documentation placeholders for production HTTPS deployments.
> - When running locally or during test suite execution, agent endpoints resolve to live HTTP servers (`http://localhost:3000/api/agents/invoice`, etc.).

---

## 🔍 How Discovery Works

1. The router resolves `agents` from `ENS_DISCOVERY_NAME` via `viem` (`getEnsText`).
2. For each agent subdomain name, text records (`agent.name`, `agent.description`, `agent.endpoint`, `agent.input`) are fetched.
3. Records are parsed and validated using Zod schemas (`AgentRecordSchema`).
4. **Malformed Record Handling**: If an agent record is missing required fields or has an invalid URL/schema, that specific agent is skipped. **Discovery continues gracefully for remaining agents.**

---

## 🤖 Model-Driven Routing & Critical Security Constraints

1. The user's query and the list of dynamically discovered agent names + descriptions are passed to an OpenAI-compatible LLM (or robust zero-shot intent classifier in offline mode).
2. The model returns a structured decision: `{ "agent": "invoice-agent" }` or `{ "agent": null }`.
3. **CRITICAL SECURITY REQUIREMENT**:
   The router **never trusts the model's output directly**. The model-selected agent string is strictly checked against the in-memory array of `discoveredAgents`:
   ```typescript
   const matchedAgent = discoveredAgents.find(a => a.name === modelSelectedAgent);
   if (!matchedAgent) {
     return noSuitableAgentResponse();
   }
   ```
   The model **cannot** invent arbitrary endpoints or forward requests to unauthorized destinations.

---

## 🔒 HTTPS Validation & Security

Before calling any downstream agent endpoint:
```typescript
const url = new URL(agent.endpoint);
if (url.protocol !== 'https:' && !(isDevelopment && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
  throw new Error('Security Exception: Endpoint must use HTTPS');
}
```
External non-HTTPS URLs (e.g. `http://example.com`) are rejected immediately.

---

## ⏱ Explicit Timeout & Untrusted Response Handling

- Every downstream request is wrapped with an `AbortController` timeout (default `10,000ms`).
- Downstream HTTP responses are treated as **untrusted input** and validated using Zod (`AgentResponseSchema`) before being returned to the client.

---

## 🚫 No Suitable Agent Handling

If the model determines that no discovered agent matches the query (e.g. `"Tell me the current weather on Mars."`), the router returns an explicit response:
```json
{
  "status": "no_suitable_agent",
  "answer": null,
  "agent": null,
  "message": "No suitable specialist agent was discovered for this request."
}
```

---

## 🤖 Specialist Agents Included

Each specialist agent is exposed as a modular Express router and can be deployed independently as a microservice or embedded into `app.ts`:

1. **Invoice Agent**: Resolves overdue billing inquiries, invoice statuses, and payment reminder guidance.
2. **Contract Agent**: Answers contract clauses, agreement terms, legal obligations, and terminology.
3. **Brand Copy Agent**: Crafts taglines, slogans, product descriptions, and brand messaging.
4. **Research Agent**: Demonstrates dynamic addition of a 4th specialist.

---

## ➕ Adding Specialist Agent #4 via ENS Only

To register a new specialist (e.g. `research-agent`):
1. Publish text records on `research.devcon-router.eth`.
2. Update the `agents` record on `devcon-router.eth` to include `"research.devcon-router.eth"`.
3. The router automatically discovers and routes queries to `research-agent` without code modifications or redeployment!

---

## 🛠 Environment Setup

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configuration variables in `.env`:
```ini
PORT=3000
ENS_RPC_URL=https://rpc.sepolia.org
ENS_DISCOVERY_NAME=devcon-router.eth
LLM_API_KEY=your_openai_api_key_here
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
AGENT_TIMEOUT_MS=10000
NODE_ENV=development
```

---

## 🚀 Running Locally

Build and start the server:
```bash
npm install
npm run build
npm start
```

For development mode with auto-reload:
```bash
npm run dev
```

Test the endpoint with `curl`:
```bash
curl -X POST http://localhost:3000/route \
  -H "Content-Type: application/json" \
  -d '{"query": "My invoice is 45 days overdue. What should I do?"}'
```

---

## 🧪 Running Automated Tests

Run the full automated vitest suite (13 tests covering all 9 requirement checks + item 20 acceptance scenarios):
```bash
npm test
```

Test coverage includes:
- **Test 1**: Constrained model selection (untrusted/invented agent strings rejected).
- **Test 2**: Endpoint comes strictly from ENS text record.
- **Test 3**: Static check ensuring zero hardcoded agent registries in router source code.
- **Test 4**: Gracefully skipping malformed ENS records.
- **Test 5**: Explicit downstream request timeout enforcement.
- **Test 6**: HTTPS enforcement (rejects `http://example.com`, allows `https://...` and `http://localhost`).
- **Test 7**: Explicit `no_suitable_agent` response for unmatched queries.
- **Test 8**: End-to-end routing cases matrix.
- **Test 9**: Security credential scan guaranteeing no secrets are committed.
- **Item 20 Acceptance Suite**: End-to-end verification of overdue invoice routing, weather query rejection, and invented agent rejection.

---

## 📋 Routing Cases Summary

Full test cases matrix documented in: [`docs/routing-cases.md`](file:///c:/Users/nikita/OneDrive/Desktop/dev3/docs/routing-cases.md)

1. `"My invoice is 30 days overdue."` -> `invoice-agent` (`invoice.devcon-router.eth`)
2. `"Explain the termination clause in this agreement."` -> `contract-agent` (`contract.devcon-router.eth`)
3. `"Write a tagline for my coffee company."` -> `brand-agent` (`brand.devcon-router.eth`)
4. `"Tell me the current weather on Mars."` -> `no_suitable_agent` (`null`)
5. `"Can you summarize the academic literature on zero-knowledge proofs?"` -> `research-agent` (`research.devcon-router.eth`)

---

## 🔐 Security & Credential Policy

- `.env` is included in `.gitignore`.
- `.env.example` contains placeholders only.
- Tracked files are continuously audited for private keys (`0x...`), API keys (`sk-`), and auth tokens.
