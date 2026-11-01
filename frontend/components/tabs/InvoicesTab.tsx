import type { FormEvent } from 'react';
import {
  ArrowUpRight,
  Blocks,
  Check,
  FileCheck2,
  FilePlus2,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import type { Invoice } from '../../lib/types';
import { Button, Card, SectionTitle } from '../ui';

function Step({
  n,
  title,
  text,
  done = false,
}: {
  n: string;
  title: string;
  text: string;
  done?: boolean;
}) {
  return (
    <div className="step-row">
      <div className={`step-number ${done ? 'done' : ''}`}>{done ? <Check size={14} /> : n}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

export function InvoicesTab({
  invoiceForm,
  setInvoiceForm,
  submitInvoice,
  busy,
  walletAddress,
  invoices,
}: {
  invoiceForm: {
    invoiceNumber: string;
    debtorReference: string;
    faceValue: string;
    dueDate: string;
    file: File | null;
  };
  setInvoiceForm: (form: any) => void;
  submitInvoice: (e: FormEvent) => Promise<void>;
  busy: string;
  walletAddress: string;
  invoices: Invoice[];
}) {
  return (
    <div className="two-column-layout">
      <Card className="form-card">
        <SectionTitle
          title="Submit a receivable"
          description="Register an invoice on Arbitrum Sepolia."
        />
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submitInvoice(e);
          }}
        >
          <label>
            Invoice reference
            <input
              required
              value={invoiceForm.invoiceNumber}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
              placeholder="e.g. INV-2026-014"
            />
          </label>
          <label>
            Debtor reference
            <input
              required
              value={invoiceForm.debtorReference}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, debtorReference: e.target.value })}
              placeholder="e.g. acme-distribution"
            />
            <span className="field-hint">Use a reference, not private debtor information.</span>
          </label>
          <label>
            Invoice face value (USDC)
            <div className="input-prefix">
              <span>$</span>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={invoiceForm.faceValue}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, faceValue: e.target.value })}
              />
            </div>
          </label>
          <label>
            Contractual due date
            <input
              required
              type="date"
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
              value={invoiceForm.dueDate}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
            />
          </label>
          <label className="file-drop">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) =>
                setInvoiceForm({ ...invoiceForm, file: e.target.files?.[0] || null })
              }
            />
            <div className="file-drop-icon">
              <FilePlus2 size={20} />
            </div>
            <strong>{invoiceForm.file ? invoiceForm.file.name : 'Attach invoice evidence'}</strong>
            <span>
              {invoiceForm.file
                ? 'File hash will be recorded on-chain'
                : 'PDF or image · File remains off-chain in this MVP'}
            </span>
          </label>
          <div className="notice-inline">
            <ShieldCheck size={17} />
            <span>
              The invoice document itself is not uploaded to a storage server by this demo form. Its
              hash is recorded on-chain for evidence matching.
            </span>
          </div>
          <Button type="submit" disabled={busy === 'submit-invoice'}>
            {busy === 'submit-invoice' ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Blocks size={16} />
            )}
            Submit on-chain <ArrowUpRight size={15} />
          </Button>
        </form>
      </Card>

      <div className="stack-column">
        <Card>
          <SectionTitle title="How it works" description="From evidence to funded receivable" />
          <div className="step-list">
            <Step
              n="01"
              title="Submit invoice"
              text="Register invoice identity, value, due date, and evidence hash."
              done={false}
            />
            <Step
              n="02"
              title="Verify debtor & invoice"
              text="An authorized reviewer checks evidence and assigns a risk tier."
            />
            <Step
              n="03"
              title="Record assignment"
              text="Complete the demo assignment gate before publishing the opportunity."
            />
            <Step
              n="04"
              title="Price & fund"
              text="Generate a quote and match compliant investor capital."
            />
          </div>
        </Card>
        <Card className="mini-stat-card">
          <div className="mini-stat-top">
            <div className="metric-icon lilac">
              <FileCheck2 size={17} />
            </div>
            <span>MY SUBMISSIONS</span>
          </div>
          <strong>
            {walletAddress
              ? invoices.filter((x) => x.supplier.toLowerCase() === walletAddress.toLowerCase())
                  .length
              : '—'}
          </strong>
          <p>
            {walletAddress
              ? 'Invoices submitted by connected wallet'
              : 'Connect your supplier wallet to view submissions'}
          </p>
        </Card>
      </div>
    </div>
  );
}
