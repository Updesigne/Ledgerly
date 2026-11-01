import { chain } from '../chain/client.js';
import { store } from '../services/repository.js';

type IndexedEvent = { key: string; contract: string; name: string; blockNumber: number; transactionHash: string; logIndex: number; args: Record<string, unknown>; indexedAt: string };
type IndexState = { lastProcessedBlock: number; events: IndexedEvent[] };
let running = false;

export async function indexRecentEvents(): Promise<void> {
  if (running || !chain.provider || !chain.configured) return;
  running = true;
  try {
    const state = await store.read<IndexState>('chain-events.json', { lastProcessedBlock: 0, events: [] });
    const latest = await chain.provider.getBlockNumber();
    const from = state.lastProcessedBlock > 0 ? state.lastProcessedBlock + 1 : Math.max(0, latest - 2000);
    if (from > latest) return;
    const to = Math.min(latest, from + 499);
    const contracts = [
      { name: 'InvoiceRegistry', contract: chain.registry!, events: ['InvoiceSubmitted', 'InvoiceReviewed', 'AssignmentRecorded', 'InvoiceStatusChanged'] },
      { name: 'CapitalAccounts', contract: chain.capital!, events: ['Deposited', 'Withdrawn', 'PolicyUpdated', 'CapitalSettled'] },
      { name: 'FundingCoordinator', contract: chain.coordinator!, events: ['OfferCreated', 'OfferAccepted', 'InvoiceFunded', 'ContributionRecorded', 'CollectionRecorded', 'SettlementDistributed'] },
    ];
    const fresh: IndexedEvent[] = [];
    for (const entry of contracts) {
      for (const eventName of entry.events) {
        const filterFactory = (entry.contract.filters as unknown as Record<string, () => any>)[eventName];
        const logs = await entry.contract.queryFilter(filterFactory(), from, to);
        for (const log of logs) {
          const parsed = entry.contract.interface.parseLog({ topics: [...log.topics], data: log.data });
          const args: Record<string, unknown> = {};
          if (parsed) for (const [key, value] of Object.entries(parsed.args)) {
            if (!/^\d+$/.test(key)) args[key] = typeof value === 'bigint' ? value.toString() : value;
          }
          fresh.push({ key: `${log.transactionHash}:${log.index}`, contract: entry.name, name: eventName, blockNumber: log.blockNumber, transactionHash: log.transactionHash, logIndex: log.index, args, indexedAt: new Date().toISOString() });
        }
      }
    }
    const seen = new Set(state.events.map((event) => event.key));
    state.events.push(...fresh.filter((event) => !seen.has(event.key)));
    state.lastProcessedBlock = to;
    await store.write('chain-events.json', state);
  } catch (error) {
    console.error('[event-indexer]', (error as Error).message);
  } finally {
    running = false;
  }
}

export function startEventIndexer(intervalMs = 12_000): NodeJS.Timeout | undefined {
  if (!chain.provider || !chain.configured) {
    console.warn('[event-indexer] Chain not configured; indexing disabled.');
    return undefined;
  }
  void indexRecentEvents();
  return setInterval(() => void indexRecentEvents(), intervalMs);
}
