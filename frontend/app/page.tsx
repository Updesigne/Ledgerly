'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  CheckCircle2,
  FileText,
  Gauge,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';

import { api, money, shortAddress, verifyInvoiceWithCre } from '../lib/api';
import {
  addresses,
  amountUnits,
  bytes32FromText,
  capitalAbi,
  connectWallet,
  contract,
  coordinatorAbi,
  getOptimizedFeeData,
  hashFile,
  hashText,
  registryAbi,
  usdcAbi,
} from '../lib/contracts';
import type { Dashboard, Invoice, Investor, Offer, Tab } from '../lib/types';

import { Button } from '../components/ui';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { InvoicesTab } from '../components/tabs/InvoicesTab';
import { CapitalAccountsTab } from '../components/tabs/CapitalAccountsTab';
import { OpportunitiesTab } from '../components/tabs/OpportunitiesTab';
import { OperationsTab } from '../components/tabs/OperationsTab';
import {
  TransactionHistoryModal,
  type TransactionRecord,
} from '../components/TransactionHistoryModal';
import { ToastContainer, type ToastItem } from '../components/Toast';

const tabs: { name: Tab; icon: any; subtitle: string }[] = [
  { name: 'Overview', icon: LayoutDashboard, subtitle: 'Marketplace overview' },
  { name: 'Invoices', icon: FileText, subtitle: 'Submit and track receivables' },
  { name: 'Capital accounts', icon: Wallet, subtitle: 'Policies and capital' },
  { name: 'Opportunities', icon: Zap, subtitle: 'Match capital to invoices' },
  { name: 'Operations', icon: ShieldCheck, subtitle: 'Verification and settlement' },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [walletAddress, setWalletAddress] = useState('');
  const [chainHealth, setChainHealth] = useState<any>(null);
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [opportunities, setOpportunities] = useState<Invoice[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [offers, setOffers] = useState<Record<string, Offer>>({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    debtorReference: '',
    faceValue: '10000',
    dueDate: '',
    file: null as File | null,
  });
  const [policyForm, setPolicyForm] = useState({
    enabled: true,
    maxDurationDays: '90',
    minReturnPct: '5',
    maxRiskTier: '2',
    maxPerInvoice: '10000',
    deposit: '5000',
  });
  const [riskTier, setRiskTier] = useState<Record<string, string>>({});
  const [collectionAmount, setCollectionAmount] = useState<Record<string, string>>({});
  const [txHistory, setTxHistory] = useState<TransactionRecord[]>([]);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [floatingToasts, setFloatingToasts] = useState<ToastItem[]>([]);

  // Load persistent transactions from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ledgerly_tx_history');
      if (saved) {
        setTxHistory(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const addTransaction = useCallback((txHash: string, title: string) => {
    if (!txHash) return;
    const newTx: TransactionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      txHash,
      title,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: 'confirmed',
    };
    setTxHistory((prev) => {
      const updated = [newTx, ...prev.filter((t) => t.txHash.toLowerCase() !== txHash.toLowerCase())].slice(0, 50);
      try {
        localStorage.setItem('ledgerly_tx_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const clearTransactions = useCallback(() => {
    setTxHistory([]);
    try {
      localStorage.removeItem('ledgerly_tx_history');
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [health, dash, inv, investorData, opps, settles, collects] = await Promise.all([
        api<any>('/health').catch(() => null),
        api<Dashboard>('/dashboard').catch(() => ({})),
        api<Invoice[]>('/invoices').catch(() => []),
        api<Investor[]>('/investors').catch(() => []),
        api<Invoice[]>('/opportunities').catch(() => []),
        api<any[]>('/settlements').catch(() => []),
        api<any[]>('/collections').catch(() => []),
      ]);
      setChainHealth(health);
      setDashboard(dash);
      setInvoices(inv);
      setInvestors(investorData);
      setOpportunities(opps);
      setSettlements(settles);
      setCollections(collects);
      const nextOffers: Record<string, Offer> = {};
      await Promise.all(
        inv.map(async (item) => {
          try {
            const detail = await api<{ offer: Offer | null }>(`/invoices/${item.chainInvoiceId}`);
            if (detail.offer) nextOffers[item.chainInvoiceId] = detail.offer;
          } catch {
            /* quote not yet created */
          }
        })
      );
      setOffers(nextOffers);
    } catch (e) {
      setChainHealth((old: any) => old || { ok: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => void loadData(), 20000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    const onAccounts = (accounts: string[]) => setWalletAddress(accounts?.[0] || '');
    ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => onAccounts(accounts))
      .catch(() => undefined);
    ethereum.on?.('accountsChanged', onAccounts);
    return () => ethereum.removeListener?.('accountsChanged', onAccounts);
  }, []);

  const toast = useCallback(
    (type: 'success' | 'error' | 'info', text: string, txHash?: string | null) => {
      // Set legacy inline notice
      setNotice({ type, text });

      // Add dynamic floating notification
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setFloatingToasts((prev) => [...prev, { id, type, message: text, txHash }]);

      // Record transaction if hash provided
      if (txHash) {
        addTransaction(txHash, text);
      }
    },
    [addTransaction]
  );

  const dismissToast = useCallback((id: string) => {
    setFloatingToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      toast('error', (e as Error).message || 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  const wallet = async () => {
    await run('wallet', async () => {
      const { address } = await connectWallet();
      setWalletAddress(address);
      toast('success', `Wallet connected: ${shortAddress(address)}`);
    });
  };

  const visibleInvoices = useMemo(
    () =>
      invoices.filter((x) =>
        `${x.chainInvoiceId} ${x.debtorReference} ${x.supplier} ${x.status}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [invoices, search]
  );

  const currentInvestor = investors.find(
    (x) => x.address.toLowerCase() === walletAddress.toLowerCase()
  );
  const activeTab = tabs.find((x) => x.name === tab) || tabs[0];
  const count = dashboard.counts || {};

  async function submitInvoice(e: FormEvent) {
    e.preventDefault();
    await run('submit-invoice', async () => {
      if (!walletAddress) throw new Error('Connect the supplier wallet first.');
      if (!invoiceForm.dueDate || new Date(invoiceForm.dueDate).getTime() <= Date.now())
        throw new Error('Choose a future invoice due date.');
      if (!invoiceForm.invoiceNumber.trim() || !invoiceForm.debtorReference.trim())
        throw new Error('Enter an invoice number and debtor reference.');
      const { provider, signer } = await connectWallet();
      const feeOverrides = await getOptimizedFeeData(provider);
      const registry = contract(addresses.registry, registryAbi, signer);
      const nextId = await registry.nextInvoiceId();
      const invoiceKey = hashText(`${invoiceForm.invoiceNumber.trim()}-${Date.now()}-${walletAddress}`);
      const debtorRef = bytes32FromText(invoiceForm.debtorReference);
      const evidenceHash = invoiceForm.file
        ? await hashFile(invoiceForm.file)
        : hashText(`demo-evidence-${invoiceForm.invoiceNumber}-${Date.now()}`);
      const faceValue = amountUnits(invoiceForm.faceValue);
      const dueDate = Math.floor(new Date(invoiceForm.dueDate).getTime() / 1000);
      if (faceValue <= 0n) throw new Error('Face value must be greater than zero.');
      const tx = await registry.submitInvoice(invoiceKey, debtorRef, evidenceHash, faceValue, dueDate, feeOverrides);
      toast('info', 'Invoice transaction submitted. Waiting for confirmation…');
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('Invoice transaction failed on-chain.');
      await api('/invoices/metadata', {
        method: 'POST',
        body: JSON.stringify({
          chainInvoiceId: nextId.toString(),
          supplier: walletAddress,
          invoiceKey,
          debtorReference: invoiceForm.debtorReference.trim(),
          faceValue: faceValue.toString(),
          dueDate,
          evidenceHash,
          submitTxHash: tx.hash,
          evidencePath: invoiceForm.file ? `browser-upload:${invoiceForm.file.name}` : 'demo-evidence',
        }),
      });
      setInvoiceForm({ invoiceNumber: '', debtorReference: '', faceValue: '10000', dueDate: '', file: null });
      toast('success', `Invoice #${nextId.toString()} registered on Arbitrum Sepolia!`, tx.hash);

      try {
        const creRes = await verifyInvoiceWithCre({
          chainInvoiceId: nextId.toString(),
          supplier: walletAddress,
          invoiceKey,
          debtorReference: invoiceForm.debtorReference.trim(),
          faceValue: faceValue.toString(),
          dueDate,
          evidenceHash,
        });

        if (creRes.approved) {
          toast(
            'success',
            `Chainlink CRE verified Invoice #${nextId.toString()} on Arbitrum Sepolia! Risk Tier: ${creRes.riskTier} (Credit Score: ${creRes.creditScore}).`,
            creRes.txHash
          );
        } else {
          toast('info', `Chainlink CRE evaluated Invoice #${nextId.toString()} as not approved.`);
        }
      } catch (err: any) {
        console.warn('Autonomous CRE verification warning:', err);
        toast('info', `Invoice #${nextId.toString()} submitted. CRE verification can be retried in Operations.`);
      }

      await loadData();
    });
  }

  async function savePolicyAndDeposit(e: FormEvent) {
    e.preventDefault();
    await run('save-policy', async () => {
      if (!walletAddress) throw new Error('Connect the investor wallet first.');
      const { provider, signer } = await connectWallet();
      const feeOverrides = await getOptimizedFeeData(provider);
      const capital = contract(addresses.capital, capitalAbi, signer);
      const usdc = contract(addresses.usdc, usdcAbi, signer);
      const maxPerInvoice = amountUnits(policyForm.maxPerInvoice);
      const minBps = Math.round(Number(policyForm.minReturnPct) * 100);
      if (!Number.isFinite(minBps) || minBps < 0 || minBps > 10000)
        throw new Error('Minimum return must be between 0% and 100%.');
      const policyTx = await capital.setPolicy(
        policyForm.enabled,
        Number(policyForm.maxDurationDays),
        minBps,
        Number(policyForm.maxRiskTier),
        maxPerInvoice,
        feeOverrides
      );
      await policyTx.wait();
      let lastTxHash = policyTx.hash;
      if (Number(policyForm.deposit) > 0) {
        const deposit = amountUnits(policyForm.deposit);
        const approveFees = await getOptimizedFeeData(provider);
        const approveTx = await usdc.approve(addresses.capital, deposit, approveFees);
        await approveTx.wait();
        const depositFees = await getOptimizedFeeData(provider);
        const depositTx = await capital.deposit(deposit, depositFees);
        await depositTx.wait();
        lastTxHash = depositTx.hash;
      }
      await api('/investors/register', {
        method: 'POST',
        body: JSON.stringify({ address: walletAddress, label: `Investor ${walletAddress.slice(0, 6)}` }),
      });
      toast('success', 'Investor policy saved. Capital account updated.', lastTxHash);
      await loadData();
    });
  }

  async function mintMockUsdc(amount: string) {
    await run('mint-usdc', async () => {
      if (!walletAddress) throw new Error('Connect your wallet first.');
      const parsed = Number(amount);
      if (!parsed || parsed <= 0) throw new Error('Please enter a valid amount greater than 0.');
      const units = amountUnits(amount);

      // Try via backend faucet relayer first (which holds owner key on testnet)
      try {
        const res = await api<any>('/faucet/mint', {
          method: 'POST',
          body: JSON.stringify({
            recipient: walletAddress,
            amount: units.toString(),
          }),
        });
        toast('success', `Successfully minted ${amount} mock USDC to ${shortAddress(walletAddress)}!`, res?.txHash);
        await loadData();
        return;
      } catch (err: any) {
        // Fallback to client-side direct contract call if relayer is unavailable or user is the owner
        const { provider, signer } = await connectWallet();
        const feeOverrides = await getOptimizedFeeData(provider);
        const usdc = contract(addresses.usdc, usdcAbi, signer);
        const tx = await usdc.mint(walletAddress, units, feeOverrides);
        await tx.wait();
        toast('success', `Successfully minted ${amount} mock USDC to ${shortAddress(walletAddress)}!`, tx.hash);
        await loadData();
      }
    });
  }

  async function acceptOffer(invoice: Invoice) {
    await run(`accept-${invoice.chainInvoiceId}`, async () => {
      if (!walletAddress) throw new Error('Connect the supplier wallet first.');
      const { provider, signer } = await connectWallet();
      const feeOverrides = await getOptimizedFeeData(provider);
      const coordinator = contract(addresses.coordinator, coordinatorAbi, signer);
      const tx = await coordinator.acceptOffer(invoice.chainInvoiceId, feeOverrides);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('Offer acceptance failed.');
      await api(`/invoices/${invoice.chainInvoiceId}/accept-offer`, {
        method: 'POST',
        body: JSON.stringify({ txHash: tx.hash }),
      });
      toast('success', 'Offer accepted on-chain.', tx.hash);
      await loadData();
    });
  }

  async function reviewInvoice(invoice: Invoice, approved: boolean = true) {
    await run(`review-${invoice.chainInvoiceId}`, async () => {
      if (!approved) {
        const res = await api<any>(`/invoices/${invoice.chainInvoiceId}/review`, {
          method: 'POST',
          body: JSON.stringify({ approved: false, riskTier: 0 }),
        });
        toast('info', `Invoice #${invoice.chainInvoiceId} rejected.`, res?.txHash);
      } else {
        toast('info', `Running Chainlink CRE autonomous verification for Invoice #${invoice.chainInvoiceId}...`);
        const creRes = await verifyInvoiceWithCre({
          chainInvoiceId: invoice.chainInvoiceId,
          supplier: invoice.supplier,
          invoiceKey: invoice.invoiceKey,
          debtorReference: invoice.debtorReference,
          faceValue: invoice.faceValue,
          dueDate: invoice.dueDate,
          evidenceHash: invoice.evidenceHash,
        });

        toast(
          'success',
          `Chainlink CRE verified Invoice #${invoice.chainInvoiceId} on Arbitrum Sepolia! (Risk Tier: ${creRes.riskTier}, Score: ${creRes.creditScore})`,
          creRes.txHash
        );
      }
      await loadData();
    });
  }

  async function recordAssignment(invoice: Invoice) {
    await run(`assign-${invoice.chainInvoiceId}`, async () => {
      const assignmentEvidenceHash = hashText(
        `demo-assignment-${invoice.chainInvoiceId}-${Date.now()}`
      );
      const res = await api<any>(`/invoices/${invoice.chainInvoiceId}/assignment`, {
        method: 'POST',
        body: JSON.stringify({ assignmentEvidenceHash }),
      });
      toast('success', 'Demo assignment gate recorded on Arbitrum Sepolia.', res?.txHash);
      await loadData();
    });
  }

  async function createQuote(invoice: Invoice) {
    await run(`quote-${invoice.chainInvoiceId}`, async () => {
      const res = await api<any>(`/invoices/${invoice.chainInvoiceId}/quote`, {
        method: 'POST',
        body: JSON.stringify({ validForSeconds: 86400 }),
      });
      toast('success', 'Purchase offer calculated and recorded on-chain.', res?.offer?.txHash);
      await loadData();
    });
  }

  async function fundOpportunity(invoice: Invoice) {
    await run(`fund-${invoice.chainInvoiceId}`, async () => {
      const match = await api<any>(`/opportunities/${invoice.chainInvoiceId}/match`);
      if (!match.fullyFundable)
        throw new Error(`Not enough compliant capital. Remaining: ${money(match.remaining)}.`);
      const res = await api<any>(`/opportunities/${invoice.chainInvoiceId}/fund`, {
        method: 'POST',
        body: JSON.stringify({ allocations: match.allocations }),
      });
      toast('success', 'Funding transaction confirmed. Supplier has been paid.', res?.txHash);
      await loadData();
    });
  }

  async function simulateCollection(invoice: Invoice) {
    await run(`collect-${invoice.chainInvoiceId}`, async () => {
      const amount = amountUnits(
        collectionAmount[invoice.chainInvoiceId] ||
        (Number(invoice.faceValue) / 1_000_000).toString()
      );
      const res = await api<any>(`/invoices/${invoice.chainInvoiceId}/simulate-collection`, {
        method: 'POST',
        body: JSON.stringify({ amountReceived: amount.toString() }),
      });
      toast('success', 'Collection processed and settlement recorded on-chain.', res?.txHash);
      await loadData();
    });
  }

  return (
    <main className="app-shell">
      <Sidebar
        tab={tab}
        setTab={setTab}
        mobileNav={mobileNav}
        setMobileNav={setMobileNav}
        tabs={tabs}
        txCount={txHistory.length}
        onOpenTxHistory={() => setIsTxModalOpen(true)}
      />

      <section className="main-area">
        <Topbar
          tab={tab}
          setMobileNav={setMobileNav}
          chainHealth={chainHealth}
          wallet={wallet}
          busy={busy}
          walletAddress={walletAddress}
          txCount={txHistory.length}
          onOpenTxHistory={() => setIsTxModalOpen(true)}
        />

        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>{tab}</h1>
              <p>
                {tab === 'Overview'
                  ? 'A clearer view of your receivables, capital, and collections.'
                  : activeTab.subtitle}
              </p>
            </div>
            <div className="heading-actions">
              <div className="sync-label">
                <span className="sync-dot" /> Auto-sync every 20s
              </div>
              <Button variant="outline" onClick={() => void loadData()}>
                <RefreshCw size={15} /> Refresh
              </Button>
            </div>
          </div>

          {notice && (
            <div className={`toast ${notice.type}`}>
              <div>
                {notice.type === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : notice.type === 'error' ? (
                  <XCircle size={18} />
                ) : (
                  <Activity size={18} />
                )}
              </div>
              <span>{notice.text}</span>
              <button onClick={() => setNotice(null)} aria-label="Dismiss">
                <XCircle size={16} />
              </button>
            </div>
          )}

          {(!chainHealth?.chain?.configured || !addresses.registry || !addresses.capital) && (
            <div className="setup-banner">
              <div className="setup-icon">
                <Gauge size={19} />
              </div>
              <div>
                <strong>Finish connecting your testnet deployment</strong>
                <p>
                  Copy <code>frontend/.env.example</code> to <code>frontend/.env.local</code>, set
                  your deployed contract addresses and API URL, then restart the frontend. API reads
                  may work before contracts are configured.
                </p>
              </div>
            </div>
          )}

          {tab === 'Overview' && (
            <OverviewTab
              count={count}
              invoices={invoices}
              investors={investors}
              opportunities={opportunities}
              settlements={settlements}
              dashboard={dashboard}
              collections={collections}
              chainHealth={chainHealth}
              offers={offers}
              acceptOffer={acceptOffer}
              busy={busy}
              setTab={setTab}
            />
          )}

          {tab === 'Invoices' && (
            <InvoicesTab
              invoiceForm={invoiceForm}
              setInvoiceForm={setInvoiceForm}
              submitInvoice={submitInvoice}
              busy={busy}
              walletAddress={walletAddress}
              invoices={invoices}
            />
          )}

          {tab === 'Capital accounts' && (
            <CapitalAccountsTab
              walletAddress={walletAddress}
              policyForm={policyForm}
              setPolicyForm={setPolicyForm}
              savePolicyAndDeposit={savePolicyAndDeposit}
              mintMockUsdc={mintMockUsdc}
              busy={busy}
              wallet={wallet}
              currentInvestor={currentInvestor}
              investors={investors}
            />
          )}

          {tab === 'Opportunities' && (
            <OpportunitiesTab
              opportunities={opportunities}
              offers={offers}
              fundOpportunity={fundOpportunity}
              loadData={loadData}
              setTab={setTab}
              busy={busy}
            />
          )}

          {tab === 'Operations' && (
            <OperationsTab
              search={search}
              setSearch={setSearch}
              visibleInvoices={visibleInvoices}
              offers={offers}
              riskTier={riskTier}
              setRiskTier={setRiskTier}
              busy={busy}
              reviewInvoice={reviewInvoice}
              recordAssignment={recordAssignment}
              createQuote={createQuote}
              collectionAmount={collectionAmount}
              setCollectionAmount={setCollectionAmount}
              simulateCollection={simulateCollection}
              collections={collections}
              settlements={settlements}
            />
          )}

          <footer className="page-footer">
            <div>
              <span className="footer-mark">
                <ShieldCheck size={14} />
              </span>
              <strong>ledgerly.</strong>
              <span>Receivables Capital Network</span>
            </div>
            <div>
              <span className="footer-dot" /> Demo environment · Not production financial infrastructure
            </div>
          </footer>
        </div>
      </section>

      {/* Floating Success/Event Toasts */}
      <ToastContainer toasts={floatingToasts} onDismiss={dismissToast} />

      {/* Recent Transactions Explorer Modal */}
      <TransactionHistoryModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        transactions={txHistory}
        onClear={clearTransactions}
      />
    </main>
  );
}
