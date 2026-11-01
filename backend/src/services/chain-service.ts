import { Contract, isHexString, keccak256, toUtf8Bytes } from 'ethers';
import { chain } from '../chain/client.js';
import { repository } from './repository.js';
import { HttpError } from '../utils/errors.js';
import type { InvoiceRecord, InvoiceStatus, OfferRecord } from '../types/domain.js';

const statusNames: InvoiceStatus[] = ['Draft','Submitted','Verified','Assigned','Funding','Funded','Collecting','Settled','Rejected','Disputed','Overdue','Defaulted','Cancelled'];
export const statusName = (value: bigint | number): InvoiceStatus => statusNames[Number(value)] ?? 'Draft';
export const toBytes32 = (value: string): string => {
  if (isHexString(value, 32)) return value;
  return keccak256(toUtf8Bytes(value));
};

export async function confirmReceipt(txHash: string) {
  chain.requireReadContracts();
  const receipt = await chain.provider!.getTransactionReceipt(txHash);
  if (!receipt) throw new HttpError(409, 'Transaction receipt is not available yet. Wait for confirmation and retry.');
  if (receipt.status !== 1) throw new HttpError(422, 'The referenced blockchain transaction failed.');
  return receipt;
}

export async function verifyInvoiceSubmission(txHash: string, expectedId: string, expectedSupplier: string) {
  const receipt = await confirmReceipt(txHash);
  const registry = chain.registry!;
  const matching = receipt.logs.map((log) => {
    try { return registry.interface.parseLog({ topics: [...log.topics], data: log.data }); } catch { return null; }
  }).find((log, index) => log?.name === 'InvoiceSubmitted' && receipt.logs[index].address.toLowerCase() === String(registry.target).toLowerCase() && String(log.args.invoiceId) === expectedId && String(log.args.supplier).toLowerCase() === expectedSupplier.toLowerCase());
  if (!matching) throw new HttpError(422, 'Transaction receipt does not contain the expected InvoiceSubmitted event from InvoiceRegistry.');
  return matching;
}

export async function loadOnChainInvoice(id: string) {
  chain.requireReadContracts();
  try {
    const inv = await chain.registry!.getInvoice(id);
    return {
      id: String(id), supplier: String(inv.supplier), debtorRef: String(inv.debtorRef), evidenceHash: String(inv.evidenceHash),
      faceValue: String(inv.faceValue), dueDate: Number(inv.dueDate), createdAt: Number(inv.createdAt), riskTier: Number(inv.riskTier),
      status: statusName(inv.status), assignmentComplete: Boolean(inv.assignmentComplete),
    };
  } catch (error) {
    const chainError = error as Error & { shortMessage?: string };
    throw new HttpError(404, `Unable to load on-chain invoice ${id}: ${chainError.shortMessage ?? chainError.message}`);
  }
}

export async function syncInvoiceFromChain(id: string): Promise<InvoiceRecord> {
  const onChain = await loadOnChainInvoice(id);
  const existing = (await repository.invoices()).find((item) => item.chainInvoiceId === id);
  const record: InvoiceRecord = {
    id: existing?.id ?? `inv-${id}`,
    chainInvoiceId: id,
    supplier: onChain.supplier,
    invoiceKey: existing?.invoiceKey ?? '',
    debtorReference: existing?.debtorReference ?? onChain.debtorRef,
    faceValue: onChain.faceValue,
    currency: 'USDC',
    dueDate: onChain.dueDate,
    evidenceHash: onChain.evidenceHash,
    evidencePath: existing?.evidencePath,
    status: onChain.status,
    riskTier: onChain.riskTier || existing?.riskTier,
    assignmentEvidenceHash: existing?.assignmentEvidenceHash,
    submitTxHash: existing?.submitTxHash ?? '',
    createdAt: existing?.createdAt ?? new Date(onChain.createdAt * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await repository.saveInvoice(record);
  return record;
}

export async function syncOffer(id: string, txHash?: string): Promise<OfferRecord> {
  chain.requireReadContracts();
  const offer = await chain.coordinator!.getOffer(id);
  const invoice = await syncInvoiceFromChain(id);
  const record: OfferRecord = {
    invoiceId: invoice.id,
    chainInvoiceId: id,
    purchasePrice: String(offer.purchasePrice),
    discountBps: Number(offer.discountBps),
    baseDiscountBps: Number(offer.baseDiscountBps),
    riskAdjustmentBps: Number(offer.riskAdjustmentBps),
    expiry: Number(offer.expiry),
    accepted: Boolean(offer.accepted),
    funded: Boolean(offer.funded),
    txHash,
    updatedAt: new Date().toISOString(),
  };
  await repository.saveOffer(record);
  return record;
}

export async function createOfferOnChain(id: string, validForSeconds: number) {
  chain.requireReadContracts();
  const signer = chain.requireSigner();
  const owner = String(await chain.coordinator!.owner());
  if (owner.toLowerCase() !== signer.address.toLowerCase()) throw new HttpError(403, 'Configured relayer is not the FundingCoordinator owner; createOffer is owner-only.');
  const coordinator = chain.coordinator!.connect(signer) as Contract;
  const tx = await coordinator.createOffer(id, validForSeconds);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new HttpError(422, 'Offer creation transaction failed.');
  return syncOffer(id, tx.hash);
}
