import { z } from 'zod';

export const invoiceMetadataSchema = z.object({
  chainInvoiceId: z.string().regex(/^\d+$/),
  supplier: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  invoiceKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  debtorReference: z.string().min(1).max(160),
  faceValue: z.string().regex(/^\d+$/),
  dueDate: z.number().int().positive(),
  evidenceHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  evidencePath: z.string().max(500).optional(),
  submitTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export const reviewSchema = z.object({ approved: z.boolean(), riskTier: z.number().int().min(1).max(4).default(1) });
export const assignmentSchema = z.object({ assignmentEvidenceHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });
export const quoteSchema = z.object({ validForSeconds: z.number().int().min(60).max(604800).default(86400) });
export const investorRegisterSchema = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), label: z.string().max(80).optional() });
export const fundSchema = z.object({ allocations: z.array(z.object({ investor: z.string().regex(/^0x[0-9a-fA-F]{40}$/), amount: z.string().regex(/^\d+$/) })).min(1).max(50) });
export const collectionSchema = z.object({ amountReceived: z.string().regex(/^\d+$/) });
export const mintSchema = z.object({
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.string().regex(/^\d+$/),
});
