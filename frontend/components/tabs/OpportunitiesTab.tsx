import { FileText, LoaderCircle, RefreshCw, Zap } from 'lucide-react';
import { dateLabel, money } from '../../lib/api';
import type { Invoice, Offer, Tab } from '../../lib/types';
import { Button, Card, SectionTitle, StatusPill } from '../ui';

export function OpportunitiesTab({
  opportunities,
  offers,
  fundOpportunity,
  loadData,
  setTab,
  busy,
}: {
  opportunities: Invoice[];
  offers: Record<string, Offer>;
  fundOpportunity: (invoice: Invoice) => Promise<void>;
  loadData: () => Promise<void>;
  setTab: (t: Tab) => void;
  busy: string;
}) {
  return (
    <>
      <div className="opportunity-intro">
        <div className="opportunity-intro-icon">
          <Zap size={22} />
        </div>
        <div>
          <h3>Policy-matched receivables</h3>
          <p>
            Only assigned invoices with an accepted, unfunded offer can be matched. Funding is
            revalidated by the contract.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()}>
          <RefreshCw size={15} /> Refresh opportunities
        </Button>
      </div>

      <Card className="table-card">
        <SectionTitle
          title="Available to fund"
          description={`${opportunities.length} assignment-complete opportunity${
            opportunities.length === 1 ? '' : 'ies'
          }`}
        />
        <div className="opportunity-grid">
          {opportunities.length ? (
            opportunities.map((invoice) => {
              const offer = offers[invoice.chainInvoiceId];
              return (
                <div className="opportunity-card" key={invoice.chainInvoiceId}>
                  <div className="opportunity-card-top">
                    <span className="opportunity-type">
                      <FileText size={14} /> VERIFIED RECEIVABLE
                    </span>
                    <StatusPill status={invoice.status} />
                  </div>
                  <h3>Invoice #{invoice.chainInvoiceId}</h3>
                  <p className="debtor-name">{invoice.debtorReference}</p>
                  <div className="opportunity-amount">
                    {money(invoice.faceValue)}
                    <span>face value</span>
                  </div>
                  <div className="opportunity-details">
                    <div>
                      <span>Purchase offer</span>
                      <strong>{offer ? money(offer.purchasePrice) : 'Quote needed'}</strong>
                    </div>
                    <div>
                      <span>Risk tier</span>
                      <strong>{invoice.riskTier ? `Tier ${invoice.riskTier}` : '—'}</strong>
                    </div>
                    <div>
                      <span>Due date</span>
                      <strong>{dateLabel(invoice.dueDate)}</strong>
                    </div>
                    <div>
                      <span>Offer accepted</span>
                      <strong>{offer?.accepted ? 'Yes' : 'No'}</strong>
                    </div>
                  </div>
                  {offer?.accepted && !offer.funded ? (
                    <Button
                      disabled={busy === `fund-${invoice.chainInvoiceId}`}
                      onClick={() => void fundOpportunity(invoice)}
                    >
                      {busy === `fund-${invoice.chainInvoiceId}` ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <Zap size={15} />
                      )}
                      Match & fund
                    </Button>
                  ) : (
                    <div className="opportunity-note">
                      {!offer
                        ? 'An operator must create a quote.'
                        : !offer.accepted
                        ? 'Waiting for supplier offer acceptance.'
                        : 'This opportunity has already been funded.'}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="empty-state wide">
              <div className="empty-icon">
                <Zap size={22} />
              </div>
              <strong>No funding-ready opportunities</strong>
              <p>
                Verify an invoice, record its assignment gate, create a quote, and have the supplier
                accept it to publish an opportunity.
              </p>
              <Button variant="outline" onClick={() => setTab('Operations')}>
                Go to operations
              </Button>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
