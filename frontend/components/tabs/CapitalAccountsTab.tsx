import { useState, type FormEvent } from 'react';
import { Coins, LoaderCircle, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { money, shortAddress } from '../../lib/api';
import type { Investor } from '../../lib/types';
import { Button, Card, SectionTitle, StatusPill } from '../ui';

function Balance({ label, value }: { label: string; value?: string }) {
  return (
    <div className="balance-cell">
      <span>{label}</span>
      <strong>{value ? money(value) : '$0.00'}</strong>
    </div>
  );
}

export function CapitalAccountsTab({
  walletAddress,
  policyForm,
  setPolicyForm,
  savePolicyAndDeposit,
  mintMockUsdc,
  busy,
  wallet,
  currentInvestor,
  investors,
}: {
  walletAddress: string;
  policyForm: {
    enabled: boolean;
    maxDurationDays: string;
    minReturnPct: string;
    maxRiskTier: string;
    maxPerInvoice: string;
    deposit: string;
  };
  setPolicyForm: (form: any) => void;
  savePolicyAndDeposit: (e: FormEvent) => Promise<void>;
  mintMockUsdc: (amount: string) => Promise<void>;
  busy: string;
  wallet: () => Promise<void>;
  currentInvestor?: Investor;
  investors: Investor[];
}) {
  const [mintAmount, setMintAmount] = useState('5000');
  return (
    <div className="two-column-layout">
      <Card className="form-card">
        <SectionTitle
          title="Capital account setup"
          description="Configure your mandate and deposit mock USDC."
        />
        {!walletAddress && (
          <div className="empty-inline">
            <Wallet size={18} /> Connect a wallet to configure an account.
          </div>
        )}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void savePolicyAndDeposit(e);
          }}
        >
          <div className="form-label-row">
            <label className="toggle-label">
              <span>
                <strong>Enable policy</strong>
                <small>Allow matching against eligible receivables</small>
              </span>
              <input
                type="checkbox"
                checked={policyForm.enabled}
                onChange={(e) => setPolicyForm({ ...policyForm, enabled: e.target.checked })}
              />
            </label>
          </div>
          <div className="field-grid">
            <label>
              Maximum duration (days)
              <input
                required
                min="1"
                max="365"
                type="number"
                value={policyForm.maxDurationDays}
                onChange={(e) => setPolicyForm({ ...policyForm, maxDurationDays: e.target.value })}
              />
            </label>
            <label>
              Minimum net return (%)
              <input
                required
                min="0"
                max="100"
                step="0.1"
                type="number"
                value={policyForm.minReturnPct}
                onChange={(e) => setPolicyForm({ ...policyForm, minReturnPct: e.target.value })}
              />
            </label>
            <label>
              Maximum risk tier
              <select
                value={policyForm.maxRiskTier}
                onChange={(e) => setPolicyForm({ ...policyForm, maxRiskTier: e.target.value })}
              >
                <option value="1">Tier 1 · Lowest</option>
                <option value="2">Tier 2 · Low</option>
                <option value="3">Tier 3 · Elevated</option>
                <option value="4">Tier 4 · Highest</option>
              </select>
            </label>
            <label>
              Max per invoice (USDC)
              <input
                required
                min="0.01"
                type="number"
                step="0.01"
                value={policyForm.maxPerInvoice}
                onChange={(e) => setPolicyForm({ ...policyForm, maxPerInvoice: e.target.value })}
              />
            </label>
          </div>
          <label>
            Deposit amount (mock USDC)
            <div className="input-prefix">
              <span>$</span>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={policyForm.deposit}
                onChange={(e) => setPolicyForm({ ...policyForm, deposit: e.target.value })}
              />
            </div>
            <span className="field-hint">
              Your wallet needs mock USDC. Use the testnet faucet or owner-controlled demo mint
              before depositing.
            </span>
          </label>
          <Button type="submit" disabled={busy === 'save-policy' || !walletAddress}>
            {busy === 'save-policy' ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <ShieldCheck size={16} />
            )}
            Save policy & deposit
          </Button>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f1f6' }}>
          <SectionTitle
            title="Mint mock USDC"
            description="Faucet to mint testnet mUSDC to your connected wallet"
          />
          <div style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
            <label style={{ display: 'grid', gap: '6px', fontSize: '11px', fontWeight: 600 }}>
              Mint amount (mock USDC)
              <div className="input-prefix">
                <span>$</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  placeholder="5000"
                />
              </div>
              <span className="field-hint">
                Directly mints ERC-20 test tokens for deploying capital into invoices on Arbitrum Sepolia.
              </span>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy === 'mint-usdc' || !walletAddress || !mintAmount || Number(mintAmount) <= 0}
              onClick={() => void mintMockUsdc(mintAmount)}
            >
              {busy === 'mint-usdc' ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Coins size={16} />
              )}
              Mint {mintAmount ? `$${Number(mintAmount).toLocaleString()}` : ''} mock USDC
            </Button>
          </div>
        </div>
      </Card>

      <div className="stack-column">
        <Card>
          <SectionTitle title="Connected account" description="Wallet-linked capital position" />
          {walletAddress ? (
            <>
              <div className="account-address">
                <div className="avatar large">{walletAddress.slice(2, 4).toUpperCase()}</div>
                <div>
                  <strong>{shortAddress(walletAddress)}</strong>
                  <span>{currentInvestor?.label || 'Connected wallet'}</span>
                </div>
                <StatusPill status={currentInvestor?.policy?.enabled ? 'Enabled' : 'Unregistered'} />
              </div>
              <div className="balance-grid">
                <Balance label="Available" value={currentInvestor?.balance?.available} />
                <Balance label="Reserved" value={currentInvestor?.balance?.reserved} />
                <Balance label="Deployed" value={currentInvestor?.balance?.deployed} />
              </div>
              <div className="policy-summary">
                <div>
                  <span>Policy status</span>
                  <strong>
                    {currentInvestor?.policy?.enabled ? 'Enabled' : 'Not registered'}
                  </strong>
                </div>
                <div>
                  <span>Max duration</span>
                  <strong>{currentInvestor?.policy?.maxDurationDays ?? '—'} days</strong>
                </div>
                <div>
                  <span>Risk ceiling</span>
                  <strong>
                    {currentInvestor?.policy?.maxRiskTier
                      ? `Tier ${currentInvestor.policy.maxRiskTier}`
                      : '—'}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Wallet size={22} />
              </div>
              <strong>No wallet connected</strong>
              <p>Connect your EVM wallet to inspect its capital account.</p>
              <Button onClick={wallet}>Connect wallet</Button>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Investor accounts"
            description="Registered accounts available to the matching engine"
          />
          <div className="investor-list">
            {investors.length ? (
              investors.slice(0, 6).map((item) => (
                <div className="investor-row" key={item.address}>
                  <div className="avatar">
                    {(item.label || item.address).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="investor-details">
                    <strong>{item.label || shortAddress(item.address)}</strong>
                    <span>{shortAddress(item.address)}</span>
                  </div>
                  <div className="investor-value">
                    <strong>{money(item.balance?.available || '0')}</strong>
                    <span>available</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted-copy">No investor accounts registered yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
