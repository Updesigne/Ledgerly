# Receivables Marketplace Backend (MVP)

TypeScript + Express backend for the Arbitrum Sepolia receivables marketplace. All off-chain application state is persisted in local JSON files; no database is used.

## Responsibilities

- JSON persistence for invoice metadata, evidence references, offers, investor directory, funding allocations, collections, settlements, and indexed chain events.
- Read the on-chain contracts through ethers v6.
- Verify supplier-submitted invoice transaction receipts before indexing metadata.
- Run authorized demo operations: verifier review, assignment workflow gate, quote creation, funding coordination, and simulated collection.
- Match registered investor addresses against on-chain policy and balance data.
- Poll and index contract events to `data/chain-events.json`.

## Important trust boundaries

- Contract balances, policies, invoice status, accepted offers, funding contributions, and settlement state remain authoritative on-chain.
- JSON is a local cache/workflow store and can be rebuilt or reconciled. Do not use JSON to authorize money movement.
- The backend's `RELAYER_PRIVATE_KEY` must be a throwaway testnet/demo wallet. Never put a production key in `.env`, never commit `.env`, and never use a wallet with real assets.
- `review`, `assignment`, `quote`, and simulated collection routes require the relayer to have the corresponding contract-owner role in the current prototype.
- Assignment status is a demo workflow gate, not legal proof of a legally effective assignment.
- Collection simulation assumes the configured relayer is the FundingCoordinator owner, has mock USDC, and can approve the coordinator. It is not a real fiat-payment attestation.
- JSON writes are serialized within one Node process and use temp-file + rename. Run one backend instance only. This is not safe as a shared multi-instance production store.

## Setup

1. Deploy the contracts and configure the addresses in `backend/.env` using `.env.example`.
2. Copy `backend/.env.example` to `backend/.env` and set the current Arbitrum Sepolia Testnet RPC URL and chain ID from official documentation. Do not assume old RPC details remain current.
3. Install dependencies from this directory:

   ```bash
   npm install
   ```

4. Start development server:

   ```bash
   npm run dev
   ```

5. API health check: `GET http://localhost:4000/api/health`.

Default JSON storage path is `../data` relative to the backend working directory. Set `DATA_DIR` to override it.

## Contract configuration

Set these environment variables:

- `CHAIN_RPC_URL`
- `CHAIN_ID`
- `MOCK_USDC_ADDRESS`
- `INVOICE_REGISTRY_ADDRESS`
- `PRICING_ENGINE_ADDRESS`
- `CAPITAL_ACCOUNTS_ADDRESS`
- `FUNDING_COORDINATOR_ADDRESS`
- `RELAYER_PRIVATE_KEY`

The ABI signatures are defined in `src/chain/abis.ts`. If contract signatures change, update those fragments to match the compiled artifacts.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Backend, JSON store, and chain health |
| GET | `/api/dashboard` | Counts and recent activity |
| GET | `/api/invoices` | Cached invoices; optional `?status=Assigned` |
| POST | `/api/invoices/metadata` | Verify an on-chain submission receipt and persist off-chain metadata |
| GET | `/api/invoices/:id` | Read current on-chain invoice and cached offer |
| POST | `/api/invoices/:id/review` | Owner/verifier transaction to approve/reject and set risk tier |
| POST | `/api/invoices/:id/assignment` | Record the demo assignment workflow gate |
| POST | `/api/invoices/:id/quote` | Create an on-chain offer; default validity 24 hours |
| POST | `/api/invoices/:id/accept-offer` | Verify supplier's on-chain acceptance transaction and index it |
| GET | `/api/investors` | Registered investors enriched with on-chain balances/policies |
| POST | `/api/investors/register` | Add an investor wallet to the local matching directory |
| GET | `/api/opportunities` | Cached invoices in Assigned status |
| GET | `/api/opportunities/:id/match` | Calculate a suggested policy-compliant allocation |
| POST | `/api/opportunities/:id/fund` | Submit funding transaction through the configured testnet relayer |
| POST | `/api/invoices/:id/simulate-collection` | Demo-only mock USDC collection and settlement |
| GET | `/api/collections` | Collection records |
| GET | `/api/settlements` | Settlement records |
| GET | `/api/events` | Indexed event log/checkpoint |

## Request examples

### Register an investor

```json
{ "address": "0x0000000000000000000000000000000000000001", "label": "Demo investor A" }
```

Registration only adds a wallet to the backend's matching directory. The investor must still call `CapitalAccounts.setPolicy`, approve MockUSDC, and deposit from their wallet.

### Persist invoice metadata after on-chain submission

```json
{
  "chainInvoiceId": "1",
  "supplier": "0x0000000000000000000000000000000000000002",
  "invoiceKey": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "debtorReference": "demo-debtor-001",
  "faceValue": "10000000000",
  "dueDate": 1793000000,
  "evidenceHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "submitTxHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
}
```

The endpoint checks the transaction receipt and compares critical values with on-chain state. Replace all example addresses, hashes, and dates with actual values.

### Review and assignment

```json
{ "approved": true, "riskTier": 2 }
```

```json
{ "assignmentEvidenceHash": "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" }
```

### Quote, match, and fund

```json
{ "validForSeconds": 86400 }
```

Read `GET /api/opportunities/1/match` and pass its suggested allocations to the funding endpoint:

```json
{
  "allocations": [
    { "investor": "0x0000000000000000000000000000000000000003", "amount": "4000000000" },
    { "investor": "0x0000000000000000000000000000000000000004", "amount": "5401370000" }
  ]
}
```

Amounts are token base units (MockUSDC uses 6 decimals). The sum must exactly equal the accepted purchase price. The contract independently re-checks policy eligibility.

### Simulate collection

```json
{ "amountReceived": "10000000000" }
```

The relayer must already hold enough mock USDC and be authorized by the deployed contract. A shortfall is terminal in the current Solidity MVP and records a default; this backend does not simulate installment recovery.

## Known limitations

- This is an MVP scaffold, not audited financial infrastructure.
- The relayer is a trusted operator. Production requires proper role management, secure signing, multisig controls, and transaction monitoring.
- The matching algorithm is greedy, not an optimizer, and only sees investor wallets registered in `investors.json`.
- The JSON event indexer initially scans at most the most recent 2,000 blocks and then processes blocks in chunks of 500. Configure a deployment-specific checkpoint/backfill process if older history matters.
- The pricing formula is illustrative, not calibrated market pricing.
- There is no real invoice-verification provider, legal-assignment provider, bank integration, or payment oracle.
