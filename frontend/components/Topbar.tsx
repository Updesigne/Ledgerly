import { History, LoaderCircle, Menu, Wallet } from 'lucide-react';
import { shortAddress } from '../lib/api';
import type { Tab } from '../lib/types';
import { Button } from './ui';

export function Topbar({
  tab,
  setMobileNav,
  chainHealth,
  wallet,
  busy,
  walletAddress,
  txCount = 0,
  onOpenTxHistory,
}: {
  tab: Tab;
  setMobileNav: (open: boolean) => void;
  chainHealth: any;
  wallet: () => Promise<void>;
  busy: string;
  walletAddress: string;
  txCount?: number;
  onOpenTxHistory?: () => void;
}) {
  const isChainOffline =
    chainHealth?.chain?.rpcReachable === false || chainHealth?.chain?.configured === false;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="mobile-menu icon-button"
          onClick={() => setMobileNav(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="breadcrumb">
          Workspace <span>/</span> <strong>{tab}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        {onOpenTxHistory && (
          <button
            className="topbar-tx-btn"
            onClick={onOpenTxHistory}
            title="View recent transactions"
          >
            <History size={16} />
            <span>Activity</span>
            {txCount > 0 && <span className="topbar-tx-badge">{txCount}</span>}
          </button>
        )}
        <div className={`connection-chip ${isChainOffline ? 'offline' : ''}`}>
          <span className="connection-dot" />
          {chainHealth?.chain?.configured ? 'Arbitrum Sepolia' : 'Arbitrum Sepolia (Offline)'}
        </div>
        <Button
          onClick={wallet}
          disabled={busy === 'wallet'}
          variant={walletAddress ? 'wallet-connected' : 'outline'}
        >
          {busy === 'wallet' ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Wallet size={16} />
          )}
          {walletAddress ? shortAddress(walletAddress) : 'Connect wallet'}
        </Button>
      </div>
    </header>
  );
}
