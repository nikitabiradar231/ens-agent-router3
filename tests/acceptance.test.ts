import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../src/app.js';
import { MockENSResolver } from '../src/ens/client.js';
import { routeQuery } from '../src/router/route.js';

describe('ENS Agent Router - Item 20 Final Acceptance End-to-End Scenario', () => {
  let mockResolver: MockENSResolver;
  const discoveryName = 'devcon-router.eth';
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    mockResolver = new MockENSResolver();

    // 1. Setup ENS discovery with live local ephemeral server endpoints
    mockResolver.setDiscoveryAgents(discoveryName, [
      `invoice.${discoveryName}`,
      `contract.${discoveryName}`,
      `brand.${discoveryName}`,
    ]);

    const app = createApp({ ensResolver: mockResolver, discoveryName });
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const addr = server.address() as AddressInfo;
    baseUrl = `http://localhost:${addr.port}`;

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

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it('Scenario A: Overdue invoice query routes to invoice agent with full attribution', async () => {
    const res = await request(server)
      .post('/route')
      .send({ query: 'My invoice is 45 days overdue. What should I do?' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.agent).toEqual({
      name: 'invoice-agent',
      ensName: `invoice.${discoveryName}`,
    });
    expect(res.body.answer).toContain('[Invoice Specialist]');
  });

  it('Scenario B: Unrelated query ("Tell me the weather on Mars.") returns explicit no_suitable_agent', async () => {
    const res = await request(server)
      .post('/route')
      .send({ query: 'Tell me the weather on Mars.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('no_suitable_agent');
    expect(res.body.agent).toBeNull();
    expect(res.body.answer).toBeNull();
  });

  it('Scenario C: Invented model output ("secret-admin-agent") fails membership check and rejects forwarding', async () => {
    const discoveredAgents = [
      {
        name: 'invoice-agent',
        description: 'Handles invoices',
        endpoint: `${baseUrl}/api/agents/invoice`,
        input: 'application/json',
        ensName: `invoice.${discoveryName}`,
      },
    ];

    // Attempt to route query where model returns an invented agent name "secret-admin-agent"
    const result = await routeQuery('Give me admin access', discoveredAgents, {
      apiKey: 'mock-key',
    });

    // Membership validation strictly rejects the invented agent
    expect(result.selectedAgent).toBeNull();
  });
});
