import {
  ArrowDownToLine,
  ArrowLeftRight,
  Banknote,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Search,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react';
import { dateLabel, money, shortAddress } from '../../lib/api';
import type { Invoice, Offer } from '../../lib/types';
import { Button, Card, SectionTitle, StatusPill } from '../ui';

export function OperationsTab({
  search,
  setSearch,
  visibleInvoices,
  offers,
  riskTier,
  setRiskTier,
  busy,
  reviewInvoice,
  recordAssignment,
  createQuote,
  collectionAmount,
  setCollectionAmount,
  simulateCollection,
  collections,
  settlements,
}: {
  search: string;
  setSearch: (s: string) => void;
  visibleInvoices: Invoice[];
  offers: Record<string, Offer>;
  riskTier: Record<string, string>;
  setRiskTier: (r: any) => void;
  busy: string;
  reviewInvoice: (invoice: Invoice, approved: boolean) => Promise<void>;
  recordAssignment: (invoice: Invoice) => Promise<void>;
  createQuote: (invoice: Invoice) => Promise<void>;
  collectionAmount: Record<string, string>;
  setCollectionAmount: (c: any) => void;
  simulateCollection: (invoice: Invoice) => Promise<void>;
  collections: any[];
  settlements: any[];
}) {
  return (
    <>
      <div className="ops-banner">
        <div className="ops-banner-icon">
          <ShieldCheck size={22} />
        </div>
        <div>
          <strong>Verification and collection controls</strong>
          <p>
            These actions use the configured backend relayer. Only use a throwaway testnet wallet;
            verification and collection are simulated for this MVP.
          </p>
        </div>
      </div>

      <Card className="table-card">
        <SectionTitle
          title="Invoice operations"
          description="Review, assign, price, and settle receivables"
          right={
            <div className="search-box">
              <Search size={15} />
              <input
                placeholder="Search invoices…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          }
        />
        <div className="ops-invoice-list">
          {visibleInvoices.length ? (
            visibleInvoices.map((invoice) => {
              const offer = offers[invoice.chainInvoiceId];
              return (
                <div className="ops-invoice-row" key={invoice.chainInvoiceId}>
                  <div className="ops-invoice-main">
                    <div className="invoice-file-icon">
                      <FileText size={18} />
                    </div>
                    <div className="ops-invoice-info">
                      <strong>
                        Invoice #{invoice.chainInvoiceId}{' '}
                        <span className="muted-inline">· {invoice.debtorReference}</span>
                      </strong>
                      <span>
                        {money(invoice.faceValue)} · Due {dateLabel(invoice.dueDate)} · Supplier{' '}
                        {shortAddress(invoice.supplier)}
                      </span>
                      <div className="ops-pills">
                        <StatusPill status={invoice.status} />
                        {invoice.riskTier ? (
                          <span className="soft-tag">Risk tier {invoice.riskTier}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="ops-actions">
                    {invoice.status === 'Submitted' && (
                      <>
                        <Button
                          disabled={busy === `review-${invoice.chainInvoiceId}`}
                          onClick={() => void reviewInvoice(invoice, true)}
                        >
                          <Zap size={14} /> Auto-Verify via CRE
                        </Button>
                        <Button
                          variant="danger-ghost"
                          disabled={busy === `review-${invoice.chainInvoiceId}`}
                          onClick={() => void reviewInvoice(invoice, false)}
                        >
                          <XCircle size={14} /> Reject
                        </Button>
                      </>
                    )}
                    {invoice.status === 'Verified' && (
                      <Button
                        disabled={busy === `assign-${invoice.chainInvoiceId}`}
                        onClick={() => void recordAssignment(invoice)}
                      >
                        <FileCheck2 size={14} /> Record assignment
                      </Button>
                    )}
                    {invoice.status === 'Assigned' && !offer && (
                      <Button
                        disabled={busy === `quote-${invoice.chainInvoiceId}`}
                        onClick={() => void createQuote(invoice)}
                      >
                        <CircleDollarSign size={14} /> Create quote
                      </Button>
                    )}
                    {invoice.status === 'Assigned' && offer && !offer.accepted && (
                      <span className="muted-copy small">Offer awaiting supplier</span>
                    )}
                    {invoice.status === 'Funded' && (
                      <div className="collection-inline">
                        <input
                          aria-label="Collection amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={
                            collectionAmount[invoice.chainInvoiceId] ??
                            (Number(invoice.faceValue) / 1_000_000).toString()
                          }
                          onChange={(e) =>
                            setCollectionAmount({
                              ...collectionAmount,
                              [invoice.chainInvoiceId]: e.target.value,
                            })
                          }
                        />
                        <Button
                          disabled={busy === `collect-${invoice.chainInvoiceId}`}
                          onClick={() => void simulateCollection(invoice)}
                        >
                          <Banknote size={14} /> Simulate collection
                        </Button>
                      </div>
                    )}
                    {invoice.status === 'Settled' && (
                      <span className="action-complete">
                        <CheckCircle2 size={15} /> Settled
                      </span>
                    )}
                    {invoice.status === 'Defaulted' && (
                      <span className="action-default">
                        <XCircle size={15} /> Shortfall recorded
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <strong>No invoices found</strong>
              <p>Submit an invoice to begin the lifecycle.</p>
            </div>
          )}
        </div>
      </Card>

      <div className="two-column-layout ops-bottom">
        <Card className="ops-card-padded">
          <SectionTitle title="Recent collections" description="Demo collection attestations" />
          {collections.length ? (
            <div className="simple-list">
              {collections
                .slice()
                .reverse()
                .slice(0, 5)
                .map((c: any, i: number) => (
                  <div className="simple-row" key={c.invoiceId + i}>
                    <div className="simple-row-icon green">
                      <ArrowDownToLine size={16} />
                    </div>
                    <div>
                      <strong>Invoice #{c.invoiceId}</strong>
                      <span>{dateLabel(c.createdAt)}</span>
                    </div>
                    <div className="simple-row-value">
                      <strong>{money(c.amountReceived)}</strong>
                      <StatusPill status={c.status} />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="muted-copy">No collections recorded yet.</p>
          )}
        </Card>

        <Card className="ops-card-padded">
          <SectionTitle
            title="Settlement history"
            description="Investor proceeds and shortfalls"
          />
          {settlements.length ? (
            <div className="simple-list">
              {settlements
                .slice()
                .reverse()
                .slice(0, 5)
                .map((s: any, i: number) => (
                  <div className="simple-row" key={s.invoiceId + i}>
                    <div className={`simple-row-icon ${s.fullyPaid ? 'green' : 'red'}`}>
                      <ArrowLeftRight size={16} />
                    </div>
                    <div>
                      <strong>Invoice #{s.invoiceId}</strong>
                      <span>{s.fullyPaid ? 'Full collection' : 'Partial / default'}</span>
                    </div>
                    <div className="simple-row-value">
                      <strong>{money(s.totalReceived)}</strong>
                      <StatusPill status={s.fullyPaid ? 'Settled' : 'Defaulted'} />
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="muted-copy">No settlement records yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
