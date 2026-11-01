export type InvoiceStatus =
  | 'Draft' | 'Submitted' | 'Verified' | 'Assigned' | 'Funding' | 'Funded'
  | 'Collecting' | 'Settled' | 'Rejected' | 'Disputed' | 'Overdue' | 'Defaulted' | 'Cancelled';

export interface InvoiceRecord {
  id: string;
  chainInvoiceId: string;
  supplier: string;
  invoiceKey: string;
  debtorReference: string;
  faceValue: string;
  currency: 'USDC';
  dueDate: number;
  evidenceHash: string;
  evidencePath?: string;
  status: InvoiceStatus;
  riskTier?: number;
  assignmentEvidenceHash?: string;
  submitTxHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferRecord {
  invoiceId: string;
  chainInvoiceId: string;
  purchasePrice: string;
  discountBps: number;
  baseDiscountBps: number;
  riskAdjustmentBps: number;
  expiry: number;
  accepted: boolean;
  funded: boolean;
  txHash?: string;
  updatedAt: string;
}

export interface InvestorRecord {
  address: string;
  label?: string;
  registeredAt: string;
}

export interface FundingAllocationRecord {
  invoiceId: string;
  allocations: Array<{ investor: string; amount: string }>;
  total: string;
  txHash?: string;
  status: 'preview' | 'submitted' | 'confirmed' | 'failed';
  createdAt: string;
}

export interface CollectionRecord {
  invoiceId: string;
  amountReceived: string;
  fullyPaid: boolean;
  txHash?: string;
  status: 'simulated' | 'submitted' | 'confirmed' | 'failed';
  createdAt: string;
}

export interface SettlementRecord {
  invoiceId: string;
  totalReceived: string;
  totalPrincipal: string;
  fullyPaid: boolean;
  distributions: Array<{ investor: string; principal: string; proceeds: string }>;
  txHash: string;
  createdAt: string;
}
