import { createWalletClient, createPublicClient, http, namehash, parseAbi, Address, getAddress, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import dotenv from 'dotenv';
dotenv.config();

/**
 * ENSv2 Subregistry ABI (register method)
 */
const ENSV2_SUBREGISTRY_ABI = parseAbi([
  'function register(string label, address owner, address resolver, bytes[] data) external returns (bytes32 node)',
]);

/**
 * ENS Resolver ABI (setText method)
 */
const RESOLVER_ABI = parseAbi([
  'function setText(bytes32 node, string calldata key, string calldata value) external',
]);

// Official Sepolia ENSv2 Subregistry for parent name nikita-router.eth
const ENSV2_SUBREGISTRY_SEPOLIA: Address = getAddress('0xf303905d30317DE0601bF048479186Afa9f799e9');
// Official Sepolia Public Resolver
const SEPOLIA_PUBLIC_RESOLVER: Address = getAddress('0x8F924A824153F16030111459D67AB12869296F37');

async function main() {
  const rawPrivateKey = process.env.SEPOLIA_PRIVATE_KEY;
  const rpcUrl = process.env.ENS_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
  const discoveryName = process.env.ENS_DISCOVERY_NAME || 'nikita-router.eth';
  const dryRun = process.env.DRY_RUN !== 'false'; // Default to DRY RUN for safety

  console.log('=== ENSv2 Sepolia Publisher & Subregistry Registrar ===');
  console.log(`Root ENS Domain: ${discoveryName}`);
  console.log(`ENSv2 Subregistry Target: ${ENSV2_SUBREGISTRY_SEPOLIA}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (READ ONLY - NO TRANSACTIONS SENT)' : 'LIVE BROADCAST'}`);

  if (!rawPrivateKey || rawPrivateKey.includes('<') || rawPrivateKey === '0x' || rawPrivateKey.length < 60) {
    console.log('\n[INFO] LIVE ENS PUBLISHING BLOCKED: valid SEPOLIA_PRIVATE_KEY required in .env');
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

  console.log(`Registrant / Owner Wallet Address: ${account.address}`);

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

  console.log('\n--- Prepared ENSv2 Subname Registration Batch ---');
  agentSubdomains.forEach((agent, i) => {
    const subnode = namehash(agent.subdomain);
    const multicalls = Object.entries(agent.records).map(([key, value]) =>
      encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: 'setText',
        args: [subnode, key, value],
      })
    );
    console.log(`[Item ${i + 1}] Subname: ${agent.subdomain}`);
    console.log(`  Subregistry call: register("${agent.label}", "${account.address}", "${SEPOLIA_PUBLIC_RESOLVER}", [${multicalls.length} text record multicalls])`);
  });

  const rootNode = namehash(discoveryName);
  const agentListJson = JSON.stringify(agentSubdomains.map(a => a.subdomain));
  console.log(`\n[Root Record] ${discoveryName} -> agents = '${agentListJson}'`);

  if (dryRun) {
    console.log('\n✅ ENSv2 Publisher Dry Run complete. NO TRANSACTIONS SENT.');
    console.log('To broadcast live to Ethereum Sepolia, set DRY_RUN=false when authorized.');
    return;
  }

  // Live Broadcast Execution (Only when DRY_RUN=false)
  let currentNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  const pendingTxs: { desc: string; hash: `0x${string}` }[] = [];

  console.log(`\nBroadcasting ENSv2 transactions starting at Nonce ${currentNonce}...`);

  // 1. Set root agents discovery text record
  const rootTx = await walletClient.writeContract({
    address: SEPOLIA_PUBLIC_RESOLVER,
    abi: RESOLVER_ABI,
    functionName: 'setText',
    args: [rootNode, 'agents', agentListJson],
    nonce: currentNonce++,
  });
  console.log(`  Root Tx hash: ${rootTx}`);
  pendingTxs.push({ desc: `${discoveryName} -> agents`, hash: rootTx });

  // 2. Register each subname on the ENSv2 subregistry with atomic text record multicalls
  for (const agent of agentSubdomains) {
    const subnode = namehash(agent.subdomain);
    const multicalls = Object.entries(agent.records).map(([key, value]) =>
      encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: 'setText',
        args: [subnode, key, value],
      })
    );

    const regTx = await walletClient.writeContract({
      address: ENSV2_SUBREGISTRY_SEPOLIA,
      abi: ENSV2_SUBREGISTRY_ABI,
      functionName: 'register',
      args: [agent.label, account.address, SEPOLIA_PUBLIC_RESOLVER, multicalls],
      nonce: currentNonce++,
    });
    console.log(`  Register ${agent.subdomain} Tx hash: ${regTx}`);
    pendingTxs.push({ desc: `Subregistry register: ${agent.subdomain}`, hash: regTx });
  }

  console.log(`\nAll ${pendingTxs.length} transactions broadcast. Awaiting confirmations...`);
  await Promise.all(pendingTxs.map(item => publicClient.waitForTransactionReceipt({ hash: item.hash })));
  console.log('\n🎉 ALL ENSv2 subnames successfully registered & text records published!');
}

main().catch(console.error);
