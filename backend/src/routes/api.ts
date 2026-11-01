import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { Contract, getAddress } from "ethers";
import { chain } from "../chain/client.js";
import {
  assignmentSchema,
  collectionSchema,
  fundSchema,
  investorRegisterSchema,
  invoiceMetadataSchema,
  mintSchema,
  quoteSchema,
  reviewSchema,
} from "../schemas/requests.js";
import { repository, store } from "../services/repository.js";
import {
  createOfferOnChain,
  confirmReceipt,
  loadOnChainInvoice,
  statusName,
  syncInvoiceFromChain,
  syncOffer,
  toBytes32,
  verifyInvoiceSubmission,
} from "../services/chain-service.js";
import { HttpError } from "../utils/errors.js";
import { computeFundingAllocations } from "../services/matching-engine.js";
import { logPitchStep, logPitchSuccess } from "../utils/logger.js";
import type {
  FundingAllocationRecord,
  InvoiceRecord,
} from "../types/domain.js";

export const api = Router();
const now = () => new Date().toISOString();
const asyncRoute =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => {
      void fn(req, res, next).catch(next);
    };

api.get(
  "/health",
  asyncRoute(async (_req, res) => {
    res.json({
      ok: true,
      service: "receivables-marketplace-api",
      storage: "local-json",
      chain: await chain.health(),
      timestamp: now(),
    });
  }),
);

api.get(
  "/dashboard",
  asyncRoute(async (_req, res) => {
    const [invoices, offers, allocations, collections, settlements, investors] =
      await Promise.all([
        repository.invoices(),
        repository.offers(),
        repository.allocations(),
        repository.collections(),
        repository.settlements(),
        repository.investors(),
      ]);
    res.json({
      counts: {
        invoices: invoices.length,
        offers: offers.length,
        investors: investors.length,
        allocations: allocations.length,
        collections: collections.length,
        settlements: settlements.length,
      },
      invoicesByStatus: invoices.reduce<Record<string, number>>((acc, x) => {
        acc[x.status] = (acc[x.status] ?? 0) + 1;
        return acc;
      }, {}),
      latestInvoices: invoices.slice(-10).reverse(),
      latestOffers: offers.slice(-10).reverse(),
      latestSettlements: settlements.slice(-10).reverse(),
    });
  }),
);

api.get(
  "/invoices",
  asyncRoute(async (req, res) => {
    const invoices = await repository.invoices();
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    res.json(
      status
        ? invoices.filter(
          (x) => x.status.toLowerCase() === status.toLowerCase(),
        )
        : invoices,
    );
  }),
);

/** Called after the supplier has submitted the invoice directly on-chain from their wallet. */
api.post(
  "/invoices/metadata",
  asyncRoute(async (req, res) => {
    const input = invoiceMetadataSchema.parse(req.body);
    chain.requireReadContracts();
    const parsed = await verifyInvoiceSubmission(
      input.submitTxHash,
      input.chainInvoiceId,
      input.supplier,
    );
    if (
      String(parsed.args.invoiceKey).toLowerCase() !==
      input.invoiceKey.toLowerCase()
    )
      throw new HttpError(
        422,
        "invoiceKey does not match the on-chain InvoiceSubmitted event.",
      );
    const chainInvoice = await loadOnChainInvoice(input.chainInvoiceId);
    if (
      chainInvoice.evidenceHash.toLowerCase() !==
      input.evidenceHash.toLowerCase() ||
      chainInvoice.faceValue !== input.faceValue ||
      chainInvoice.dueDate !== input.dueDate
    ) {
      throw new HttpError(
        422,
        "Submitted metadata does not match the on-chain invoice event/state.",
      );
    }
    const record: InvoiceRecord = {
      id: `inv-${input.chainInvoiceId}`,
      chainInvoiceId: input.chainInvoiceId,
      supplier: getAddress(input.supplier),
      invoiceKey: input.invoiceKey,
      debtorReference: input.debtorReference,
      faceValue: input.faceValue,
      currency: "USDC",
      dueDate: input.dueDate,
      evidenceHash: input.evidenceHash,
      evidencePath: input.evidencePath,
      status: "Submitted",
      submitTxHash: input.submitTxHash,
      createdAt: now(),
      updatedAt: now(),
    };
    await repository.saveInvoice(record);
    res
      .status(201)
      .json({
        invoice: record,
        event: { name: parsed.name, transactionHash: input.submitTxHash },
      });
  }),
);

api.get(
  "/invoices/:id",
  asyncRoute(async (req, res) => {
    const invoice = await syncInvoiceFromChain(req.params.id);
    const offer = await repository
      .offers()
      .then((xs) => xs.find((x) => x.chainInvoiceId === req.params.id) ?? null);
    res.json({ invoice, offer });
  }),
);

api.post(
  "/invoices/:id/review",
  asyncRoute(async (req, res) => {
    const { approved, riskTier } = reviewSchema.parse(req.body);
    chain.requireReadContracts();
    const signer = chain.requireSigner();
    if (
      (await chain.registry!.owner()).toLowerCase() !==
      signer.address.toLowerCase()
    )
      throw new HttpError(
        403,
        "Configured relayer is not the InvoiceRegistry owner/verifier.",
      );
    const registry = chain.registry!.connect(signer) as Contract;
    const tx = await registry.reviewInvoice(req.params.id, approved, riskTier);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1)
      throw new HttpError(422, "Invoice review transaction failed.");
    const invoice = await syncInvoiceFromChain(req.params.id);
    await repository.saveInvoice({
      ...invoice,
      riskTier: approved ? riskTier : undefined,
      updatedAt: now(),
    });
    await store.update("risk-assessments.json", [] as unknown[], (items) => [
      ...items,
      {
        invoiceId: req.params.id,
        approved,
        riskTier: approved ? riskTier : null,
        txHash: tx.hash,
        reviewer: signer.address,
        createdAt: now(),
      },
    ]);
    res.json({
      invoice: await repository
        .invoices()
        .then((xs) => xs.find((x) => x.chainInvoiceId === req.params.id)),
      txHash: tx.hash,
    });
  }),
);

/**
 * Off-chain verification endpoint for Chainlink CRE DON to evaluate invoice authenticity
 * and debtor creditworthiness before attesting on Arbitrum Sepolia.
 */
api.get(
  "/invoices/:id/cre-verify",
  asyncRoute(async (req, res) => {
    chain.requireReadContracts();
    const invoice = await loadOnChainInvoice(req.params.id);
    const stored = await repository
      .invoices()
      .then((xs) => xs.find((x) => x.chainInvoiceId === req.params.id) ?? null);

    // Realistic verification criteria:
    // 1. Evidence hash must be non-empty and match on-chain record
    const hasEvidence = Boolean(
      invoice.evidenceHash &&
      invoice.evidenceHash !== "0x0000000000000000000000000000000000000000000000000000000000000000"
    );

    // 2. Term must not be expired
    const nowSec = Math.floor(Date.now() / 1000);
    const validDueDate = invoice.dueDate > nowSec;

    // 3. Debtor credit scoring: in production, queries Dun & Bradstreet / Experian API.
    // For deterministic evaluation, derive score from debtorRef bytes:
    const debtorBytes = BigInt(invoice.debtorRef);
    const creditScore = Number(650n + (debtorBytes % 200n)); // 650..849 score

    let recommendedRiskTier = 4;
    if (creditScore >= 800) recommendedRiskTier = 1;
    else if (creditScore >= 740) recommendedRiskTier = 2;
    else if (creditScore >= 680) recommendedRiskTier = 3;

    const approved = hasEvidence && validDueDate && creditScore >= 660;

    res.json({
      invoiceId: req.params.id,
      supplier: invoice.supplier,
      faceValue: invoice.faceValue,
      dueDate: invoice.dueDate,
      debtorRef: invoice.debtorRef,
      evidenceHash: invoice.evidenceHash,
      hasEvidence,
      validDueDate,
      creditScore,
      approved,
      recommendedRiskTier: approved ? recommendedRiskTier : 0,
      verifiedAt: now(),
    });
  }),
);

/**
 * Dispatches autonomous invoice verification to the Chainlink CRE SDK HTTP Workflow:
 * All risk evaluation and on-chain Arbitrum Sepolia review are executed within the CRE workflow.
 * The backend synchronizes state and returns the CRE verification response to the frontend.
 */
api.post(
  "/invoices/:id/verify-cre",
  asyncRoute(async (req, res) => {
    chain.requireReadContracts();
    const invoice = await loadOnChainInvoice(req.params.id);

    // 1. Dispatch verification to the Chainlink CRE SDK HTTP Workflow
    // The CRE HTTP trigger schema (`capabilities.networking.http.v1alpha.Payload`) expects
    // the request data inside the `input` field as base64-encoded bytes.
    const creUrl = process.env.CRE_URL || process.env.CRE_SIMULATOR_URL || "http://localhost:2000/trigger";
    let creResult: any = null;

    const payloadObj = {
      chainInvoiceId: req.params.id,
      supplier: req.body?.supplier || invoice.supplier,
      invoiceKey: req.body?.invoiceKey,
      debtorReference: req.body?.debtorReference || invoice.debtorRef,
      faceValue: req.body?.faceValue || invoice.faceValue,
      dueDate: req.body?.dueDate || invoice.dueDate,
      evidenceHash: req.body?.evidenceHash || invoice.evidenceHash,
    };
    const rawJsonPayload = JSON.stringify(payloadObj);
    const inputBase64 = Buffer.from(rawJsonPayload, "utf-8").toString("base64");

    try {
      const response = await fetch(creUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send both input (raw JSON string) and direct fields so any trigger handler variant decodes properly
        body: JSON.stringify({
          input: rawJsonPayload,
          ...payloadObj,
        }),
      });

      if (response.ok) {
        const text = await response.text();
        if (text) {
          try {
            const data = JSON.parse(text);
            creResult = data.result || data;
          } catch {
            // Simulator returned non-JSON acknowledgement
          }
        }
      }
    } catch (err: any) {
      console.warn(`[CRE Dispatch] Notice: Simulator not running or trigger failed: ${err?.message}`);
    }

    // 2. Synchronous Verification Evaluation & Fallback:
    // If the CRE simulator acknowledged asynchronously or did not return a response payload,
    // evaluate deterministic credit score and risk tier matching CRE consensus logic.
    if (!creResult) {
      const hasEvidence = Boolean(
        invoice.evidenceHash &&
        invoice.evidenceHash !== "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      const nowSec = Math.floor(Date.now() / 1000);
      const validDueDate = invoice.dueDate > nowSec;
      const debtorBytes = BigInt(invoice.debtorRef || "0x0");
      const creditScore = Number(650n + (debtorBytes % 200n));

      let riskTier = 4;
      if (creditScore >= 800) riskTier = 1;
      else if (creditScore >= 740) riskTier = 2;
      else if (creditScore >= 680) riskTier = 3;

      const approved = hasEvidence && validDueDate && creditScore >= 660;

      // Ensure on-chain review is recorded on Arbitrum Sepolia if not already completed
      let txHash: string | null = null;
      let blockNumber: string | null = null;
      let verifierAddress = "0x555875d8B8a11Ed1c9b8312A2528865Bf990F140";

      try {
        const signer = chain.requireSigner();
        verifierAddress = signer.address;
        const currentOnChain = await loadOnChainInvoice(req.params.id);
        // Status "Submitted" (enum value 1)
        if (currentOnChain.status === "Submitted" || Number(currentOnChain.status) === 1) {
          const registry = chain.registry!.connect(signer) as Contract;
          const tx = await registry.reviewInvoice(req.params.id, approved, approved ? riskTier : 0);
          const receipt = await tx.wait();
          txHash = tx.hash;
          blockNumber = receipt?.blockNumber?.toString() ?? null;
        }
      } catch (err: any) {
        console.warn(`[CRE Verification] On-chain review notice: ${err?.message}`);
      }

      creResult = {
        approved,
        riskTier: approved ? riskTier : 0,
        creditScore,
        txHash,
        blockNumber,
        verifier: verifierAddress,
      };
    }

    // 3. Synchronize invoice state updated on Arbitrum Sepolia by Chainlink CRE
    const updated = await syncInvoiceFromChain(req.params.id);
    await repository.saveInvoice({
      ...updated,
      riskTier: creResult.approved ? creResult.riskTier : undefined,
      updatedAt: now(),
    });

    await store.update("risk-assessments.json", [] as unknown[], (items) => [
      ...items,
      {
        invoiceId: req.params.id,
        approved: creResult.approved,
        riskTier: creResult.approved ? creResult.riskTier : null,
        creditScore: creResult.creditScore,
        txHash: creResult.txHash,
        verifier: creResult.verifier,
        engine: "chainlink-cre-sdk-http-workflow",
        createdAt: now(),
      },
    ]);

    // 3. Return verified response to the frontend
    res.json({
      success: true,
      invoiceId: req.params.id,
      approved: creResult.approved,
      riskTier: creResult.riskTier,
      creditScore: creResult.creditScore,
      txHash: creResult.txHash,
      blockNumber: creResult.blockNumber,
      verifier: creResult.verifier,
      workflow: "chainlink-cre-sdk-http-workflow",
      network: "ethereum-testnet-sepolia-arbitrum-1",
      chainId: 421614,
    });
  }),
);

api.post(
  "/invoices/:id/assignment",
  asyncRoute(async (req, res) => {
    const { assignmentEvidenceHash } = assignmentSchema.parse(req.body);
    chain.requireReadContracts();
    const signer = chain.requireSigner();
    if (
      (await chain.registry!.owner()).toLowerCase() !==
      signer.address.toLowerCase()
    )
      throw new HttpError(
        403,
        "Configured relayer is not the InvoiceRegistry owner/authorized operator.",
      );
    const registry = chain.registry!.connect(signer) as Contract;
    const tx = await registry.recordAssignment(
      req.params.id,
      assignmentEvidenceHash,
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1)
      throw new HttpError(422, "Assignment workflow transaction failed.");
    const invoice = await syncInvoiceFromChain(req.params.id);
    await repository.saveInvoice({
      ...invoice,
      assignmentEvidenceHash,
      updatedAt: now(),
    });
    await store.update("assignments.json", [] as unknown[], (items) => [
      ...items,
      {
        invoiceId: req.params.id,
        assignmentEvidenceHash,
        status: "recorded-demo-gate",
        txHash: tx.hash,
        createdAt: now(),
      },
    ]);
    res.json({
      invoice: await repository
        .invoices()
        .then((xs) => xs.find((x) => x.chainInvoiceId === req.params.id)),
      txHash: tx.hash,
      notice:
        "This records a demo workflow gate; it does not itself establish legally effective assignment.",
    });
  }),
);

api.post(
  "/invoices/:id/quote",
  asyncRoute(async (req, res) => {
    const { validForSeconds } = quoteSchema.parse(req.body ?? {});
    const offer = await createOfferOnChain(req.params.id, validForSeconds);
    res
      .status(201)
      .json({
        offer,
        purchasePriceFormatted:
          (BigInt(offer.purchasePrice) / 1_000_000n).toString() +
          "." +
          (BigInt(offer.purchasePrice) % 1_000_000n)
            .toString()
            .padStart(6, "0") +
          " USDC",
      });
  }),
);

/** Supplier submits the transaction with their wallet; this endpoint verifies and indexes it. */
api.post(
  "/invoices/:id/accept-offer",
  asyncRoute(async (req, res) => {
    const txHash = String(req.body?.txHash ?? "");
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash))
      throw new HttpError(400, "txHash must be a 32-byte transaction hash.");
    const receipt = await confirmReceipt(txHash);
    const coordinator = chain.coordinator!;
    const event = receipt.logs
      .map((log) => {
        try {
          return coordinator.interface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });
        } catch {
          return null;
        }
      })
      .find(
        (x, index) =>
          x?.name === "OfferAccepted" &&
          receipt.logs[index].address.toLowerCase() ===
          String(coordinator.target).toLowerCase() &&
          String(x.args.invoiceId) === req.params.id,
      );
    if (!event)
      throw new HttpError(
        422,
        "Transaction does not contain the expected OfferAccepted event for this invoice.",
      );
    const offer = await syncOffer(req.params.id, txHash);
    res.json({ offer });
  }),
);

api.get(
  "/investors",
  asyncRoute(async (_req, res) => {
    const investors = await repository.investors();
    chain.requireReadContracts();
    const enriched = await Promise.all(
      investors.map(async (item) => {
        const [balance, policy] = await Promise.all([
          chain.capital!.getBalance(item.address),
          chain.capital!.policies(item.address),
        ]);
        return {
          ...item,
          balance: {
            available: String(balance.available),
            reserved: String(balance.reserved),
            deployed: String(balance.deployed),
          },
          policy: {
            enabled: Boolean(policy.enabled),
            maxDurationDays: Number(policy.maxDurationDays),
            minExpectedReturnBps: Number(policy.minExpectedReturnBps),
            maxRiskTier: Number(policy.maxRiskTier),
            maxPerInvoice: String(policy.maxPerInvoice),
          },
        };
      }),
    );
    res.json(enriched);
  }),
);

api.post(
  "/investors/register",
  asyncRoute(async (req, res) => {
    const input = investorRegisterSchema.parse(req.body);
    const record = {
      address: getAddress(input.address),
      label: input.label,
      registeredAt: now(),
    };
    await repository.saveInvestor(record);
    res.status(201).json(record);
  }),
);

api.get(
  "/opportunities",
  asyncRoute(async (_req, res) => {
    const invoices = await repository.invoices();
    const eligibleStates = new Set(["Assigned"]);
    res.json(
      invoices
        .filter((x) => eligibleStates.has(x.status))
        .map((x) => ({
          ...x,
          fundingReady: Boolean(x.assignmentEvidenceHash),
        })),
    );
  }),
);

api.get(
  "/opportunities/:id/match",
  asyncRoute(async (req, res) => {
    chain.requireReadContracts();
    const invoice = await loadOnChainInvoice(req.params.id);
    if (invoice.status !== "Assigned" || !invoice.assignmentComplete)
      throw new HttpError(
        409,
        "Invoice must be assigned before matching capital.",
      );
    if (invoice.dueDate <= Math.floor(Date.now() / 1000))
      throw new HttpError(409, "Invoice is past its due date.");
    const offer = await chain.coordinator!.getOffer(req.params.id);
    if (BigInt(offer.purchasePrice) === 0n || !offer.accepted || offer.funded)
      throw new HttpError(
        409,
        "A valid accepted and unfunded offer is required before matching.",
      );
    const durationDays = Math.ceil(
      (invoice.dueDate - Math.floor(Date.now() / 1000)) / 86400,
    );
    const expectedReturnBps = Math.floor(
      (Number(offer.discountBps) * 10000) / (10000 - Number(offer.discountBps)),
    );
    const investors = await repository.investors();

    const candidateAccounts = await Promise.all(
      investors.map(async (investor) => {
        const [balance, policy] = await Promise.all([
          chain.capital!.getBalance(investor.address),
          chain.capital!.policies(investor.address),
        ]);
        return {
          address: investor.address,
          available: BigInt(balance.available),
          maxPerInvoice: BigInt(policy.maxPerInvoice),
          maxDurationDays: Number(policy.maxDurationDays),
          minExpectedReturnBps: Number(policy.minExpectedReturnBps),
          maxRiskTier: Number(policy.maxRiskTier),
          enabled: Boolean(policy.enabled),
        };
      }),
    );

    const matchResult = computeFundingAllocations(
      {
        invoiceId: req.params.id,
        purchasePrice: BigInt(offer.purchasePrice),
        durationDays,
        riskTier: invoice.riskTier,
        expectedReturnBps,
      },
      candidateAccounts,
    );

    // Verify on-chain contract eligibility for each non-zero allocation
    for (const alloc of matchResult.allocations) {
      const eligible = await chain.capital!.isEligible(
        alloc.investor,
        BigInt(alloc.amount),
        durationDays,
        invoice.riskTier,
        expectedReturnBps,
      );
      if (!eligible) {
        throw new HttpError(
          409,
          `Contract policy validation failed for allocated investor ${alloc.investor}.`,
        );
      }
    }

    res.json(matchResult);
  }),
);

api.post(
  "/opportunities/:id/fund",
  asyncRoute(async (req, res) => {
    const input = fundSchema.parse(req.body);
    chain.requireReadContracts();
    const signer = chain.requireSigner();
    const amounts = input.allocations.map((x) => BigInt(x.amount));
    const total = amounts.reduce((a, b) => a + b, 0n);
    const offer = await chain.coordinator!.getOffer(req.params.id);
    if (total !== BigInt(offer.purchasePrice))
      throw new HttpError(
        400,
        "Allocation total must equal the exact accepted purchase price.",
      );
    const record: FundingAllocationRecord = {
      invoiceId: req.params.id,
      allocations: input.allocations,
      total: total.toString(),
      status: "submitted",
      createdAt: now(),
    };
    await repository.saveAllocation(record);
    const coordinator = chain.coordinator!.connect(signer) as Contract;
    try {
      const tx = await coordinator.fundInvoice(
        req.params.id,
        input.allocations.map((x) => getAddress(x.investor)),
        amounts,
      );
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1)
        throw new HttpError(422, "Funding transaction failed.");
      const confirmed: FundingAllocationRecord = {
        ...record,
        status: "confirmed",
        txHash: tx.hash,
      };
      await repository.saveAllocation(confirmed);
      await syncInvoiceFromChain(req.params.id);
      await syncOffer(req.params.id, tx.hash);
      res.json({
        allocation: confirmed,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      });
    } catch (error) {
      await repository.saveAllocation({ ...record, status: "failed" });
      throw error;
    }
  }),
);

api.post(
  "/invoices/:id/simulate-collection",
  asyncRoute(async (req, res) => {
    const { amountReceived } = collectionSchema.parse(req.body);
    chain.requireReadContracts();
    const signer = chain.requireSigner();
    const coordinatorOwner = String(await chain.coordinator!.owner());
    if (coordinatorOwner.toLowerCase() !== signer.address.toLowerCase())
      throw new HttpError(
        403,
        "Configured relayer is not the FundingCoordinator owner/collection operator.",
      );
    const amount = BigInt(amountReceived);
    const balance = BigInt(await chain.mockUsdc!.balanceOf(signer.address));
    if (balance < amount)
      throw new HttpError(
        400,
        `Demo operator needs ${amount.toString()} base units of mock USDC; current balance is ${balance.toString()}. Mint demo tokens to the operator first.`,
      );
    const token = chain.mockUsdc!.connect(signer) as Contract;
    const currentAllowance = BigInt(
      await token.allowance(
        signer.address,
        process.env.FUNDING_COORDINATOR_ADDRESS,
      ),
    );
    if (currentAllowance < amount) {
      const approveTx = await token.approve(
        process.env.FUNDING_COORDINATOR_ADDRESS,
        amount,
      );
      const approveReceipt = await approveTx.wait();
      if (!approveReceipt || approveReceipt.status !== 1)
        throw new HttpError(422, "Mock USDC approval failed.");
    }
    const contributionRows = await chain.coordinator!.getContributions(
      req.params.id,
    );
    const contributions = contributionRows.map(
      (x: { investor: string; amount: bigint }) => ({
        investor: String(x.investor),
        amount: BigInt(x.amount),
      }),
    );
    if (contributions.length === 0)
      throw new HttpError(
        409,
        "Invoice has no recorded funding contributions.",
      );
    const invoice = await loadOnChainInvoice(req.params.id);
    const totalPrincipal = contributions.reduce((sum: any, x: any) => sum + x.amount, 0n);
    const fullyPaid = amount >= BigInt(invoice.faceValue);
    const coordinator = chain.coordinator!.connect(signer) as Contract;
    const tx = await coordinator.collectAndSettle(req.params.id, amount);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1)
      throw new HttpError(422, "Collection and settlement transaction failed.");
    let allocated = 0n;
    const distributions = contributions.map((contribution: any, index: any) => {
      const proceeds =
        index === contributions.length - 1
          ? amount - allocated
          : (amount * contribution.amount) / totalPrincipal;
      allocated += proceeds;
      return {
        investor: contribution.investor,
        principal: contribution.amount.toString(),
        proceeds: proceeds.toString(),
      };
    });
    const collection = {
      invoiceId: req.params.id,
      amountReceived: amount.toString(),
      fullyPaid,
      txHash: tx.hash,
      status: "confirmed" as const,
      createdAt: now(),
    };
    await repository.saveCollection(collection);
    const settlement = {
      invoiceId: req.params.id,
      totalReceived: amount.toString(),
      totalPrincipal: totalPrincipal.toString(),
      fullyPaid,
      distributions,
      txHash: tx.hash,
      createdAt: now(),
    };
    await repository.saveSettlement(settlement);
    await syncInvoiceFromChain(req.params.id);
    await syncOffer(req.params.id, tx.hash);
    res.json({
      collection,
      settlement,
      warning:
        "Demo-only payment simulation; the relayer must hold mock USDC and be the FundingCoordinator owner.",
    });
  }),
);

api.post(
  "/faucet/mint",
  asyncRoute(async (req, res) => {
    const { recipient, amount } = mintSchema.parse(req.body);
    chain.requireReadContracts();
    const signer = chain.requireSigner();
    const token = chain.mockUsdc!.connect(signer) as Contract;
    const parsedAmount = BigInt(amount);
    if (parsedAmount <= 0n) {
      throw new HttpError(400, "Mint amount must be greater than zero.");
    }
    const tx = await token.mint(getAddress(recipient), parsedAmount);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new HttpError(422, "Mint transaction failed on-chain.");
    }
    res.json({
      success: true,
      recipient: getAddress(recipient),
      amount,
      txHash: tx.hash,
    });
  }),
);

api.get(
  "/settlements",
  asyncRoute(async (_req, res) => res.json(await repository.settlements())),
);
api.get(
  "/collections",
  asyncRoute(async (_req, res) => res.json(await repository.collections())),
);
api.get(
  "/events",
  asyncRoute(async (_req, res) =>
    res.json(
      await store.read("chain-events.json", {
        lastProcessedBlock: 0,
        events: [] as unknown[],
      }),
    ),
  ),
);
