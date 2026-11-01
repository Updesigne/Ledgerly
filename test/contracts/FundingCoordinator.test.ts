import { expect } from "chai";
import { deploySystem, createAssignedInvoice, configureAndDeposit } from "../helpers/deploy";

describe("FundingCoordinator", function () {
  async function prepared() {
    const s = await deploySystem();
    const invoice = await createAssignedInvoice(s, { riskTier: 2, dueInDays: 60 });
    await (await s.coordinator.createOffer(invoice.invoiceId, 3600)).wait();
    const offer = await s.coordinator.getOffer(invoice.invoiceId);
    await (await s.coordinator.connect(s.supplier).acceptOffer(invoice.invoiceId)).wait();
    return { ...s, ...invoice, offer };
  }

  it("funds an accepted offer only when allocations equal the purchase price", async function () {
    const s = await prepared();
    const price = s.offer.purchasePrice as bigint;
    const a = price / 2n;
    const b = price - a;
    await configureAndDeposit(s, s.investorA, a, { maxPerInvoice: a, maxRiskTier: 2, maxDurationDays: 90 });
    await configureAndDeposit(s, s.investorB, b, { maxPerInvoice: b, maxRiskTier: 2, maxDurationDays: 90 });

    await expect(s.coordinator.fundInvoice(s.invoiceId, [s.investorA.address, s.investorB.address], [a, b]))
      .to.emit(s.coordinator, "InvoiceFunded").withArgs(s.invoiceId, price, 2);
    expect((await s.capital.getBalance(s.investorA.address)).deployed).to.equal(a);
    expect((await s.capital.getBalance(s.investorB.address)).deployed).to.equal(b);
    expect(await s.token.balanceOf(s.supplier.address)).to.equal(price);
    expect((await s.registry.getInvoice(s.invoiceId)).status).to.equal(5n); // Funded
    await expect(s.coordinator.fundInvoice(s.invoiceId, [s.investorA.address, s.investorB.address], [a, b]))
      .to.be.revertedWithCustomError(s.coordinator, "InvalidStatus");
  });

  it("rejects underfunding and ineligible investors without reserving capital", async function () {
    const s = await prepared();
    const price = s.offer.purchasePrice as bigint;
    const a = price / 2n;
    const b = price - a;
    await configureAndDeposit(s, s.investorA, a, { maxPerInvoice: a, maxRiskTier: 2 });
    await configureAndDeposit(s, s.investorB, b, { maxPerInvoice: b, maxRiskTier: 1 });

    await expect(s.coordinator.fundInvoice(s.invoiceId, [s.investorA.address], [a]))
      .to.be.revertedWithCustomError(s.coordinator, "FundingMismatch");
    await expect(s.coordinator.fundInvoice(s.invoiceId, [s.investorA.address, s.investorB.address], [a, b]))
      .to.be.revertedWithCustomError(s.coordinator, "PolicyRejected");
    expect((await s.capital.getBalance(s.investorA.address)).available).to.equal(a);
    expect((await s.capital.getBalance(s.investorA.address)).reserved).to.equal(0n);
  });

  it("rejects duplicate investor entries", async function () {
    const s = await prepared();
    const price = s.offer.purchasePrice as bigint;
    await configureAndDeposit(s, s.investorA, price, { maxPerInvoice: price, maxRiskTier: 2 });
    await expect(s.coordinator.fundInvoice(s.invoiceId, [s.investorA.address, s.investorA.address], [price / 2n, price - price / 2n]))
      .to.be.revertedWithCustomError(s.coordinator, "InvalidInput");
  });

  it("distributes full collections pro-rata and prevents double settlement", async function () {
    const s = await prepared();
    const price = s.offer.purchasePrice as bigint;
    const a = price / 2n;
    const b = price - a;
    await configureAndDeposit(s, s.investorA, a, { maxPerInvoice: a, maxRiskTier: 2 });
    await configureAndDeposit(s, s.investorB, b, { maxPerInvoice: b, maxRiskTier: 2 });
    await (await s.coordinator.fundInvoice(s.invoiceId, [s.investorA.address, s.investorB.address], [a, b])).wait();

    const received = s.usdc(10_000);
    await (await s.token.approve(await s.coordinator.getAddress(), received)).wait();
    await expect(s.coordinator.collectAndSettle(s.invoiceId, received))
      .to.emit(s.coordinator, "SettlementDistributed").withArgs(s.invoiceId, received, price, true);

    const balanceA = await s.capital.getBalance(s.investorA.address);
    const balanceB = await s.capital.getBalance(s.investorB.address);
    expect(balanceA.deployed).to.equal(0n);
    expect(balanceB.deployed).to.equal(0n);
    expect(balanceA.available + balanceB.available).to.equal(received);
    expect((await s.registry.getInvoice(s.invoiceId)).status).to.equal(7n); // Settled
    await expect(s.coordinator.collectAndSettle(s.invoiceId, 1n))
      .to.be.revertedWithCustomError(s.coordinator, "DuplicateSettlement");
  });

  it("records a shortfall as default and allocates only received proceeds", async function () {
    const s = await prepared();
    const price = s.offer.purchasePrice as bigint;
    await configureAndDeposit(s, s.investorA, price, { maxPerInvoice: price, maxRiskTier: 2 });
    await (await s.coordinator.fundInvoice(s.invoiceId, [s.investorA.address], [price])).wait();

    const partial = s.usdc(5_000);
    await (await s.token.approve(await s.coordinator.getAddress(), partial)).wait();
    await (await s.coordinator.collectAndSettle(s.invoiceId, partial)).wait();
    const balance = await s.capital.getBalance(s.investorA.address);
    expect(balance.deployed).to.equal(0n);
    expect(balance.available).to.equal(partial);
    expect((await s.registry.getInvoice(s.invoiceId)).status).to.equal(11n); // Defaulted
  });

  it("only the coordinator owner can simulate collection", async function () {
    const s = await prepared();
    await expect(s.coordinator.connect(s.outsider).collectAndSettle(s.invoiceId, 1n))
      .to.be.revertedWithCustomError(s.coordinator, "Unauthorized");
  });
});
