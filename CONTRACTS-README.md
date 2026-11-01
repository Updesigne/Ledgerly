# Receivables Marketplace — Smart Contracts MVP

Solidity contracts for a Arbitrum Sepolia hackathon demo. This is prototype code, not audited production finance infrastructure.

## Contracts

- `MockUSDC.sol`: owner-mintable six-decimal test token.
- `InvoiceRegistry.sol`: on-chain invoice identity, verifier status, risk tier, assignment workflow gate, and lifecycle status.
- `PricingEngine.sol`: configurable demo discount curve and risk adjustment.
- `CapitalAccounts.sol`: shared mock-token custody with per-investor available/reserved/deployed accounting and investment policies.
- `FundingCoordinator.sol`: offer creation/acceptance, policy-checked allocations, supplier payout, and terminal collection distribution.

## Compile

Use Solidity `0.8.24` or a compatible compiler and a Hardhat setup configured for the target Arbitrum Sepolia network. The contract suite uses no OpenZeppelin dependency; token transfer helpers and a small reentrancy guard are included under `libraries/`.

## Deployment and wiring order

1. Deploy `MockUSDC`.
2. Deploy `InvoiceRegistry`.
3. Deploy `PricingEngine`.
4. Deploy `CapitalAccounts(mockUSDC)`.
5. Deploy `FundingCoordinator(mockUSDC, registry, pricing, capitalAccounts)`.
6. Call `InvoiceRegistry.setCoordinator(fundingCoordinator)`.
7. Call `CapitalAccounts.setCoordinator(fundingCoordinator)`.
8. Keep the deploying owner/verifier roles secure. Mint mock USDC to demo investors and to the demo collection operator as needed.
9. Investor approves `CapitalAccounts` then calls `deposit`; investor sets a policy using `setPolicy`.
10. Supplier calls `submitInvoice`; authorized registry owner calls `reviewInvoice` and `recordAssignment` after the demo's off-chain review gates.
11. Authorized coordinator owner calls `createOffer`; supplier calls `acceptOffer`; caller submits `fundInvoice` with investor addresses and exact contribution amounts.
12. For demo collection, the collection operator must hold mock USDC and approve `FundingCoordinator`; authorized coordinator owner calls `collectAndSettle(invoiceId, amountReceived)`.

## Important implementation limitations

- `InvoiceRegistry` owner is a simplified verifier/operations role. Production should use role-based access control, multisig administration, and well-defined verifier permissions.
- `recordAssignment` records a workflow assertion only; it does not itself create a legally effective assignment. Jurisdiction-specific documents, notices, acknowledgements, and collection controls remain off-chain requirements.
- `collectAndSettle` is a **demo-only terminal collection**: one collection call closes the invoice. If `amountReceived < faceValue`, it records a default/shortfall and distributes the actual received amount pro rata. It does not support multiple installments, disputes resolution, or later recovery after default.
- The collection operator and contract owner are trusted in this MVP. Production must replace manual payment simulation with a secure, auditable payment-provider/bank reconciliation and attestation design.
- The pricing curve is illustrative, not a validated credit-pricing model. It does not calculate expected loss, servicing costs, taxes, fees, or jurisdiction-specific legal costs.
- The simple risk tier is supplied by an authorized verifier; it is not an oracle or an independently proven credit score.
- Shared token custody tracks individual investor ledgers. Deployed capital represents an exposure to a receivable, not liquid tokens held in reserve. In a production design, insolvency, losses, reconciliation, withdrawal rules, and all liabilities require much deeper treatment.
- The code has not been audited. Run tests, compile against the exact compiler/network configuration, and obtain an independent security review before any use beyond a testnet demo.
