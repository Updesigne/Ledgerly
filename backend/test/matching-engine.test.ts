import { describe, it, expect } from "vitest";
import { computeFundingAllocations } from "../src/services/matching-engine.js";

describe("Matching & Allocation Engine", () => {
  it("pro-rata risk-weights allocations across 5 accounts to cover purchase price", () => {
    const purchasePrice = 10_000_000_000n; // 10,000 USDC (6 decimals)
    const accounts = [
      {
        address: "0x1111111111111111111111111111111111111111",
        available: 3_000_000_000n,
        maxPerInvoice: 5_000_000_000n,
        maxDurationDays: 90,
        minExpectedReturnBps: 100,
        maxRiskTier: 4, // high risk tolerance
        enabled: true,
      },
      {
        address: "0x2222222222222222222222222222222222222222",
        available: 3_000_000_000n,
        maxPerInvoice: 5_000_000_000n,
        maxDurationDays: 90,
        minExpectedReturnBps: 100,
        maxRiskTier: 3,
        enabled: true,
      },
      {
        address: "0x3333333333333333333333333333333333333333",
        available: 3_000_000_000n,
        maxPerInvoice: 5_000_000_000n,
        maxDurationDays: 90,
        minExpectedReturnBps: 100,
        maxRiskTier: 2,
        enabled: true,
      },
      {
        address: "0x4444444444444444444444444444444444444444",
        available: 3_000_000_000n,
        maxPerInvoice: 5_000_000_000n,
        maxDurationDays: 90,
        minExpectedReturnBps: 100,
        maxRiskTier: 2,
        enabled: true,
      },
      {
        address: "0x5555555555555555555555555555555555555555",
        available: 3_000_000_000n,
        maxPerInvoice: 5_000_000_000n,
        maxDurationDays: 90,
        minExpectedReturnBps: 100,
        maxRiskTier: 2,
        enabled: true,
      },
    ];

    const result = computeFundingAllocations(
      {
        invoiceId: "1",
        purchasePrice,
        durationDays: 30,
        riskTier: 2,
        expectedReturnBps: 500,
      },
      accounts,
    );

    expect(result.fullyFundable).toBe(true);
    expect(result.remaining).toBe("0");
    expect(result.allocations.length).toBe(5);

    // Verify all 5 participated and total sum matches purchasePrice exactly
    const sum = result.allocations.reduce(
      (acc, x) => acc + BigInt(x.amount),
      0n,
    );
    expect(sum).toBe(purchasePrice);

    // Verify risk-weighting: accounts with higher risk tier capacity take higher share
    const acc1 = result.allocations.find((x) => x.investor === accounts[0].address)!;
    const acc3 = result.allocations.find((x) => x.investor === accounts[2].address)!;
    expect(BigInt(acc1.amount)).toBeGreaterThan(BigInt(acc3.amount));
  });

  it("handles shortfall when combined capacity is insufficient", () => {
    const purchasePrice = 20_000_000_000n; // 20,000 USDC
    const accounts = [
      {
        address: "0x1111111111111111111111111111111111111111",
        available: 2_000_000_000n,
        maxPerInvoice: 5_000_000_000n,
        maxDurationDays: 90,
        minExpectedReturnBps: 100,
        maxRiskTier: 2,
        enabled: true,
      },
    ];

    const result = computeFundingAllocations(
      {
        invoiceId: "2",
        purchasePrice,
        durationDays: 30,
        riskTier: 2,
        expectedReturnBps: 500,
      },
      accounts,
    );

    expect(result.fullyFundable).toBe(false);
    expect(result.remaining).toBe("18000000000");
    expect(result.allocations.length).toBe(0);
  });
});
