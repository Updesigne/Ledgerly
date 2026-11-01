import { ethers } from "hardhat";
import { Contract } from "ethers";

export async function deploySystem() {
  const [owner, supplier, investorA, investorB, outsider] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("MockUSDC");
  const token = await Token.deploy();
  await token.waitForDeployment();

  const Registry = await ethers.getContractFactory("InvoiceRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const Pricing = await ethers.getContractFactory("PricingEngine");
  const pricing = await Pricing.deploy();
  await pricing.waitForDeployment();

  const Capital = await ethers.getContractFactory("CapitalAccounts");
  const capital = await Capital.deploy(await token.getAddress());
  await capital.waitForDeployment();

  const Coordinator = await ethers.getContractFactory("FundingCoordinator");
  const coordinator = await Coordinator.deploy(
    await token.getAddress(),
    await registry.getAddress(),
    await pricing.getAddress(),
    await capital.getAddress(),
  );
  await coordinator.waitForDeployment();

  await (await registry.setCoordinator(await coordinator.getAddress())).wait();
  await (await capital.setCoordinator(await coordinator.getAddress())).wait();

  const usdc = (whole: bigint | number) => BigInt(whole) * 1_000_000n;
  await (await token.mint(investorA.address, usdc(20_000))).wait();
  await (await token.mint(investorB.address, usdc(20_000))).wait();
  await (await token.mint(owner.address, usdc(30_000))).wait();

  return {
    owner, supplier, investorA, investorB, outsider,
    token, registry, pricing, capital, coordinator, usdc,
  };
}

export async function createAssignedInvoice(system: Awaited<ReturnType<typeof deploySystem>>, opts?: {
  faceValue?: bigint;
  riskTier?: number;
  dueInDays?: number;
}) {
  const { owner, supplier, registry } = system;
  const faceValue = opts?.faceValue ?? system.usdc(10_000);
  const dueDate = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + (opts?.dueInDays ?? 60) * 24 * 60 * 60);
  const invoiceKey = ethers.keccak256(ethers.toUtf8Bytes(`invoice-${Date.now()}-${Math.random()}`));
  const debtorRef = ethers.keccak256(ethers.toUtf8Bytes("demo-debtor"));
  const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("demo-evidence"));

  await (await registry.connect(supplier).submitInvoice(invoiceKey, debtorRef, evidenceHash, faceValue, dueDate)).wait();
  const invoiceId = await registry.invoiceKeyToId(invoiceKey);
  await (await registry.connect(owner).reviewInvoice(invoiceId, true, opts?.riskTier ?? 2)).wait();
  const assignmentHash = ethers.keccak256(ethers.toUtf8Bytes("demo-assignment"));
  await (await registry.connect(owner).recordAssignment(invoiceId, assignmentHash)).wait();
  return { invoiceId, dueDate, invoiceKey, faceValue };
}

export async function configureAndDeposit(system: Awaited<ReturnType<typeof deploySystem>>, investor: any, amount: bigint, overrides?: {
  enabled?: boolean; maxDurationDays?: number; minExpectedReturnBps?: number; maxRiskTier?: number; maxPerInvoice?: bigint;
}) {
  const { token, capital } = system;
  await (await capital.connect(investor).setPolicy(
    overrides?.enabled ?? true,
    overrides?.maxDurationDays ?? 90,
    overrides?.minExpectedReturnBps ?? 0,
    overrides?.maxRiskTier ?? 4,
    overrides?.maxPerInvoice ?? amount,
  )).wait();
  await (await token.connect(investor).approve(await capital.getAddress(), amount)).wait();
  await (await capital.connect(investor).deposit(amount)).wait();
}
