/**
 * Capital Matching and Allocation Engine
 *
 * Implements risk-weighted, proportional capital allocation across multiple eligible
 * capital accounts to fund invoices.
 */

export interface CandidateAccount {
  address: string;
  available: bigint;
  maxPerInvoice: bigint;
  maxDurationDays: number;
  minExpectedReturnBps: number;
  maxRiskTier: number;
  enabled: boolean;
}

export interface InvoiceMatchParameters {
  invoiceId: string;
  purchasePrice: bigint;
  durationDays: number;
  riskTier: number;
  expectedReturnBps: number;
}

export interface CandidateEvaluation {
  address: string;
  capacity: bigint;
  available: bigint;
  maxPerInvoice: bigint;
  maxRiskTier: number;
  riskWeight: number; // weight multiplier based on investor's risk ceiling
  eligible: boolean;
  reason?: string;
}

export interface MatchAllocation {
  investor: string;
  amount: string;
  percentage: number;
}

export interface MatchResult {
  invoiceId: string;
  purchasePrice: string;
  durationDays: number;
  riskTier: number;
  expectedReturnBps: number;
  totalAvailableCapacity: string;
  fullyFundable: boolean;
  remaining: string;
  allocations: MatchAllocation[];
  candidates: Array<{
    address: string;
    capacity: string;
    available: string;
    maxRiskTier: number;
    eligible: boolean;
    reason?: string;
  }>;
}

/**
 * Calculates risk weight based on how much risk headroom the investor has relative to the invoice.
 * An investor with maxRiskTier = 4 taking a Tier 2 invoice has more comfort/headroom than one with maxRiskTier = 2.
 * Higher headroom gives a proportional weighting preference for risk-tolerant capital.
 */
function calculateRiskWeight(investorMaxRiskTier: number, invoiceRiskTier: number): number {
  const riskHeadroom = investorMaxRiskTier - invoiceRiskTier + 1; // 1 to 4
  return Math.max(1, riskHeadroom);
}

/**
 * Computes optimal allocations for funding an invoice across multiple candidate capital accounts.
 *
 * Principles:
 * 1. Filter out accounts not meeting policy conditions (duration, return, risk tier, enabled, capital).
 * 2. Effective capacity per investor = min(availableBalance, maxPerInvoice).
 * 3. If combined capacity >= purchasePrice, distribute the purchase price proportionally across
 *    all eligible investors weighted by their risk ceiling and capacity, rather than draining a single account.
 * 4. Cap individual allocations strictly at min(available, maxPerInvoice) and ensure exact sum = purchasePrice.
 */
export function computeFundingAllocations(
  params: InvoiceMatchParameters,
  accounts: CandidateAccount[]
): MatchResult {
  const { invoiceId, purchasePrice, durationDays, riskTier, expectedReturnBps } = params;

  // Step 1: Evaluate each candidate account
  const evaluated: CandidateEvaluation[] = [];

  for (const acc of accounts) {
    const cap = acc.available < acc.maxPerInvoice ? acc.available : acc.maxPerInvoice;
    let reason = "";

    if (!acc.enabled) {
      reason = "Policy disabled";
    } else if (durationDays > acc.maxDurationDays) {
      reason = `Duration (${durationDays}d) exceeds policy max (${acc.maxDurationDays}d)`;
    } else if (riskTier > acc.maxRiskTier) {
      reason = `Debtor risk (Tier ${riskTier}) exceeds risk ceiling (Tier ${acc.maxRiskTier})`;
    } else if (expectedReturnBps < acc.minExpectedReturnBps) {
      reason = `Expected return (${expectedReturnBps} bps) below required minimum (${acc.minExpectedReturnBps} bps)`;
    } else if (cap <= 0n) {
      reason = "No available capacity";
    }

    const eligible = !reason;
    const riskWeight = eligible ? calculateRiskWeight(acc.maxRiskTier, riskTier) : 0;

    evaluated.push({
      address: acc.address,
      capacity: eligible ? cap : 0n,
      available: acc.available,
      maxPerInvoice: acc.maxPerInvoice,
      maxRiskTier: acc.maxRiskTier,
      riskWeight,
      eligible,
      ...(reason ? { reason } : {}),
    });
  }

  const eligibleCandidates = evaluated.filter((x) => x.eligible && x.capacity > 0n);
  const totalCombinedCapacity = eligibleCandidates.reduce((sum, x) => sum + x.capacity, 0n);

  // If even all combined eligible accounts cannot cover the purchase price:
  if (totalCombinedCapacity < purchasePrice) {
    return {
      invoiceId,
      purchasePrice: purchasePrice.toString(),
      durationDays,
      riskTier,
      expectedReturnBps,
      totalAvailableCapacity: totalCombinedCapacity.toString(),
      fullyFundable: false,
      remaining: (purchasePrice - totalCombinedCapacity).toString(),
      allocations: [],
      candidates: evaluated.map((x) => ({
        address: x.address,
        capacity: x.capacity.toString(),
        available: x.available.toString(),
        maxRiskTier: x.maxRiskTier,
        eligible: x.eligible,
        reason: x.reason,
      })),
    };
  }

  // Step 2: Proportional Risk-Weighted Allocation
  // When combined capacity >= purchasePrice, all eligible accounts participate.
  // Weight = capacity * riskWeight.
  // We use an iterative capped pro-rata algorithm so no account exceeds its individual capacity limit.
  const active = eligibleCandidates.map((c) => ({
    address: c.address,
    cap: c.capacity,
    weight: BigInt(c.riskWeight) * c.capacity,
    allocated: 0n,
    fixed: false,
  }));

  let unallocated = purchasePrice;

  // Multi-pass water-filling to ensure no account is assigned more than its capacity:
  while (unallocated > 0n) {
    const unfixed = active.filter((a) => !a.fixed);
    if (unfixed.length === 0) break;

    const totalWeight = unfixed.reduce((sum, a) => sum + a.weight, 0n);
    if (totalWeight === 0n) {
      // Fallback: equal split among unfixed
      const equalShare = unallocated / BigInt(unfixed.length);
      for (const a of unfixed) {
        a.allocated += equalShare;
      }
      break;
    }

    let newlyCapped = false;
    for (const a of unfixed) {
      const share = (unallocated * a.weight) / totalWeight;
      if (a.allocated + share >= a.cap) {
        unallocated -= a.cap - a.allocated;
        a.allocated = a.cap;
        a.fixed = true;
        newlyCapped = true;
      }
    }

    if (!newlyCapped) {
      // Allocate proportional shares directly
      let distributed = 0n;
      for (const a of unfixed) {
        const share = (unallocated * a.weight) / totalWeight;
        a.allocated += share;
        distributed += share;
      }
      unallocated -= distributed;
      break;
    }
  }

  // Handle rounding remainder if any (distribute 1 wei at a time to accounts with capacity)
  if (unallocated > 0n) {
    for (const a of active) {
      if (unallocated === 0n) break;
      if (a.allocated < a.cap) {
        const diff = a.cap - a.allocated;
        const add = diff < unallocated ? diff : unallocated;
        a.allocated += add;
        unallocated -= add;
      }
    }
  }

  // Ensure allocations are formatted and non-zero
  const nonZeroAllocations = active
    .filter((a) => a.allocated > 0n)
    .map((a) => {
      const pct = purchasePrice > 0n
        ? Number((a.allocated * 10000n) / purchasePrice) / 100
        : 0;
      return {
        investor: a.address,
        amount: a.allocated.toString(),
        percentage: pct,
      };
    });

  return {
    invoiceId,
    purchasePrice: purchasePrice.toString(),
    durationDays,
    riskTier,
    expectedReturnBps,
    totalAvailableCapacity: totalCombinedCapacity.toString(),
    fullyFundable: true,
    remaining: "0",
    allocations: nonZeroAllocations,
    candidates: evaluated.map((x) => ({
      address: x.address,
      capacity: x.capacity.toString(),
      available: x.available.toString(),
      maxRiskTier: x.maxRiskTier,
      eligible: x.eligible,
      reason: x.reason,
    })),
  };
}
