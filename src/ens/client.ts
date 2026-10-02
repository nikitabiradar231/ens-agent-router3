import { createPublicClient, http, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { RawAgentRecord } from '../types.js';

export interface ENSResolver {
  getAgentNames(discoveryName: string): Promise<string[]>;
  getAgentTextRecords(ensName: string): Promise<RawAgentRecord>;
}

export class ViemENSResolver implements ENSResolver {
  private client: PublicClient;

  constructor(rpcUrl: string) {
    this.client = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });
  }

  async getAgentNames(discoveryName: string): Promise<string[]> {
    try {
      const agentsRecord = await this.client.getEnsText({
        name: discoveryName,
        key: 'agents',
      });

      if (!agentsRecord) {
        console.warn(`[ViemENSResolver] No 'agents' text record found on discovery name: ${discoveryName}`);
        return [];
      }

      // Support either JSON array string or comma-separated string
      const trimmed = agentsRecord.trim();
      if (trimmed.startsWith('[')) {
        return JSON.parse(trimmed) as string[];
      }
      return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    } catch (error) {
      console.warn(`[ViemENSResolver] Failed to resolve discovery name ${discoveryName}:`, error);
      return [];
    }
  }

  async getAgentTextRecords(ensName: string): Promise<RawAgentRecord> {
    const keys = ['agent.name', 'agent.description', 'agent.endpoint', 'agent.input'];
    const record: RawAgentRecord = {};

    await Promise.all(
      keys.map(async (key) => {
        try {
          const val = await this.client.getEnsText({
            name: ensName,
            key,
          });
          if (val !== null) {
            record[key] = val;
          }
        } catch {
          // Individual key fetch failure
        }
      })
    );

    return record;
  }
}

export class MockENSResolver implements ENSResolver {
  private discoveryMap: Map<string, string[]> = new Map();
  private recordsMap: Map<string, RawAgentRecord> = new Map();

  setDiscoveryAgents(discoveryName: string, agentEnsNames: string[]): void {
    this.discoveryMap.set(discoveryName, agentEnsNames);
  }

  setAgentRecord(ensName: string, record: RawAgentRecord): void {
    this.recordsMap.set(ensName, record);
  }

  async getAgentNames(discoveryName: string): Promise<string[]> {
    return this.discoveryMap.get(discoveryName) || [];
  }

  async getAgentTextRecords(ensName: string): Promise<RawAgentRecord> {
    return this.recordsMap.get(ensName) || {};
  }
}
