import { createWalletClient, createPublicClient, http, namehash, parseAbi, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config();

/**
 * ENS Resolver ABI (setText method)
 */
const RESOLVER_ABI = parseAbi([
  'function setText(bytes32 node, string calldata key, string calldata value) external',
]);

// Fallback Standard Public Resolver address on Sepolia
const FALLBACK_SEPOLIA_PUBLIC_RESOLVER: Address = '0x8F924A824153F16030111459D67ab12869296f37';

async function main() {
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`;
  const rpcUrl = process.env.ENS_RPC_URL || 'https://rpc.sepolia.org';
  const discoveryName = process.env.ENS_DISCOVERY_NAME || 'devcon-router.eth';

  console.log('=== Sepolia ENS Record Publisher ===');

  if (!privateKey || privateKey.includes('<') || privateKey === '0x') {
    console.log('\n[INFO] LIVE ENS PUBLISHING BLOCKED: funded Sepolia wallet required');
    console.log('To publish live text records to Ethereum Sepolia ENS:');
    console.log('1. Register domain on https://app.ens.dev (Sepolia ENS App)');
    console.log('2. Set SEPOLIA_PRIVATE_KEY=<your_private_key> in .env');
    console.log('3. Run `npm run publish-ens`\n');
    console.log('Expected ENS Text Records structure to be set on Sepolia:');
    console.log(`Root: ${discoveryName} -> key: "agents", value: '["invoice.${discoveryName}", "contract.${discoveryName}", "brand.${discoveryName}", "research.${discoveryName}"]'`);
    console.log(`Subdomain: invoice.${discoveryName} -> agent.name: "invoice-agent", agent.endpoint: "https://..."`);
    console.log(`Subdomain: contract.${discoveryName} -> agent.name: "contract-agent", agent.endpoint: "https://..."`);
    console.log(`Subdomain: brand.${discoveryName} -> agent.name: "brand-agent", agent.endpoint: "https://..."`);
    console.log(`Subdomain: research.${discoveryName} -> agent.name: "research-agent", agent.endpoint: "https://..."`);
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log(`Publishing records using wallet: ${account.address}`);

  // Dynamically query ENS Resolver contract for the root domain on Sepolia
  let resolverAddress: Address | null = null;
  try {
    resolverAddress = await publicClient.getEnsResolver({ name: discoveryName });
  } catch (error) {
    console.warn(`[Publisher Warning] Failed to query getEnsResolver for ${discoveryName}:`, error);
  }

  if (!resolverAddress) {
    console.log(`[Publisher] Domain ${discoveryName} has no custom resolver assigned. Falling back to default Sepolia Public Resolver: ${FALLBACK_SEPOLIA_PUBLIC_RESOLVER}`);
    resolverAddress = FALLBACK_SEPOLIA_PUBLIC_RESOLVER;
  } else {
    console.log(`[Publisher] Dynamically resolved ENS Resolver address for ${discoveryName}: ${resolverAddress}`);
  }

  const agentSubdomains = [
    {
      subdomain: `invoice.${discoveryName}`,
      records: {
        'agent.name': 'invoice-agent',
        'agent.description': 'Handles overdue invoices, invoice status, payment reminders and billing questions.',
        'agent.endpoint': process.env.INVOICE_AGENT_ENDPOINT || 'https://api.example.com/invoice',
        'agent.input': 'application/json',
      },
    },
    {
      subdomain: `contract.${discoveryName}`,
      records: {
        'agent.name': 'contract-agent',
        'agent.description': 'Handles contract questions, agreement clauses, legal obligations, and terminology.',
        'agent.endpoint': process.env.CONTRACT_AGENT_ENDPOINT || 'https://api.example.com/contract',
        'agent.input': 'application/json',
      },
    },
    {
      subdomain: `brand.${discoveryName}`,
      records: {
        'agent.name': 'brand-agent',
        'agent.description': 'Handles brand copy, taglines, marketing text, product descriptions, and brand messaging.',
        'agent.endpoint': process.env.BRAND_AGENT_ENDPOINT || 'https://api.example.com/brand',
        'agent.input': 'application/json',
      },
    },
    {
      subdomain: `research.${discoveryName}`,
      records: {
        'agent.name': 'research-agent',
        'agent.description': 'Handles academic research, market reports, and literature summaries.',
        'agent.endpoint': process.env.RESEARCH_AGENT_ENDPOINT || 'https://api.example.com/research',
        'agent.input': 'application/json',
      },
    },
  ];

  // 1. Set root agents record
  const rootNode = namehash(discoveryName);
  const agentListJson = JSON.stringify(agentSubdomains.map(a => a.subdomain));

  console.log(`Setting root record 'agents' on ${discoveryName} at resolver ${resolverAddress}...`);
  const rootTx = await walletClient.writeContract({
    address: resolverAddress,
    abi: RESOLVER_ABI,
    functionName: 'setText',
    args: [rootNode, 'agents', agentListJson],
  });
  console.log(`Root Tx sent: ${rootTx}`);
  await publicClient.waitForTransactionReceipt({ hash: rootTx });

  // 2. Set individual agent subdomains
  for (const agent of agentSubdomains) {
    const node = namehash(agent.subdomain);
    console.log(`Setting records for ${agent.subdomain}...`);

    for (const [key, value] of Object.entries(agent.records)) {
      const tx = await walletClient.writeContract({
        address: resolverAddress,
        abi: RESOLVER_ABI,
        functionName: 'setText',
        args: [node, key, value],
      });
      console.log(`  Set ${key} Tx: ${tx}`);
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }
  }

  console.log('✅ All Sepolia ENS text records successfully published!');
}

main().catch(console.error);
