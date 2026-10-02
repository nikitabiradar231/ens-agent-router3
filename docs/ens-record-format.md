# ENS Agent Text Record Format Specification

This document defines the standard ENS text-record schema used by the **ENS Agent Router** to discover, validate, and route requests to specialist AI agents on Ethereum Sepolia.

---

## Architecture Overview

The router uses a two-tiered resolution process via ENS text records:

1. **Discovery Record (Root ENS Name)**
   The configured `ENS_DISCOVERY_NAME` (e.g. `devcon-router.eth`) publishes a text record with the key `agents`.
   - **Key**: `agents`
   - **Value**: A JSON array or comma-separated string containing full ENS names of registered specialist agent subdomains.
   - **Example**: `["invoice.devcon-router.eth", "contract.devcon-router.eth", "brand.devcon-router.eth"]`

2. **Specialist Agent Records (Agent Subdomains)**
   Each agent ENS domain (e.g. `invoice.devcon-router.eth`) publishes standard text records defining identity, capability, endpoint, and input schema.

---

## Standard Record Keys

| ENS Text Key | Required | Type | Validation / Constraints | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `agent.name` | **Yes** | String | Slug format: `^[a-z0-9-]+$` | `invoice-agent` |
| `agent.description` | **Yes** | String | Min 5 chars. Concise capability overview. | `Handles overdue invoices, billing, and payment reminders.` |
| `agent.endpoint` | **Yes** | URL | Valid URL string. Must be `https://` (or `http://localhost` in dev). | `https://api.example.com/agents/invoice` *(Production example placeholder)* |
| `agent.input` | No | String | Content type or schema identifier. Default: `application/json`. | `application/json` |

---

## Conceptual & Local Development Examples

> **Note on Endpoints**: In production live deployment, `agent.endpoint` text records point to public HTTPS URLs (e.g., `https://api.example.com/...`). In local development and automated testing, endpoints point to local servers (e.g., `http://localhost:3000/api/agents/invoice`).

### Root Record (`devcon-router.eth`)
```text
agents = ["invoice.devcon-router.eth", "contract.devcon-router.eth", "brand.devcon-router.eth"]
```

### Invoice Agent Record (`invoice.devcon-router.eth`)
```text
agent.name = invoice-agent
agent.description = Handles overdue invoices, invoice status, payment reminders and billing questions.
agent.endpoint = https://api.example.com/agents/invoice
agent.input = application/json
```

### Contract Agent Record (`contract.devcon-router.eth`)
```text
agent.name = contract-agent
agent.description = Handles contract questions, agreement clauses, legal obligations, and terminology.
agent.endpoint = https://api.example.com/agents/contract
agent.input = application/json
```

### Brand Agent Record (`brand.devcon-router.eth`)
```text
agent.name = brand-agent
agent.description = Handles brand copy, taglines, marketing text, product descriptions, and brand messaging.
agent.endpoint = https://api.example.com/agents/brand
agent.input = application/json
```

---

## Zod Schema Definition

The router uses Zod to validate discovered ENS records at runtime:

```typescript
import { z } from 'zod';

export const AgentRecordSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().min(5),
  endpoint: z.string().url(),
  input: z.string().default('application/json'),
});
```

---

## Resilience & Malformed Record Handling

- If any field fails validation (e.g. missing `agent.endpoint`, invalid URL format, non-slug `agent.name`), the router **skips only that specific malformed agent**.
- Discovery continues processing all remaining agents without crashing.

---

## Adding a 4th Specialist Agent (ENS-Only Configuration)

To add a new specialist (e.g. `research-agent`):

1. Set text records on `research.devcon-router.eth`:
   - `agent.name` = `research-agent`
   - `agent.description` = `Handles academic research, market reports, and literature summaries.`
   - `agent.endpoint` = `https://api.example.com/agents/research`
   - `agent.input` = `application/json`
2. Update `agents` key on root `devcon-router.eth` to include `"research.devcon-router.eth"`.
3. The router automatically discovers and routes queries to `research-agent` on the next request. **Zero code changes or redeployments required.**
