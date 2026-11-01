import {
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  FilePlus2,
  FileText,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import type { Dashboard, Invoice, Investor, Offer, Tab } from '../../lib/types';
import { InvoiceTable } from '../InvoiceTable';
import { Button, Card, SectionTitle } from '../ui';

export function OverviewTab({
  count,
  invoices,
  investors,
  opportunities,
  settlements,
  dashboard,
  collections,
  chainHealth,
  offers,
  acceptOffer,
  busy,
  setTab,
}: {
  count: Record<string, number>;
  invoices: Invoice[];
  investors: Investor[];
  opportunities: Invoice[];
  settlements: any[];
  dashboard: Dashboard;
  collections: any[];
  chainHealth: any;
  offers: Record<string, Offer>;
  acceptOffer: (invoice: Invoice) => Promise<void>;
  busy: string;
  setTab: (tab: Tab) => void;
}) {
  return (
    <>
      <div className="metric-grid">
        <Card className="metric-card">
          <div className="metric-top">
            <span>Total receivables</span>
            <div className="metric-icon lilac">
              <FileText size={17} />
            </div>
          </div>
          <div className="metric-value">{count.invoices ?? invoices.length}</div>
          <div className="metric-foot">
            <span className="metric-foot-neutral">Across all lifecycle stages</span>
          </div>
        </Card>
        <Card className="metric-card">
          <div className="metric-top">
            <span>Capital accounts</span>
            <div className="metric-icon blue">
              <Wallet size={17} />
            </div>
          </div>
          <div className="metric-value">{count.investors ?? investors.length}</div>
          <div className="metric-foot">
            <span className="metric-foot-neutral">Registered investors</span>
          </div>
        </Card>
        <Card className="metric-card">
          <div className="metric-top">
            <span>Funding opportunities</span>
            <div className="metric-icon amber">
              <Zap size={17} />
            </div>
          </div>
          <div className="metric-value">{opportunities.length}</div>
          <div className="metric-foot">
            <span className="metric-foot-neutral">Assignment-gated</span>
          </div>
        </Card>
        <Card className="metric-card">
          <div className="metric-top">
            <span>Settlements recorded</span>
            <div className="metric-icon green">
              <ArrowLeftRight size={17} />
            </div>
          </div>
          <div className="metric-value">{count.settlements ?? settlements.length}</div>
          <div className="metric-foot">
            <span className="metric-foot-neutral">Collection outcomes</span>
          </div>
        </Card>
      </div>

      <div className="overview-grid">
        <Card className="chart-card">
          <SectionTitle
            title="Receivables lifecycle"
            description="Current distribution across the workflow"
            right={<span className="soft-tag">LIVE SNAPSHOT</span>}
          />
          <div className="lifecycle-list">
            {['Submitted', 'Verified', 'Assigned', 'Funded', 'Settled', 'Defaulted'].map((status) => {
              const val = dashboard.invoicesByStatus?.[status] || 0;
              const total = Math.max(invoices.length, 1);
              const color =
                status === 'Settled'
                  ? 'var(--green)'
                  : status === 'Defaulted'
                  ? 'var(--red)'
                  : status === 'Funded'
                  ? 'var(--purple)'
                  : 'var(--blue)';
              return (
                <div className="lifecycle-row" key={status}>
                  <div className="lifecycle-label">
                    <span className="lifecycle-dot" style={{ background: color }} />
                    {status}
                  </div>
                  <div className="lifecycle-track">
                    <div
                      className="lifecycle-fill"
                      style={{
                        width: `${Math.max((val / total) * 100, val ? 5 : 0)}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <strong>{val}</strong>
                </div>
              );
            })}
          </div>
          <div className="chart-foot">
            <div>
              <span className="chart-foot-label">Collections tracked</span>
              <strong>{collections.length}</strong>
            </div>
            <div>
              <span className="chart-foot-label">Policy allocations</span>
              <strong>{count.allocations ?? 0}</strong>
            </div>
            <div>
              <span className="chart-foot-label">Network</span>
              <strong>
                {chainHealth?.chain?.blockNumber
                  ? `Block ${chainHealth.chain.blockNumber.toLocaleString()}`
                  : 'Not synced'}
              </strong>
            </div>
          </div>
        </Card>

        <Card className="quick-card">
          <SectionTitle title="Quick actions" description="Keep the workflow moving" />
          <button className="quick-action" onClick={() => setTab('Invoices')}>
            <div className="quick-icon purple">
              <FilePlus2 size={18} />
            </div>
            <div>
              <strong>Submit an invoice</strong>
              <span>Register a new receivable</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <button className="quick-action" onClick={() => setTab('Capital accounts')}>
            <div className="quick-icon blue">
              <Wallet size={18} />
            </div>
            <div>
              <strong>Configure capital</strong>
              <span>Set investor policy and deposit</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <button className="quick-action" onClick={() => setTab('Operations')}>
            <div className="quick-icon amber">
              <ShieldCheck size={18} />
            </div>
            <div>
              <strong>Review invoices</strong>
              <span>Verify and record assignment gates</span>
            </div>
            <ChevronRight size={16} />
          </button>
          <div className="principle-card">
            <div className="principle-symbol">
              <ShieldCheck size={17} />
            </div>
            <div>
              <strong>Policy before deployment</strong>
              <p>Investor eligibility is checked by the funding coordinator before capital is committed.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="table-card">
        <SectionTitle
          title="Recent invoices"
          description="Latest receivables registered in the marketplace"
          right={
            <Button variant="ghost" onClick={() => setTab('Invoices')}>
              View all <ArrowUpRight size={15} />
            </Button>
          }
        />
        <div className="recent-invoices-scrollable">
          <InvoiceTable
            invoices={invoices}
            offers={offers}
            onAccept={acceptOffer}
            busy={busy}
          />
        </div>
      </Card>
    </>
  );
}
