import { expect } from "chai";
import { deploySystem, configureAndDeposit } from "../helpers/deploy";

describe("CapitalAccounts", function () {
  it("deposits, withdraws, and keeps investor balances separately accounted", async function () {
    const s = await deploySystem();
    const amountA = s.usdc(2_000);
    const amountB = s.usdc(3_000);
    await configureAndDeposit(s, s.investorA, amountA);
    await configureAndDeposit(s, s.investorB, amountB);

    expect((await s.capital.getBalance(s.investorA.address)).available).to.equal(amountA);
    expect((await s.capital.getBalance(s.investorB.address)).available).to.equal(amountB);
    await (await s.capital.connect(s.investorA).withdraw(s.usdc(500))).wait();
    expect((await s.capital.getBalance(s.investorA.address)).available).to.equal(s.usdc(1_500));
  });

  it("rejects withdrawals beyond available balance and zero deposits", async function () {
    const s = await deploySystem();
    await expect(s.capital.connect(s.investorA).deposit(0)).to.be.revertedWithCustomError(s.capital, "InvalidInput");
    await expect(s.capital.connect(s.investorA).withdraw(1)).to.be.revertedWithCustomError(s.capital, "InsufficientAvailable");
  });

  it("enforces policy eligibility", async function () {
    const s = await deploySystem();
    await configureAndDeposit(s, s.investorA, s.usdc(2_000), {
      maxDurationDays: 30, maxRiskTier: 2, minExpectedReturnBps: 500,
    });
    expect(await s.capital.isEligible(s.investorA.address, s.usdc(1_000), 20, 2, 600)).to.equal(true);
    expect(await s.capital.isEligible(s.investorA.address, s.usdc(1_000), 31, 2, 600)).to.equal(false);
    expect(await s.capital.isEligible(s.investorA.address, s.usdc(1_000), 20, 3, 600)).to.equal(false);
    expect(await s.capital.isEligible(s.investorA.address, s.usdc(1_000), 20, 2, 400)).to.equal(false);
    expect(await s.capital.isEligible(s.investorA.address, s.usdc(3_000), 20, 2, 600)).to.equal(false);
  });

  it("restricts reserve and settlement operations to the coordinator", async function () {
    const s = await deploySystem();
    await expect(s.capital.connect(s.outsider).reserve(s.investorA.address, 1, 1))
      .to.be.revertedWithCustomError(s.capital, "Unauthorized");
    await expect(s.capital.connect(s.outsider).settleContribution(s.investorA.address, 1, 1, 1))
      .to.be.revertedWithCustomError(s.capital, "Unauthorized");
  });
});
