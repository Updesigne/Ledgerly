import { expect } from "chai";
import { ethers } from "hardhat";

describe("PricingEngine", function () {
  async function fixture() {
    const [owner, outsider] = await ethers.getSigners();
    const Pricing = await ethers.getContractFactory("PricingEngine");
    const pricing = await Pricing.deploy();
    await pricing.waitForDeployment();
    return { owner, outsider, pricing };
  }

  it("calculates a bounded duration discount and risk adjustment", async function () {
    const { pricing } = await fixture();
    const face = 10_000_000_000n; // 10,000 USDC, 6 decimals
    const [price, totalDiscount, baseDiscount, riskDiscount] = await pricing.quote(face, 60, 2);
    expect(baseDiscount).to.equal(498n); // integer basis-point rounding
    expect(riskDiscount).to.equal(100n);
    expect(totalDiscount).to.equal(598n);
    expect(price).to.equal(face * (10_000n - 598n) / 10_000n);
  });

  it("caps duration at 365 days", async function () {
    const { pricing } = await fixture();
    const a = await pricing.quote(1_000_000n, 365, 1);
    const b = await pricing.quote(1_000_000n, 900, 1);
    expect(b[0]).to.equal(a[0]);
    expect(b[1]).to.equal(a[1]);
  });

  it("rejects invalid tiers and unauthorized configuration", async function () {
    const { pricing, outsider } = await fixture();
    await expect(pricing.quote(100n, 10, 0)).to.be.revertedWithCustomError(pricing, "InvalidInput");
    await expect(pricing.connect(outsider).setRiskAdjustment(2, 200)).to.be.revertedWithCustomError(pricing, "Unauthorized");
    await expect(pricing.connect(outsider).setParameters(900, 400, 100, 500))
      .to.be.revertedWithCustomError(pricing, "Unauthorized");
  });

  it("rejects invalid pricing parameters", async function () {
    const { pricing } = await fixture();
    await expect(pricing.setParameters(900, 400, 100, 500))
      .to.be.revertedWithCustomError(pricing, "InvalidInput");
    await expect(pricing.setRiskAdjustment(5, 100))
      .to.be.revertedWithCustomError(pricing, "InvalidInput");
  });
});
