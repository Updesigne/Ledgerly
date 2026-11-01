import { BrowserProvider, Contract, id, keccak256, toUtf8Bytes, parseUnits } from 'ethers';

export const addresses = {
  usdc: process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || '',
  registry: process.env.NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS || '',
  pricing: process.env.NEXT_PUBLIC_PRICING_ENGINE_ADDRESS || '',
  capital: process.env.NEXT_PUBLIC_CAPITAL_ACCOUNTS_ADDRESS || '',
  coordinator: process.env.NEXT_PUBLIC_FUNDING_COORDINATOR_ADDRESS || '',
};

export const usdcAbi = [
  'function decimals() view returns (uint8)', 'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)',
  'function mint(address,uint256)', 'function transfer(address,uint256) returns (bool)',
  'function owner() view returns (address)',
];
export const registryAbi = [
  'function submitInvoice(bytes32 invoiceKey,bytes32 debtorRef,bytes32 evidenceHash,uint128 faceValue,uint64 dueDate) returns (uint256)',
  'function nextInvoiceId() view returns (uint256)',
  'function getInvoice(uint256) view returns ((address supplier,bytes32 debtorRef,bytes32 evidenceHash,uint128 faceValue,uint64 dueDate,uint64 createdAt,uint8 riskTier,uint8 status,bool assignmentComplete))',
];
export const capitalAbi = [
  'function setPolicy(bool enabled,uint16 maxDurationDays,uint16 minExpectedReturnBps,uint8 maxRiskTier,uint128 maxPerInvoice)',
  'function deposit(uint256 amount)', 'function withdraw(uint256 amount)',
  'function getBalance(address) view returns ((uint256 available,uint256 reserved,uint256 deployed))',
  'function policies(address) view returns ((bool enabled,uint16 maxDurationDays,uint16 minExpectedReturnBps,uint8 maxRiskTier,uint128 maxPerInvoice))',
];
export const coordinatorAbi = [
  'function acceptOffer(uint256 invoiceId)',
  'function getOffer(uint256 invoiceId) view returns ((uint128 purchasePrice,uint16 discountBps,uint16 baseDiscountBps,uint16 riskAdjustmentBps,uint64 expiry,bool accepted,bool funded))',
];

export async function connectWallet() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('Install MetaMask or another injected EVM wallet to continue.');
  const provider = new BrowserProvider(ethereum);
  await provider.send('eth_requestAccounts', []);
  const expectedChainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  if (expectedChainId && /^\d+$/.test(expectedChainId)) {
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(expectedChainId)) {
      throw new Error(`Wrong network. Connect your wallet to ${process.env.NEXT_PUBLIC_CHAIN_NAME || 'Arbitrum Sepolia'} (chain ID ${expectedChainId}).`);
    }
  }
  const signer = await provider.getSigner();
  return { provider, signer, address: await signer.getAddress() };
}

export function contract(address: string, abi: string[], runner: any) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address)) {
    throw new Error('Contract address is missing. Copy deployed addresses into frontend/.env.local and restart Next.js.');
  }
  return new Contract(address, abi, runner);
}

export async function getOptimizedFeeData(provider: BrowserProvider) {
  try {
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas
      ? (feeData.maxFeePerGas * 150n) / 100n // +50% buffer to absorb Arbitrum L2 micro-spikes
      : undefined;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
      ? (feeData.maxPriorityFeePerGas * 150n) / 100n
      : undefined;
    return { maxFeePerGas, maxPriorityFeePerGas };
  } catch {
    return {};
  }
}

export function bytes32FromText(value: string) {
  return id(value.trim());
}
export function hashText(value: string) {
  return keccak256(toUtf8Bytes(value));
}
export function amountUnits(value: string) {
  return parseUnits(value, 6);
}
export async function hashFile(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}
