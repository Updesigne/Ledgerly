import { JsonStore } from '../storage/json-store.js';
import type { CollectionRecord, FundingAllocationRecord, InvestorRecord, InvoiceRecord, OfferRecord, SettlementRecord } from '../types/domain.js';

export const store = new JsonStore(process.env.DATA_DIR ?? '../data');

export const repository = {
  invoices: () => store.read<InvoiceRecord[]>('invoices.json', []),
  offers: () => store.read<OfferRecord[]>('offers.json', []),
  investors: () => store.read<InvestorRecord[]>('investors.json', []),
  allocations: () => store.read<FundingAllocationRecord[]>('funding-allocations.json', []),
  collections: () => store.read<CollectionRecord[]>('collections.json', []),
  settlements: () => store.read<SettlementRecord[]>('settlements.json', []),
  async saveInvoice(item: InvoiceRecord) {
    return store.update<InvoiceRecord[]>('invoices.json', [], (items) => {
      const index = items.findIndex((x) => x.chainInvoiceId === item.chainInvoiceId);
      if (index >= 0) items[index] = { ...items[index], ...item };
      else items.push(item);
      return items;
    });
  },
  async saveOffer(item: OfferRecord) {
    return store.update<OfferRecord[]>('offers.json', [], (items) => {
      const index = items.findIndex((x) => x.chainInvoiceId === item.chainInvoiceId);
      if (index >= 0) items[index] = { ...items[index], ...item };
      else items.push(item);
      return items;
    });
  },
  async saveInvestor(item: InvestorRecord) {
    return store.update<InvestorRecord[]>('investors.json', [], (items) => {
      const index = items.findIndex((x) => x.address.toLowerCase() === item.address.toLowerCase());
      if (index >= 0) items[index] = { ...items[index], ...item };
      else items.push(item);
      return items;
    });
  },
  async saveAllocation(item: FundingAllocationRecord) {
    return store.update<FundingAllocationRecord[]>('funding-allocations.json', [], (items) => {
      const index = items.findIndex((x) => x.invoiceId === item.invoiceId);
      if (index >= 0) items[index] = item;
      else items.push(item);
      return items;
    });
  },
  async saveCollection(item: CollectionRecord) {
    return store.update<CollectionRecord[]>('collections.json', [], (items) => { items.push(item); return items; });
  },
  async saveSettlement(item: SettlementRecord) {
    return store.update<SettlementRecord[]>('settlements.json', [], (items) => {
      const index = items.findIndex((x) => x.invoiceId === item.invoiceId);
      if (index >= 0) items[index] = item;
      else items.push(item);
      return items;
    });
  },
};
