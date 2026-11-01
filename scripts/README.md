# Deployment and demo scripts

These scripts deploy the five MVP contracts, wire coordinator permissions, export addresses, and run a complete mock invoice lifecycle.

## Local development

```bash
npm install
npm run node
# in another terminal
npm run compile
npm run deploy:local
npm run demo:local
```

The demo uses Hardhat signers in this order: signer 0 operator, signer 1 supplier, signer 2 investor A, signer 3 investor B. It mints mock tokens, creates investor policies and deposits, submits/verifies/assigns an invoice, creates and accepts an offer, funds it from compliant accounts, simulates full collection, and prints final balances.

## Arbitrum Sepolia testnet

Check the current official Arbitrum Sepolia Testnet RPC URL and chain ID before deployment. Set `ARBITRUM_SEPOLIA_RPC_URL`, `ARBITRUM_SEPOLIA_CHAIN_ID`, and `PRIVATE_KEY` in your local environment. To run the full remote demo, configure `PRIVATE_KEYS` as a comma-separated list of four disposable test-wallet keys ordered operator, supplier, investor A, investor B. Use test-only wallets and never commit `.env`.

```bash
npm run check:arbitrum-sepolia
npm run compile
npm run deploy:arbitrum-sepolia
npm run demo:arbitrum-sepolia
```

The deployment manifest is written to `deployments/<network>.json`. It contains public addresses only. Never store private keys in the manifest or commit `.env`.

## Important limitations

- The demo only works with this repository's `MockUSDC`; do not use it with a real token address.
- The operator simulates invoice verification, the assignment workflow gate, and debtor collection.
- Recording an assignment hash does not establish legal assignment.
- This is a hackathon prototype, not audited financial infrastructure.
