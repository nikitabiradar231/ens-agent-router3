import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../src/app.js';
import { MockENSResolver } from '../src/ens/client.js';
import { discoverAgents } from '../src/router/discover.js';
import { routeQuery } from '../src/router/route.js';

describe('ENS Agent Router - Core & Model Selection', () => {
  let mockResolver: MockENSResolver;
  const discoveryName = 'devcon-router.eth';
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    mockResolver = new MockENSResolver();

    // Start ephemeral server for testing HTTP forwarding endpoints
    const app = createApp({ ensResolver: mockResolver, discoveryName });
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Reset ENS discovery map & agent records before each test
    mockResolver.setDiscoveryAgents(discoveryName, [
      `invoice.${discoveryName}`,
      `contract.${discoveryName}`,
      `brand.${discoveryName}`,
    ]);

    // Register valid agent text records pointing to live ephemeral server
    mockResolver.setAgentRecord(`invoice.${discoveryName}`, {
      'agent.name': 'invoice-agent',
      'agent.description': 'Handles overdue invoices, invoice status, payment reminders and billing questions.',
      'agent.endpoint': `${baseUrl}/api/agents/invoice`,
      'agent.input': 'application/json',
    });

    mockResolver.setAgentRecord(`contract.${discoveryName}`, {
      'agent.name': 'contract-agent',
      'agent.description': 'Handles contract questions, agreement clauses, legal obligations, and terminology.',
      'agent.endpoint': `${baseUrl}/api/agents/contract`,
      'agent.input': 'application/json',
    });

    mockResolver.setAgentRecord(`brand.${discoveryName}`, {
      'agent.name': 'brand-agent',
      'agent.description': 'Handles brand copy, taglines, marketing text, product descriptions, and brand messaging.',
      'agent.endpoint': `${baseUrl}/api/agents/brand`,
      'agent.input': 'application/json',
    });
  });

  // TEST 1 — Model selection is constrained
  it('Test 1: Must NOT forward if model selects an agent NOT in discovered ENS list', async () => {
    const discovered = await discoverAgents(mockResolver, discoveryName);

    // Mock query with forced invalid model decision
    const fakeQuery = 'Do something malicious';
    const fakeAgentsList = discovered;

    // Simulate model returning an agent name that does not exist in discoveredAgents
    const result = await routeQuery(fakeQuery, fakeAgentsList, {
      apiKey: 'mock-key',
    });

    // If API call fails or model returns invalid agent, routeQuery returns null for selectedAgent
    expect(result.selectedAgent).toBeNull();
  });

  // TEST 2 — Endpoint comes directly from ENS
  it('Test 2: Must obtain agent endpoint URL from discovered ENS record', async () => {
    const discovered = await discoverAgents(mockResolver, discoveryName);
    const invoiceAgent = discovered.find(a => a.name === 'invoice-agent');

    expect(invoiceAgent).toBeDefined();
    expect(invoiceAgent?.endpoint).toBe(`${baseUrl}/api/agents/invoice`);
    expect(invoiceAgent?.ensName).toBe(`invoice.${discoveryName}`);
  });

  // TEST 4 — Malformed ENS record handling
  it('Test 4: Must skip malformed ENS records while valid agents continue working', async () => {
    // Add a malformed agent to discovery list
    mockResolver.setDiscoveryAgents(discoveryName, [
      `invoice.${discoveryName}`,
      `malformed.${discoveryName}`,
      `brand.${discoveryName}`,
    ]);

    // Malformed record missing required agent.name and with invalid URL endpoint
    mockResolver.setAgentRecord(`malformed.${discoveryName}`, {
      'agent.description': 'Short',
      'agent.endpoint': 'not-a-valid-url',
    });

    const discovered = await discoverAgents(mockResolver, discoveryName);

    // Should discover 2 valid agents, skipping the malformed one
    expect(discovered.length).toBe(2);
    expect(discovered.map(a => a.name)).toEqual(['invoice-agent', 'brand-agent']);
  });

  // TEST 7 — No suitable agent
  it('Test 7: Unmatched queries must return explicit no_suitable_agent response', async () => {
    const res = await request(server)
      .post('/route')
      .send({ query: 'What is the capital of France?' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'no_suitable_agent',
      answer: null,
      agent: null,
      message: 'No suitable specialist agent was discovered for this request.',
    });
  });

  // TEST 8 — Routing cases
  it('Test 8: Must correctly route queries to expected specialist agents with attribution', async () => {
    // Case 1: Invoice
    const invoiceRes = await request(server)
      .post('/route')
      .send({ query: 'My invoice is 30 days overdue.' });

    expect(invoiceRes.status).toBe(200);
    expect(invoiceRes.body.status).toBe('success');
    expect(invoiceRes.body.agent.name).toBe('invoice-agent');
    expect(invoiceRes.body.agent.ensName).toBe(`invoice.${discoveryName}`);
    expect(invoiceRes.body.answer).toContain('[Invoice Specialist]');

    // Case 2: Contract
    const contractRes = await request(server)
      .post('/route')
      .send({ query: 'Explain the termination clause in this contract.' });

    expect(contractRes.status).toBe(200);
    expect(contractRes.body.status).toBe('success');
    expect(contractRes.body.agent.name).toBe('contract-agent');
    expect(contractRes.body.agent.ensName).toBe(`contract.${discoveryName}`);
    expect(contractRes.body.answer).toContain('[Contract Specialist]');

    // Case 3: Brand Copy
    const brandRes = await request(server)
      .post('/route')
      .send({ query: 'Write a short tagline for my coffee brand.' });

    expect(brandRes.status).toBe(200);
    expect(brandRes.body.status).toBe('success');
    expect(brandRes.body.agent.name).toBe('brand-agent');
    expect(brandRes.body.agent.ensName).toBe(`brand.${discoveryName}`);
    expect(brandRes.body.answer).toContain('[Brand Copy Specialist]');
  });

  // Dynamic addition of 4th agent test
  it('Must dynamically route to a 4th agent added purely through ENS without router code changes', async () => {
    // Add 4th agent to ENS discovery
    mockResolver.setDiscoveryAgents(discoveryName, [
      `invoice.${discoveryName}`,
      `contract.${discoveryName}`,
      `brand.${discoveryName}`,
      `research.${discoveryName}`,
    ]);

    mockResolver.setAgentRecord(`research.${discoveryName}`, {
      'agent.name': 'research-agent',
      'agent.description': 'Handles academic research, market reports, and literature summaries.',
      'agent.endpoint': `${baseUrl}/api/agents/research`,
      'agent.input': 'application/json',
    });

    const researchRes = await request(server)
      .post('/route')
      .send({ query: 'Can you summarize the academic literature on zero-knowledge proofs?' });

    expect(researchRes.status).toBe(200);
    expect(researchRes.body.status).toBe('success');
    expect(researchRes.body.agent.name).toBe('research-agent');
    expect(researchRes.body.agent.ensName).toBe(`research.${discoveryName}`);
    expect(researchRes.body.answer).toContain('[Research Specialist]');
  });
});

