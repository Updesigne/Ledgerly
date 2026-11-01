import { describe, expect } from "bun:test";
import { newTestRuntime, test } from "@chainlink/cre-sdk/test";
import {
  onHttpTrigger,
  onCronTrigger,
  initWorkflow,
  evaluateInvoiceRisk,
  computeCreditScoreAndTier,
} from "./workflow";
import type { Config } from "./workflow";
import type { HTTPPayload } from "@chainlink/cre-sdk";

describe("evaluateInvoiceRisk", () => {
  test("correctly scores prime credit to tier 1", () => {
    const res = evaluateInvoiceRisk(820, true, true);
    expect(res.approved).toBe(true);
    expect(res.riskTier).toBe(1);
  });

  test("correctly scores mid credit to tier 2 and 3", () => {
    const res2 = evaluateInvoiceRisk(750, true, true);
    expect(res2.approved).toBe(true);
    expect(res2.riskTier).toBe(2);

    const res3 = evaluateInvoiceRisk(700, true, true);
    expect(res3.approved).toBe(true);
    expect(res3.riskTier).toBe(3);
  });

  test("rejects invalid evidence or expired due date", () => {
    expect(evaluateInvoiceRisk(820, false, true).approved).toBe(false);
    expect(evaluateInvoiceRisk(820, true, false).approved).toBe(false);
    expect(evaluateInvoiceRisk(550, true, true).approved).toBe(false);
  });
});

describe("computeCreditScoreAndTier (CRE SDK)", () => {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const futureDue = currentTimestamp + 30 * 86400;
  const validEvidence = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  test("computes approved tier for valid invoice params", () => {
    const result = computeCreditScoreAndTier("acme-distribution", validEvidence, futureDue, "10000000000", currentTimestamp);
    expect(result.approved).toBe(true);
    expect(result.riskTier).toBeGreaterThanOrEqual(1);
    expect(result.riskTier).toBeLessThanOrEqual(4);
    expect(result.creditScore).toBeGreaterThanOrEqual(600);
    expect(result.creditScore).toBeLessThanOrEqual(850);
  });

  test("rejects invalid evidence hash", () => {
    const result = computeCreditScoreAndTier("acme-distribution", "", futureDue, "10000000000", currentTimestamp);
    expect(result.approved).toBe(false);
    expect(result.riskTier).toBe(0);
  });

  test("rejects past due date", () => {
    const pastDue = currentTimestamp - 100;
    const result = computeCreditScoreAndTier("acme-distribution", validEvidence, pastDue, "10000000000", currentTimestamp);
    expect(result.approved).toBe(false);
    expect(result.riskTier).toBe(0);
  });
});

describe("onHttpTrigger (CRE SDK HTTP Workflow)", () => {
  test("processes HTTP trigger payload and returns verified JSON", async () => {
    const config: Config = {
      schedule: "*/5 * * * *",
      invoiceRegistryAddress: "0x208dc6167694eFA6dA8e7f22791a769b0e594107",
      backendApiUrl: "http://localhost:4000",
    };
    const runtime = newTestRuntime<Config>();
    runtime.config = config;

    const payloadObj = {
      chainInvoiceId: "42",
      debtorReference: "acme-logistics",
      faceValue: "25000000000",
      dueDate: Math.floor(Date.now() / 1000) + 60 * 86400,
      evidenceHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    };

    const encoder = new TextEncoder();
    const mockHttpPayload = {
      input: encoder.encode(JSON.stringify(payloadObj)),
    } as unknown as HTTPPayload;

    const result = await onHttpTrigger(runtime, mockHttpPayload);
    const parsed = JSON.parse(result);

    expect(parsed.service).toBe("chainlink-cre-sdk-http-workflow");
    expect(parsed.status).toBe("verified");
    expect(parsed.result.invoiceId).toBe("42");
    expect(parsed.result.approved).toBe(true);
    expect(parsed.result.riskTier).toBeGreaterThanOrEqual(1);
    expect(parsed.result.riskTier).toBeLessThanOrEqual(4);
  });

  test("returns error status when no payload is provided", async () => {
    const config: Config = {
      schedule: "*/5 * * * *",
      invoiceRegistryAddress: "0x208dc6167694eFA6dA8e7f22791a769b0e594107",
      backendApiUrl: "http://localhost:4000",
    };
    const runtime = newTestRuntime<Config>();
    runtime.config = config;

    const result = await onHttpTrigger(runtime, { input: new Uint8Array() } as unknown as HTTPPayload);
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("error");
    expect(parsed.error).toContain("Missing required HTTP trigger payload");
  });

  test("returns error status when required invoice parameters are missing", async () => {
    const config: Config = {
      schedule: "*/5 * * * *",
      invoiceRegistryAddress: "0x208dc6167694eFA6dA8e7f22791a769b0e594107",
      backendApiUrl: "http://localhost:4000",
    };
    const runtime = newTestRuntime<Config>();
    runtime.config = config;

    const encoder = new TextEncoder();
    const incompletePayload = {
      chainInvoiceId: "99",
      // debtorReference and evidenceHash omitted
    };

    const result = await onHttpTrigger(runtime, {
      input: encoder.encode(JSON.stringify(incompletePayload)),
    } as unknown as HTTPPayload);
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("error");
    expect(parsed.error).toContain("Missing required parameters");
  });
});

describe("onCronTrigger", () => {
  test("logs message and returns verification json", async () => {
    const config: Config = {
      schedule: "*/5 * * * *",
      invoiceRegistryAddress: "0x208dc6167694eFA6dA8e7f22791a769b0e594107",
      backendApiUrl: "http://localhost:4000",
    };
    const runtime = newTestRuntime<Config>();
    runtime.config = config;

    const result = onCronTrigger(runtime);
    const parsed = JSON.parse(result);

    expect(parsed.service).toBe("chainlink-cre-invoice-verifier");
    expect(parsed.chainId).toBe(421614);
    expect(parsed.network).toBe("ethereum-testnet-sepolia-arbitrum-1");
  });
});

describe("initWorkflow", () => {
  test("returns HTTP and Cron handlers when schedule provided", async () => {
    const testSchedule = "0 0 * * *";
    const config: Config = {
      schedule: testSchedule,
      invoiceRegistryAddress: "0x208dc6167694eFA6dA8e7f22791a769b0e594107",
      backendApiUrl: "http://localhost:4000",
    };

    const handlers = initWorkflow(config);

    expect(handlers).toBeArray();
    expect(handlers).toHaveLength(2);
    expect(handlers[0].trigger.capabilityId()).toContain("http");
    expect((handlers[1].trigger as any).config.schedule).toBe(testSchedule);
  });
});
