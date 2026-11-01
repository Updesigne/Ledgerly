import { Blocks, ChevronRight, History, LogOut, XCircle } from 'lucide-react';
import type { Tab } from '../lib/types';

export const tabsConfig: { name: Tab; icon: any; subtitle: string }[] = [
  { name: 'Overview', icon: 'LayoutDashboard', subtitle: 'Marketplace overview' },
  { name: 'Invoices', icon: 'FileText', subtitle: 'Submit and track receivables' },
  { name: 'Capital accounts', icon: 'Wallet', subtitle: 'Policies and capital' },
  { name: 'Opportunities', icon: 'Zap', subtitle: 'Match capital to invoices' },
  { name: 'Operations', icon: 'ShieldCheck', subtitle: 'Verification and settlement' },
];

export function Sidebar({
  tab,
  setTab,
  mobileNav,
  setMobileNav,
  tabs,
  txCount = 0,
  onOpenTxHistory,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  tabs: { name: Tab; icon: any; subtitle: string }[];
  txCount?: number;
  onOpenTxHistory: () => void;
}) {
  return (
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="brand">
        <div>
          <div className="brand-name">
            ledgerly<span>.</span>
          </div>
          <div className="brand-caption">RECEIVABLES NETWORK</div>
        </div>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobileNav(false)}
          aria-label="Close menu"
        >
          <XCircle size={18} />
        </button>
      </div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">
        {tabs.map(({ name, icon: Icon, subtitle }) => (
          <button
            key={name}
            className={`nav-item ${tab === name ? 'active' : ''}`}
            onClick={() => {
              setTab(name);
              setMobileNav(false);
            }}
            title={subtitle}
          >
            <Icon size={18} />
            <span>{name}</span>
            {tab === name && <ChevronRight size={15} className="nav-chevron" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className="tx-history-trigger-btn"
          onClick={onOpenTxHistory}
          title="Open Recent Transactions"
        >
          <div className="tx-trigger-left">
            <History size={16} />
            <span>Recent Activity</span>
          </div>
          {txCount > 0 && <span className="tx-badge">{txCount}</span>}
        </button>

        <div className="network-card">
          <div className="network-top">
            <span className="network-dot" /> TESTNET ENVIRONMENT
          </div>
          <div className="network-name">Arbitrum Sepolia</div>
          <div className="network-meta">Mock USDC · Local JSON state</div>
        </div>
        <div className="sidebar-footer">
          <div className="avatar">LN</div>
          <div className="profile">
            <strong>Demo workspace</strong>
            <span>Hackathon MVP</span>
          </div>
          <button className="icon-button" onClick={() => setTab('Operations')} title="Operations">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
