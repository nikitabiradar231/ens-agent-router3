import { describe, it, expect } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { forwardToAgent, validateEndpointUrl } from '../src/router/forward.js';
import { DiscoveredAgent } from '../src/types.js';

describe('ENS Agent Router - Forwarding & Security', () => {

  // TEST 5 — Explicit Timeout
  it('Test 5: Downstream request MUST enforce an explicit timeout', async () => {
    // Start a slow HTTP server that delays response by 500ms
    const slowApp = express();
    slowApp.post('/slow', (_req, _res) => {
      // Intentionally do not respond or delay long
      setTimeout(() => {
        _res.json({ answer: 'Slow answer' });
      }, 500);
    });

    const server: Server = await new Promise((resolve) => {
      const s = slowApp.listen(0, () => resolve(s));
    });

    const address = server.address() as { port: number };
    const slowEndpoint = `http://localhost:${address.port}/slow`;

    const dummyAgent: DiscoveredAgent = {
      name: 'slow-agent',
      description: 'Slow agent test',
      endpoint: slowEndpoint,
      input: 'application/json',
      ensName: 'slow.eth',
    };

    // Forward with very short timeout of 100ms
    await expect(
      forwardToAgent(dummyAgent, 'hello', { timeoutMs: 100, isDevelopment: true })
    ).rejects.toThrow(/timed out after 100ms/);

    server.close();
  });

  // TEST 6 — HTTPS enforcement & localhost development exception
  it('Test 6: Must reject non-HTTPS URLs for external endpoints and allow HTTPS / localhost HTTP', () => {

    // Should ALLOW valid HTTPS URL
    expect(() => {
      validateEndpointUrl('https://agent.example.com/api', false);
    }).not.toThrow();

    // Should REJECT insecure HTTP external URL in production or development
    expect(() => {
      validateEndpointUrl('http://insecure-agent.example.com/api', false);
    }).toThrow(/must use HTTPS/);

    expect(() => {
      validateEndpointUrl('http://insecure-agent.example.com/api', true);
    }).toThrow(/must use HTTPS/);

    // Should ALLOW localhost HTTP only in development mode
    expect(() => {
      validateEndpointUrl('http://localhost:3000/api', true);
    }).not.toThrow();

    expect(() => {
      validateEndpointUrl('http://127.0.0.1:3000/api', true);
    }).not.toThrow();

    // Should REJECT localhost HTTP in production mode
    expect(() => {
      validateEndpointUrl('http://localhost:3000/api', false);
    }).toThrow(/must use HTTPS/);
  });
});
