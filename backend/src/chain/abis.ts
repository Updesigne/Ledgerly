export const mockUsdcAbi = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function mint(address,uint256)',
];

export const invoiceRegistryAbi = [
  'function owner() view returns (address)',
  'function nextInvoiceId() view returns (uint256)',
  'function submitInvoice(bytes32 invoiceKey,bytes32 debtorRef,bytes32 evidenceHash,uint128 faceValue,uint64 dueDate) returns (uint256)',
  'function reviewInvoice(uint256 id,bool approved,uint8 riskTier)',
  'function recordAssignment(uint256 id,bytes32 assignmentEvidenceHash)',
  'function getInvoice(uint256 id) view returns ((address supplier,bytes32 debtorRef,bytes32 evidenceHash,uint128 faceValue,uint64 dueDate,uint64 createdAt,uint8 riskTier,uint8 status,bool assignmentComplete))',
  'event InvoiceSubmitted(uint256 indexed invoiceId,address indexed supplier,bytes32 indexed invoiceKey,uint256 faceValue,uint64 dueDate,bytes32 evidenceHash)',
  'event InvoiceReviewed(uint256 indexed invoiceId,uint8 status,uint8 riskTier)',
  'event AssignmentRecorded(uint256 indexed invoiceId,bytes32 assignmentEvidenceHash)',
  'event InvoiceStatusChanged(uint256 indexed invoiceId,uint8 oldStatus,uint8 newStatus)',
];

export const pricingEngineAbi = [
  'function quote(uint256 faceValue,uint256 daysRemaining,uint8 tier) view returns (uint256 purchasePrice,uint256 discountBps,uint256 baseBps,uint256 riskBps)',
];

export const capitalAccountsAbi = [
  'function owner() view returns (address)',
  'function coordinator() view returns (address)',
  'function setCoordinator(address)',
  'function setPolicy(bool enabled,uint16 maxDurationDays,uint16 minExpectedReturnBps,uint8 maxRiskTier,uint128 maxPerInvoice)',
  'function deposit(uint256 amount)',
  'function withdraw(uint256 amount)',
  'function getBalance(address investor) view returns ((uint256 available,uint256 reserved,uint256 deployed))',
  'function policies(address investor) view returns ((bool enabled,uint16 maxDurationDays,uint16 minExpectedReturnBps,uint8 maxRiskTier,uint128 maxPerInvoice))',
  'function isEligible(address investor,uint256 amount,uint256 durationDays,uint8 riskTier,uint256 expectedReturnBps) view returns (bool)',
  'event Deposited(address indexed investor,uint256 amount)',
  'event Withdrawn(address indexed investor,uint256 amount)',
  'event PolicyUpdated(address indexed investor,bool enabled,uint16 maxDurationDays,uint16 minExpectedReturnBps,uint8 maxRiskTier,uint128 maxPerInvoice)',
  'event CapitalSettled(address indexed investor,uint256 indexed invoiceId,uint256 principalWrittenOff,uint256 proceedsReceived)',
];

export const fundingCoordinatorAbi = [
  'function owner() view returns (address)',
  'function createOffer(uint256 invoiceId,uint64 validForSeconds) returns (uint256 purchasePrice)',
  'function acceptOffer(uint256 invoiceId)',
  'function fundInvoice(uint256 invoiceId,address[] investors,uint128[] amounts)',
  'function collectAndSettle(uint256 invoiceId,uint256 amountReceived)',
  'function getOffer(uint256 invoiceId) view returns ((uint128 purchasePrice,uint16 discountBps,uint16 baseDiscountBps,uint16 riskAdjustmentBps,uint64 expiry,bool accepted,bool funded))',
  'function getContributions(uint256 invoiceId) view returns ((address investor,uint128 amount)[])',
  'function terminalSettlement(uint256 invoiceId) view returns (bool)',
  'event OfferCreated(uint256 indexed invoiceId,uint256 purchasePrice,uint256 discountBps,uint64 expiry)',
  'event OfferAccepted(uint256 indexed invoiceId,address indexed supplier,uint256 purchasePrice)',
  'event InvoiceFunded(uint256 indexed invoiceId,uint256 purchasePrice,uint256 participantCount)',
  'event ContributionRecorded(uint256 indexed invoiceId,address indexed investor,uint256 amount)',
  'event CollectionRecorded(uint256 indexed invoiceId,uint256 amountReceived,bool fullyPaid)',
  'event SettlementDistributed(uint256 indexed invoiceId,uint256 totalReceived,uint256 totalPrincipal,bool fullyPaid)',
];
