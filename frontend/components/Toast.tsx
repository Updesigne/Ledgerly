import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, ExternalLink, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  txHash?: string | null;
}

const ARBITRUM_SEPOLIA_EXPLORER = 'https://sepolia.arbiscan.io/tx/';

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="toast-floating-container">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    // Auto dismiss after 6 seconds
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`floating-toast ${toast.type}`}>
      <div className="toast-icon">
        {toast.type === 'success' ? (
          <CheckCircle2 size={18} />
        ) : toast.type === 'error' ? (
          <XCircle size={18} />
        ) : (
          <Info size={18} />
        )}
      </div>

      <div className="toast-content">
        <span className="toast-message">{toast.message}</span>
        {toast.txHash && (
          <a
            href={`${ARBITRUM_SEPOLIA_EXPLORER}${toast.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="toast-tx-link"
          >
            <span>View Tx: {toast.txHash.slice(0, 6)}...{toast.txHash.slice(-4)}</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      <button className="toast-close-btn" onClick={onDismiss} aria-label="Dismiss toast">
        <X size={15} />
      </button>
    </div>
  );
}

