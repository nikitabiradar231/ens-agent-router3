import { createWalletClient, createPublicClient, http, namehash, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config();

/**
 * ENS Public Resolver ABI (setText method)
 */
const PUBLIC_RESOLVER_ABI = parseAbi([
  'function setText(bytes32 node, string calldata key, string calldata value) external',
]);

// Standard Public Resolver address on Sepolia
const SEPOLIA_PUBLIC_RESOLVER = '0x8F924A824153F16030111459D67ab12869296f37';

async function main() {
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}`;
  const rpcUrl = process.env.ENS_RPC_URL || 'https://rpc.sepolia.org';
  const discoveryName = process.env.ENS_DISCOVERY_NAME || 'devcon-router.eth';

  console.log('=== Sepolia ENS Record Publisher ===');

  if (!privateKey) {
    console.log('\n[INFO] SEPOLIA_PRIVATE_KEY not found in environment.');
    console.log('To publish live text records to Ethereum Sepolia ENS:');
    console.log('1. Set SEPOLIA_PRIVATE_KEY=0x... in .env');
    console.log('2. Ensure your account owns the target ENS domain or subdomains on Sepolia');
    console.log('3. Run `npm run publish-ens`\n');
    console.log('Expected ENS Text Records structure to be set on Sepolia:');
    console.log(`Root: ${discoveryName} -> key: "agents", value: '["invoice.${discoveryName}", "contract.${discoveryName}", "brand.${discoveryName}"]'`);
    console.log(`Subdomain: invoice.${discoveryName} -> agent.name: "invoice-agent", agent.endpoint: "https://..."`);
    console.log(`Subdomain: contract.${discoveryName} -> agent.name: "contract-agent", agent.endpoint: "https://..."`);
    console.log(`Subdomain: brand.${discoveryName} -> agent.name: "brand-agent", agent.endpoint: "https://..."`);
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

  const agentSubdomains = [
    {
      subdomain: `invoice.${discoveryName}`,
      records: {
        'agent.name': 'invoice-agent',
        'agent.description': 'Handles overdue invoices, invoice status, payment reminders and billing questions.',
        'agent.endpoint': 'https://api.example.com/invoice',
        'agent.input': 'application/json',
      },
    },
    {
      subdomain: `contract.${discoveryName}`,
      records: {
        'agent.name': 'contract-agent',
        'agent.description': 'Handles contract questions, agreement clauses, legal obligations, and terminology.',
        'agent.endpoint': 'https://api.example.com/contract',
        'agent.input': 'application/json',
      },
    },
    {
      subdomain: `brand.${discoveryName}`,
      records: {
        'agent.name': 'brand-agent',
        'agent.description': 'Handles brand copy, taglines, marketing text, product descriptions, and brand messaging.',
        'agent.endpoint': 'https://api.example.com/brand',
        'agent.input': 'application/json',
      },
    },
  ];

  // 1. Set root agents record
  const rootNode = namehash(discoveryName);
  const agentListJson = JSON.stringify(agentSubdomains.map(a => a.subdomain));

  console.log(`Setting root record 'agents' on ${discoveryName}...`);
  const rootTx = await walletClient.writeContract({
    address: SEPOLIA_PUBLIC_RESOLVER,
    abi: PUBLIC_RESOLVER_ABI,
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
        address: SEPOLIA_PUBLIC_RESOLVER,
        abi: PUBLIC_RESOLVER_ABI,
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
