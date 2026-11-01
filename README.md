# Receivables Marketplace — Arbitrum Sepolia Hackathon MVP

A monorepo for a policy-driven receivables marketplace. Suppliers submit invoices, receive risk-adjusted purchase offers, and accept them. The backend matches invoice opportunities to investor capital accounts whose on-chain policies permit the opportunity. The coordinator funds the purchase, and a demo collection flow records actual mock-USDC proceeds and distributes them to contributors.

## Repository

- `contracts/` — Solidity 0.8.24 contracts and local helper libraries.
- `backend/` — Express + TypeScript API, ethers v6 chain client, policy matching/orchestration, and local JSON persistence.
- `frontend/` — Next.js + TypeScript UI for suppliers, investors, opportunities, and operations.
- `data/` — JSON files used as local application state. No database is required for this MVP.
- `test/` — Hardhat contract unit/integration tests and helpers; backend JSON store tests are in `backend/test/`.
- `scripts/` — deploy, network-check, and end-to-end mock demo scripts.
- `CONTRACTS-README.md` — contract deployment order and known Solidity MVP limitations.
- `backend/README.md` — backend setup, endpoint reference, request examples, and trust boundaries.

## Deploy and run the demo

Install root dependencies and configure a disposable test wallet in `.env` (copy `.env.example`). For local development, run `npm run node` in one terminal, then in another run `npm run compile`, `npm run deploy:local`, and `npm run demo:local`. The deploy script writes `deployments/localhost.json` and wires the registry and capital accounts to the coordinator.

For Arbitrum Sepolia TestNet, first confirm the current official RPC URL and chain ID, set `ARBITRUM_SEPOLIA_RPC_URL`, `ARBITRUM_SEPOLIA_CHAIN_ID`, and `PRIVATE_KEY`, then run `npm run check:arbitrum-sepolia`, `npm run compile`, and `npm run deploy:arbitrum-sepolia`. After deployment, `npm run demo:arbitrum-sepolia` executes a mock invoice lifecycle. See [`scripts/README.md`](scripts/README.md). The demo mints mock tokens and must only be used with the project's `MockUSDC` contract and disposable test wallets.

## Start the frontend

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Set `NEXT_PUBLIC_API_URL` and the deployed contract addresses. Set the current chain ID and RPC details from official Arbitrum Sepolia documentation; do not rely on stale endpoints.
3. In `frontend/`, run `npm install` and `npm run dev`.
4. Open `http://localhost:3000`. Start the backend separately at `http://localhost:4000`.


## Tests

From the repository root, install dependencies and run:

```bash
npm install
npm run test:contracts
npm run test:integration
npm run test:backend
```

The contract tests cover token permissions, invoice verification and assignment gates, pricing bounds, investor policy eligibility, funding invariants, and terminal settlement. See `test/README.md` for the manual frontend smoke-test checklist and known MVP limitations. These tests have been authored but have not been executed in this environment because Hardhat dependencies are not installed and the package registry was unavailable.

## JSON state design

The backend stores off-chain metadata and cache records in `data/*.json`. Investor balances, investor policies, invoice status, accepted offers, funding contributions, token custody, and settlement records are authoritative on-chain. JSON is never used to authorize a money movement. The backend is designed to run as a single process because local files are not a multi-instance transactional database.

## Start the backend

1. Deploy the Solidity contracts using your Hardhat project and wire `InvoiceRegistry.setCoordinator` and `CapitalAccounts.setCoordinator` to the deployed FundingCoordinator.
2. Copy `backend/.env.example` to `backend/.env`; configure the current Arbitrum Sepolia Testnet RPC URL/chain ID, contract addresses, and a throwaway testnet relayer key. Never commit `.env`.
3. In `backend/`, run `npm install` and `npm run dev`.
4. Check `http://localhost:4000/api/health`.

See `backend/README.md` for the full API sequence. The backend dependencies need to be installed locally; package installation and type-checking could not be completed in the generation environment because the package registry was unreachable. Treat this as generated code that still requires local installation, compile/type-check, tests, and integration testing against your exact deployed contract artifacts.

## Demo lifecycle

1. Investor connects wallet, sets a policy, approves MockUSDC, deposits funds, and registers their address with the backend.
2. Supplier submits invoice directly from their wallet to InvoiceRegistry and posts the confirmed transaction metadata to the backend.
3. Authorized operator reviews the invoice and records the simulated assignment gate.
4. Authorized operator creates a quote; supplier accepts the offer from their wallet.
5. Backend scans registered investor accounts and returns a policy-compliant allocation preview.
6. Coordinator executes funding atomically and pays the supplier in mock USDC.
7. Authorized operator simulates debtor collection with mock USDC; contract settles contributions and the backend records the transaction.

## Safety and limitations

This is a hackathon prototype, not audited financial infrastructure. The pricing curve is illustrative. The assignment gate does not establish legal assignment. The collection endpoint is a demo-only simulation, and the current Solidity contracts close the invoice on one terminal collection (full or shortfall). Do not use real money or real private keys.
