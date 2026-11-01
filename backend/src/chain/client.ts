import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { capitalAccountsAbi, fundingCoordinatorAbi, invoiceRegistryAbi, mockUsdcAbi, pricingEngineAbi } from './abis.js';

function addressOrUndefined(value?: string): string | undefined {
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : undefined;
}

export class ChainClient {
  readonly provider?: JsonRpcProvider;
  readonly signer?: Wallet;
  readonly mockUsdc?: Contract;
  readonly registry?: Contract;
  readonly pricing?: Contract;
  readonly capital?: Contract;
  readonly coordinator?: Contract;
  readonly configured: boolean;
  readonly chainId?: number;

  constructor() {
    const rpc = process.env.CHAIN_RPC_URL;
    const addresses = [process.env.MOCK_USDC_ADDRESS, process.env.INVOICE_REGISTRY_ADDRESS, process.env.PRICING_ENGINE_ADDRESS, process.env.CAPITAL_ACCOUNTS_ADDRESS, process.env.FUNDING_COORDINATOR_ADDRESS];
    this.configured = Boolean(rpc && addresses.every((a) => addressOrUndefined(a)));
    if (!rpc) return;
    this.provider = new JsonRpcProvider(rpc);
    if (process.env.RELAYER_PRIVATE_KEY) this.signer = new Wallet(process.env.RELAYER_PRIVATE_KEY, this.provider);
    if (addressOrUndefined(process.env.MOCK_USDC_ADDRESS)) this.mockUsdc = new Contract(process.env.MOCK_USDC_ADDRESS!, mockUsdcAbi, this.signer ?? this.provider);
    if (addressOrUndefined(process.env.INVOICE_REGISTRY_ADDRESS)) this.registry = new Contract(process.env.INVOICE_REGISTRY_ADDRESS!, invoiceRegistryAbi, this.signer ?? this.provider);
    if (addressOrUndefined(process.env.PRICING_ENGINE_ADDRESS)) this.pricing = new Contract(process.env.PRICING_ENGINE_ADDRESS!, pricingEngineAbi, this.signer ?? this.provider);
    if (addressOrUndefined(process.env.CAPITAL_ACCOUNTS_ADDRESS)) this.capital = new Contract(process.env.CAPITAL_ACCOUNTS_ADDRESS!, capitalAccountsAbi, this.signer ?? this.provider);
    if (addressOrUndefined(process.env.FUNDING_COORDINATOR_ADDRESS)) this.coordinator = new Contract(process.env.FUNDING_COORDINATOR_ADDRESS!, fundingCoordinatorAbi, this.signer ?? this.provider);
    const id = process.env.CHAIN_ID;
    if (id && /^\d+$/.test(id)) this.chainId = Number(id);
  }

  requireReadContracts(): this {
    if (!this.registry || !this.pricing || !this.capital || !this.coordinator || !this.mockUsdc) throw new Error('Chain contracts are not configured. Set RPC URL and all contract addresses in backend/.env.');
    return this;
  }

  requireSigner(): Wallet {
    if (!this.signer) throw new Error('RELAYER_PRIVATE_KEY is not configured; this operation needs an authorized demo signer.');
    return this.signer;
  }

  async health() {
    if (!this.provider) return { configured: false };
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      return { configured: this.configured, chainId: Number(network.chainId), expectedChainId: this.chainId ?? null, blockNumber, signer: this.signer?.address ?? null };
    } catch (error) {
      return { configured: this.configured, rpcReachable: false, error: (error as Error).message };
    }
  }
}

export const chain = new ChainClient();
