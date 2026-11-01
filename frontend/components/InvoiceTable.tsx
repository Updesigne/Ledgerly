import { ArrowUpRight, FileText } from 'lucide-react';
import { dateLabel, money } from '../lib/api';
import type { Invoice, Offer } from '../lib/types';
import { StatusPill } from './ui';

export function InvoiceTable({
  invoices,
  offers,
  onAccept,
  busy,
}: {
  invoices: Invoice[];
  offers: Record<string, Offer>;
  onAccept: (invoice: Invoice) => void;
  busy: string;
}) {
  if (!invoices.length) {
    return (
      <div className="empty-state table-empty">
        <div className="empty-icon">
          <FileText size={22} />
        </div>
        <strong>Your receivables will appear here</strong>
        <p>Submit an invoice to begin the lifecycle.</p>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>RECEIVABLE</th>
            <th>FACE VALUE</th>
            <th>DUE DATE</th>
            <th>STATUS</th>
            <th>OFFER / ACTION</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const offer = offers[invoice.chainInvoiceId];
            return (
              <tr key={invoice.chainInvoiceId}>
                <td>
                  <div className="table-invoice">
                    <div className="table-file-icon">
                      <FileText size={16} />
                    </div>
                    <div>
                      <strong>Invoice #{invoice.chainInvoiceId}</strong>
                      <span>{invoice.debtorReference}</span>
                    </div>
                  </div>
                </td>
                <td className="numeric-cell">{money(invoice.faceValue)}</td>
                <td>{dateLabel(invoice.dueDate)}</td>
                <td>
                  <StatusPill status={invoice.status} />
                </td>
                <td>
                  {offer ? (
                    <div className="offer-cell">
                      <strong>{money(offer.purchasePrice)}</strong>
                      {offer.accepted ? (
                        <span className="muted-copy small">Accepted</span>
                      ) : (
                        <button
                          className="text-action"
                          disabled={busy === `accept-${invoice.chainInvoiceId}`}
                          onClick={() => void onAccept(invoice)}
                        >
                          Accept offer <ArrowUpRight size={13} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="muted-copy">Not priced</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
