import { ethers, network } from "hardhat";
import fs from "node:fs";

const USDC = (amount: string) => ethers.parseUnits(amount, 6);

async function main() {
  const deploymentPath = `deployments/${network.name}.json`;
  if (!fs.existsSync(deploymentPath)) throw new Error(`No deployment at ${deploymentPath}. Run deployment first.`);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const a = deployment.contracts;
  const signers = await ethers.getSigners();
  if (signers.length < 4) throw new Error("Demo requires 4 signers: operator, supplier, investor A, investor B.");
  const [operator, supplier, investorA, investorB] = signers;

  console.log(`Demo on ${network.name} (chain ${deployment.chainId})`);
  console.log(`Operator ${operator.address}\nSupplier ${supplier.address}\nInvestor A ${investorA.address}\nInvestor B ${investorB.address}`);
  const token = await ethers.getContractAt("MockUSDC", a.mockUSDC);
  const registry = await ethers.getContractAt("InvoiceRegistry", a.invoiceRegistry);
  const capital = await ethers.getContractAt("CapitalAccounts", a.capitalAccounts);
  const coordinator = await ethers.getContractAt("FundingCoordinator", a.fundingCoordinator);

  // Only use this script with this project's MockUSDC contract and disposable test wallets.
  await (await token.mint(investorA.address, USDC("10000"))).wait();
  await (await token.mint(investorB.address, USDC("10000"))).wait();
  await (await token.mint(operator.address, USDC("10000"))).wait();
  const deposit = USDC("5000");
  const policy = [true, 365, 0, 4, USDC("5000")] as const;
  for (const investor of [investorA, investorB]) {
    await (await capital.connect(investor).setPolicy(...policy)).wait();
    await (await token.connect(investor).approve(a.capitalAccounts, deposit)).wait();
    await (await capital.connect(investor).deposit(deposit)).wait();
  }

  const block = await ethers.provider.getBlock("latest");
  if (!block) throw new Error("Could not read latest block.");
  const faceValue = USDC("6000");
  const dueDate = block.timestamp + 90 * 24 * 60 * 60;
  const nonce = `${Date.now()}-${Math.random()}`;
  const invoiceKey = ethers.keccak256(ethers.toUtf8Bytes(`demo-invoice-${nonce}`));
  const debtorRef = ethers.keccak256(ethers.toUtf8Bytes(`demo-debtor-${nonce}`));
  const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes(`demo-evidence-${nonce}`));
  const assignmentHash = ethers.keccak256(ethers.toUtf8Bytes(`demo-assignment-${nonce}`));

  console.log("1/6 Submit invoice");
  await (await registry.connect(supplier).submitInvoice(invoiceKey, debtorRef, evidenceHash, faceValue, dueDate)).wait();
  const invoiceId = await registry.invoiceKeyToId(invoiceKey);
  console.log("2/6 Verify invoice and record simulated assignment gate");
  await (await registry.reviewInvoice(invoiceId, true, 2)).wait();
  await (await registry.recordAssignment(invoiceId, assignmentHash)).wait();
  console.log("3/6 Create offer and accept as supplier");
  await (await coordinator.createOffer(invoiceId, 24 * 60 * 60)).wait();
  const offer = await coordinator.getOffer(invoiceId);
  await (await coordinator.connect(supplier).acceptOffer(invoiceId)).wait();

  const purchasePrice: bigint = offer.purchasePrice;
  const contributionA = purchasePrice / 2n;
  const contributionB = purchasePrice - contributionA;
  if (contributionA > deposit || contributionB > deposit) throw new Error("Investor deposit too small for quote.");
  console.log(`4/6 Fund invoice for ${ethers.formatUnits(purchasePrice, 6)} mUSDC`);
  await (await coordinator.fundInvoice(invoiceId, [investorA.address, investorB.address], [contributionA, contributionB])).wait();
  console.log("5/6 Simulate full debtor collection and settle pro-rata");
  await (await token.approve(a.fundingCoordinator, faceValue)).wait();
  await (await coordinator.collectAndSettle(invoiceId, faceValue)).wait();

  const invoice = await registry.getInvoice(invoiceId);
  const balanceA = await capital.getBalance(investorA.address);
  const balanceB = await capital.getBalance(investorB.address);
  console.log("6/6 Demo complete");
  console.log(JSON.stringify({
    invoiceId: invoiceId.toString(),
    statusNumber: Number(invoice.status),
    status: Number(invoice.status) === 7 ? "Settled" : Number(invoice.status) === 11 ? "Defaulted" : "See InvoiceRegistry.Status enum",
    faceValue: ethers.formatUnits(faceValue, 6),
    purchasePrice: ethers.formatUnits(purchasePrice, 6),
    collectionReceived: ethers.formatUnits(faceValue, 6),
    investors: [
      { address: investorA.address, available: ethers.formatUnits(balanceA.available, 6), deployed: ethers.formatUnits(balanceA.deployed, 6) },
      { address: investorB.address, available: ethers.formatUnits(balanceB.available, 6), deployed: ethers.formatUnits(balanceB.deployed, 6) },
    ],
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
