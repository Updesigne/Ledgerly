import { expect } from "chai";
import { deploySystem, createAssignedInvoice, configureAndDeposit } from "../helpers/deploy";

describe("End-to-end receivable lifecycle", function () {
  it("submits, reviews, prices, accepts, funds, collects, and settles", async function () {
    const s = await deploySystem();
    const invoice = await createAssignedInvoice(s, { faceValue: s.usdc(8_000), riskTier: 1, dueInDays: 45 });

    await (await s.coordinator.createOffer(invoice.invoiceId, 3600)).wait();
    const offer = await s.coordinator.getOffer(invoice.invoiceId);
    expect(offer.purchasePrice).to.be.greaterThan(0n);
    await (await s.coordinator.connect(s.supplier).acceptOffer(invoice.invoiceId)).wait();

    const first = offer.purchasePrice / 3n;
    const second = offer.purchasePrice - first;
    await configureAndDeposit(s, s.investorA, first, { maxPerInvoice: first, maxDurationDays: 90, maxRiskTier: 1 });
    await configureAndDeposit(s, s.investorB, second, { maxPerInvoice: second, maxDurationDays: 90, maxRiskTier: 1 });

    await (await s.coordinator.fundInvoice(invoice.invoiceId, [s.investorA.address, s.investorB.address], [first, second])).wait();
    expect((await s.registry.getInvoice(invoice.invoiceId)).status).to.equal(5n);

    const repayment = s.usdc(8_000);
    await (await s.token.approve(await s.coordinator.getAddress(), repayment)).wait();
    await (await s.coordinator.collectAndSettle(invoice.invoiceId, repayment)).wait();

    expect((await s.registry.getInvoice(invoice.invoiceId)).status).to.equal(7n);
    expect((await s.capital.getBalance(s.investorA.address)).deployed).to.equal(0n);
    expect((await s.capital.getBalance(s.investorB.address)).deployed).to.equal(0n);
    expect(
      (await s.capital.getBalance(s.investorA.address)).available +
      (await s.capital.getBalance(s.investorB.address)).available,
    ).to.equal(repayment);
  });
});
