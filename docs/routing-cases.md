# Routing Cases Specification

This document details the test matrix and expected routing outcomes for queries submitted to the **ENS Agent Router**.

---

## Published Sepolia ENS Agent Names

- Root Discovery Name: `devcon-router.eth`
- Specialist Subdomain 1: `invoice.devcon-router.eth` (`agent.name`: `invoice-agent`)
- Specialist Subdomain 2: `contract.devcon-router.eth` (`agent.name`: `contract-agent`)
- Specialist Subdomain 3: `brand.devcon-router.eth` (`agent.name`: `brand-agent`)
- Specialist Subdomain 4 (Dynamic Addition): `research.devcon-router.eth` (`agent.name`: `research-agent`)

---

## Test Cases Matrix

| Case ID | User Query | Expected Agent | Discovered ENS Name | Routing Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Case 1** | `"My invoice is 30 days overdue."` | `invoice-agent` | `invoice.devcon-router.eth` | Inquiries regarding overdue invoices, payments, and billing belong to the invoice specialist. |
| **Case 2** | `"Explain the termination clause in this agreement."` | `contract-agent` | `contract.devcon-router.eth` | Contract clauses, agreement terms, and legal obligations belong to the contract specialist. |
| **Case 3** | `"Write a tagline for my coffee company."` | `brand-agent` | `brand.devcon-router.eth` | Slogans, taglines, marketing copy, and branding belong to the brand specialist. |
| **Case 4** | `"Tell me the current weather on Mars."` | `null` (No Suitable Agent) | `N/A` | General space/weather trivia matches no discovered specialist domain. Returns `no_suitable_agent`. |
| **Case 5** | `"Can you summarize the academic literature on zero-knowledge proofs?"` | `research-agent` | `research.devcon-router.eth` | Demonstrates dynamic addition of 4th agent discovered solely via ENS text records. |

---

## Response Structure Examples

### 1. Successful Routing & Attribution
```json
{
  "status": "success",
  "answer": "[Invoice Specialist] Regarding your query (\"My invoice is 30 days overdue.\"): For overdue invoices...",
  "agent": {
    "name": "invoice-agent",
    "ensName": "invoice.devcon-router.eth"
  },
  "reasoning": "Matched keywords for invoice-agent"
}
```

### 2. No Suitable Agent Response
```json
{
  "status": "no_suitable_agent",
  "answer": null,
  "agent": null,
  "message": "No suitable specialist agent was discovered for this request."
}
```
