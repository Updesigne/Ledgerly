# Test strategy

## Install and run

From the repository root:

```bash
npm install
npm run test:contracts
npm run test:integration
npm run test:backend
npm run typecheck:backend
npm run typecheck:frontend
```

The Hardhat suite compiles Solidity `0.8.24` and runs local EVM tests. Backend tests use Vitest. The frontend currently has no dedicated automated component test suite; use the manual smoke-test checklist below.

## Contract coverage

- MockUSDC: owner-only minting, decimals, transferFrom allowance.
- PricingEngine: duration curve, risk adjustment, 365-day cap, invalid configuration.
- InvoiceRegistry: unique invoice keys, verification role, risk tier, assignment gate.
- CapitalAccounts: deposit/withdraw, isolated balances, policy eligibility, coordinator-only operations.
- FundingCoordinator: exact funding amount, rejected policy, duplicate investor protection, full and partial collection, no double settlement.
- Integration: invoice submission through collection and distribution.

## Frontend smoke test

1. Start the backend and frontend with valid testnet contract addresses.
2. Connect a test wallet on the configured Arbitrum Sepolia network.
3. Mint mock USDC from the owner account, approve CapitalAccounts, and deposit as two investor wallets.
4. Set different policies and verify that an account with a restrictive risk tier is excluded from matching.
5. Submit an invoice, review it as the authorized operator, record the assignment gate, create the offer, and accept as the supplier.
6. Fund the exact purchase price; verify balances and supplier payment on-chain.
7. Simulate a full collection and verify final balances and `Settled` status.
8. Use a second invoice to simulate a partial collection; verify the shortfall is shown as `Defaulted` and only actual received proceeds are credited.
9. Refresh the browser and confirm that JSON-backed metadata is retained while chain-backed balances are re-read from contracts.
10. Restart the backend and verify JSON state can be loaded and indexed events are not applied twice.

## Known contract MVP limitations to keep in mind when interpreting tests

- The demo collection is terminal: a partial collection closes the invoice as `Defaulted`; installments and later recoveries are not supported.
- The contract records an assignment workflow gate, not a legal opinion or proof that assignment is enforceable.
- Verification and collection simulation rely on owner authorization; production requires stronger role separation and payment reconciliation.
- FundingCoordinator's contribution allocation uses the accepted purchase price as principal and credits proceeds in the shared CapitalAccounts custody. Tests are not a security audit.
- The price curve is illustrative and does not represent a validated credit-pricing model.
