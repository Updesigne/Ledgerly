export type Invoice = {
  id?: string;
  chainInvoiceId: string;
  supplier: string;
  invoiceKey: string;
  debtorReference: string;
  faceValue: string;
  currency?: string;
  dueDate: number;
  evidenceHash: string;
  status: string;
  riskTier?: number;
  assignmentEvidenceHash?: string;
  submitTxHash?: string;
  createdAt?: string;
  fundingReady?: boolean;
};

export type Offer = {
  invoiceId?: string;
  chainInvoiceId: string;
  purchasePrice: string;
  discountBps: number;
  baseDiscountBps: number;
  riskAdjustmentBps: number;
  expiry: number;
  accepted: boolean;
  funded: boolean;
  txHash?: string;
};

export type Investor = {
  address: string;
  label?: string;
  balance?: {
    available: string;
    reserved: string;
    deployed: string;
  };
  policy?: {
    enabled: boolean;
    maxDurationDays: number;
    minExpectedReturnBps: number;
    maxRiskTier: number;
    maxPerInvoice: string;
  };
};

export type Dashboard = {
  counts?: Record<string, number>;
  invoicesByStatus?: Record<string, number>;
  latestInvoices?: Invoice[];
  latestSettlements?: any[];
};

export type Tab = 'Overview' | 'Invoices' | 'Capital accounts' | 'Opportunities' | 'Operations';
