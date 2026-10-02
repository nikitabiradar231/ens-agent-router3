import { ENSResolver } from '../ens/client.js';
import { validateAgentRecord } from '../ens/records.js';
import { DiscoveredAgent } from '../types.js';

/**
 * Dynamically discovers specialist AI agents from ENS.
 * NO hardcoded list of agent names or endpoints exists in code.
 * Malformed records are gracefully skipped without breaking the discovery process.
 */
export async function discoverAgents(
  resolver: ENSResolver,
  discoveryName: string
): Promise<DiscoveredAgent[]> {
  const agentEnsNames = await resolver.getAgentNames(discoveryName);
  const discovered: DiscoveredAgent[] = [];

  for (const ensName of agentEnsNames) {
    try {
      const rawRecords = await resolver.getAgentTextRecords(ensName);
      const agent = validateAgentRecord(rawRecords, ensName);

      if (agent) {
        discovered.push(agent);
      } else {
        console.warn(`[Discovery] Skipping malformed ENS agent record at: ${ensName}`);
      }
    } catch (error) {
      console.warn(`[Discovery] Error reading ENS agent records for ${ensName}:`, error);
      // Continue discovery for remaining agents
    }
  }

  return discovered;
}
