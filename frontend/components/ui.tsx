import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function SectionTitle({
  title,
  description,
  right,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {right}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: (e?: any) => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger-ghost' | 'wallet-connected';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`button ${variant}`}>
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status?: string }) {
  const s = (status || 'Unknown').toLowerCase();
  const cls = ['settled', 'verified', 'assigned', 'funded', 'confirmed'].includes(s)
    ? 'good'
    : ['rejected', 'defaulted', 'failed', 'disputed'].includes(s)
    ? 'bad'
    : ['overdue', 'collecting', 'funding', 'submitted', 'underreview'].includes(s)
    ? 'warm'
    : 'neutral';
  return (
    <span className={`status ${cls}`}>
      <span className="status-dot" />
      {status || 'Unknown'}
    </span>
  );
}
