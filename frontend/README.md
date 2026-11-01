# Ledgerly Frontend

Next.js + TypeScript UI for the Arbitrum Sepolia receivables marketplace MVP.

## Features

- Overview dashboard and lifecycle counts
- Supplier invoice submission directly through an injected EVM wallet
- On-chain invoice metadata submission followed by backend receipt verification/indexing
- Investor policy configuration, mock USDC approval, and capital deposits
- Opportunities view and policy-matching funding orchestration
- Operator verification, demo assignment gate, offer generation, and simulated collection
- Local JSON backend integration; no database is used

## Setup

1. Deploy the contracts and configure the backend first. See the repository `CONTRACTS-README.md` and `backend/README.md`.
2. Copy `.env.example` to `.env.local`.
3. Fill in the deployed contract addresses and API URL. Set the current Arbitrum Sepolia Testnet RPC URL and chain ID using official Arbitrum Sepolia documentation. Do not rely on old endpoints.
4. Install dependencies and start the backend from the repository root, then start the frontend in another terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000` and connect an injected EVM wallet.

## Environment variables

See `.env.example`. The `NEXT_PUBLIC_*_ADDRESS` values are public deployment addresses, not secrets. Never place private keys in frontend environment variables. The backend relayer key belongs only in `backend/.env` and must be a throwaway testnet key.

## Important behavior

- Invoice submission requires a connected supplier wallet and a deployed `InvoiceRegistry`.
- Investor policy/deposit actions require a connected investor wallet, mock USDC balance, and the deployed `CapitalAccounts` and `MockUSDC` contracts.
- Review, assignment, quote, funding, and simulated collection use backend endpoints and the configured demo relayer.
- The attached file is not uploaded to a document storage server in this MVP. The browser computes its SHA-256 hash and records the hash on-chain. The demo evidence itself remains local to the user's browser.
- The backend's local JSON files are off-chain cache/workflow state. Contract state remains authoritative for balances and financial transitions.
- This is an un-audited hackathon demo, not production financial software. Verification, assignment, and fiat collection are simulated workflow gates.
