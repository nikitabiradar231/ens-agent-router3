import { createWalletClient, createPublicClient, http, namehash, parseAbi, Address, getAddress } from 'viem';
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
const SEPOLIA_PUBLIC_RESOLVER: Address = getAddress('0x8F924A824153F16030111459D67AB12869296F37');

async function main() {
  const rawPrivateKey = process.env.SEPOLIA_PRIVATE_KEY;
  const rpcUrl = process.env.ENS_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const discoveryName = process.env.ENS_DISCOVERY_NAME || 'nikita-router.eth';

  console.log('=== Sepolia ENS Record Publisher ===');

  if (!rawPrivateKey || rawPrivateKey.includes('<') || rawPrivateKey === '0x' || rawPrivateKey.length < 60) {
    console.log('\n[INFO] LIVE ENS PUBLISHING BLOCKED: funded Sepolia wallet required');
    return;
  }

  const formattedPrivateKey = (rawPrivateKey.startsWith('0x') ? rawPrivateKey : `0x${rawPrivateKey}`) as `0x${string}`;

  const account = privateKeyToAccount(formattedPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log(`Publishing ENS records using wallet: ${account.address}`);
  console.log(`Target Resolver Address: ${SEPOLIA_PUBLIC_RESOLVER}`);
  console.log(`Root ENS Domain: ${discoveryName}`);

  const agentSubdomains = [
    {
      label: 'invoice',
      subdomain: `invoice.${discoveryName}`,
      records: {
        'agent.name': 'invoice-agent',
        'agent.description': 'Handles overdue invoices, invoice status, payment reminders and billing questions.',
        'agent.endpoint': process.env.INVOICE_AGENT_ENDPOINT || 'https://invoice-agent-7o04.onrender.com',
        'agent.input': 'application/json',
      },
    },
    {
      label: 'contract',
      subdomain: `contract.${discoveryName}`,
      records: {
        'agent.name': 'contract-agent',
        'agent.description': 'Handles contract questions, agreement clauses, legal obligations, and terminology.',
        'agent.endpoint': process.env.CONTRACT_AGENT_ENDPOINT || 'https://contract-agent-swwg.onrender.com',
        'agent.input': 'application/json',
      },
    },
    {
      label: 'brand',
      subdomain: `brand.${discoveryName}`,
      records: {
        'agent.name': 'brand-agent',
        'agent.description': 'Handles brand copy, taglines, marketing text, product descriptions, and brand messaging.',
        'agent.endpoint': process.env.BRAND_AGENT_ENDPOINT || 'https://brand-agent-99ei.onrender.com',
        'agent.input': 'application/json',
      },
    },
    {
      label: 'research',
      subdomain: `research.${discoveryName}`,
      records: {
        'agent.name': 'research-agent',
        'agent.description': 'Handles academic research, market reports, and literature summaries.',
        'agent.endpoint': process.env.RESEARCH_AGENT_ENDPOINT || 'https://research-agent-shq4.onrender.com',
        'agent.input': 'application/json',
      },
    },
  ];

  let currentNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  const pendingTxs: { desc: string; hash: `0x${string}` }[] = [];

  // 1. Set root agents discovery text record
  const rootNode = namehash(discoveryName);
  const agentListJson = JSON.stringify(agentSubdomains.map(a => a.subdomain));

  console.log(`\nBroadcasting transactions to Sepolia mempool (Start Nonce: ${currentNonce})...`);

  console.log(`  Broadcasting root 'agents' record on ${discoveryName}...`);
  const rootTx = await walletClient.writeContract({
    address: SEPOLIA_PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: 'setText',
    args: [rootNode, 'agents', agentListJson],
    nonce: currentNonce++,
  });
  console.log(`  Root Tx hash: ${rootTx}`);
  pendingTxs.push({ desc: `${discoveryName} -> agents`, hash: rootTx });

  // 2. Write individual agent text records for each subdomain
  for (const agent of agentSubdomains) {
    const subnode = namehash(agent.subdomain);
    for (const [key, value] of Object.entries(agent.records)) {
      console.log(`  Broadcasting ${agent.subdomain} -> ${key}...`);
      const tx = await walletClient.writeContract({
        address: SEPOLIA_PUBLIC_RESOLVER,
        abi: RESOLVER_ABI,
        functionName: 'setText',
        args: [subnode, key, value],
        nonce: currentNonce++,
      });
      console.log(`    Set ${key} Tx hash: ${tx}`);
      pendingTxs.push({ desc: `${agent.subdomain} -> ${key}`, hash: tx });
    }
  }

  console.log(`\nAll ${pendingTxs.length} transactions broadcast! Waiting for onchain block confirmations...`);

  await Promise.all(
    pendingTxs.map(async (item) => {
      await publicClient.waitForTransactionReceipt({ hash: item.hash });
      console.log(`  ✔ Confirmed: ${item.desc} (${item.hash})`);
    })
  );

  console.log('\n🎉 ALL 17 Sepolia ENS text records successfully published & confirmed on Ethereum Sepolia!');
}

main().catch(console.error);
