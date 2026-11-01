import { useState } from 'react';
import { ExternalLink, History, X, CheckCircle, Clock } from 'lucide-react';

export interface TransactionRecord {
  id: string;
  txHash: string;
  title: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
}

const ARBITRUM_SEPOLIA_EXPLORER = 'https://sepolia.arbiscan.io/tx/';

export function TransactionHistoryModal({
  isOpen,
  onClose,
  transactions,
  onClear,
}: {
  isOpen: boolean;
  onClose: () => void;
  transactions: TransactionRecord[];
  onClear: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <History size={18} />
            </div>
            <div>
              <h3>Recent Transactions</h3>
              <p>Arbitrum Sepolia Testnet Activity</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {transactions.length === 0 ? (
            <div className="empty-tx-state">
              <History size={36} className="empty-tx-icon" />
              <strong>No transactions yet</strong>
              <p>Transactions submitted through this session will appear here with direct links to Arbiscan.</p>
            </div>
          ) : (
            <div className="tx-list">
              {transactions.map((tx) => (
                <div key={tx.id} className="tx-item">
                  <div className="tx-item-left">
                    <div className="tx-status-icon">
                      {tx.status === 'confirmed' ? (
                        <CheckCircle size={15} className="text-emerald" />
                      ) : (
                        <Clock size={15} className="text-amber" />
                      )}
                    </div>
                    <div className="tx-details">
                      <strong>{tx.title}</strong>
                      <span className="tx-time">{tx.timestamp}</span>
                    </div>
                  </div>
                  <a
                    href={`${ARBITRUM_SEPOLIA_EXPLORER}${tx.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-hash-link"
                    title="View on Arbiscan"
                  >
                    <span>
                      {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                    </span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {transactions.length > 0 && (
          <div className="modal-footer">
            <button className="text-action danger" onClick={onClear}>
              Clear History
            </button>
            <span className="network-tag">Arbitrum Sepolia</span>
          </div>
        )}
      </div>
    </div>
  );
}

