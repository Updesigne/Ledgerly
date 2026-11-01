// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice On-chain invoice identity and workflow gates. Documents and sensitive debtor data stay off-chain.
contract InvoiceRegistry {
    enum Status { None, Submitted, Verified, Assigned, Funding, Funded, Collecting, Settled, Rejected, Disputed, Overdue, Defaulted, Cancelled }

    struct Invoice {
        address supplier;
        bytes32 debtorRef;
        bytes32 evidenceHash;
        uint128 faceValue;       // token base units (6 decimals for MockUSDC)
        uint64 dueDate;
        uint64 createdAt;
        uint8 riskTier;          // 1 = lowest risk; larger values = higher risk
        Status status;
        bool assignmentComplete;
    }

    address public owner;
    address public coordinator;
    address public verifier;
    uint256 public nextInvoiceId = 1;
    mapping(uint256 => Invoice) private _invoices;
    mapping(bytes32 => uint256) public invoiceKeyToId;

    error Unauthorized();
    error InvalidInput();
    error InvalidStatus();
    error DuplicateInvoice();
    error UnknownInvoice();

    event InvoiceSubmitted(uint256 indexed invoiceId, address indexed supplier, bytes32 indexed invoiceKey, uint256 faceValue, uint64 dueDate, bytes32 evidenceHash);
    event InvoiceReviewed(uint256 indexed invoiceId, Status status, uint8 riskTier);
    event AssignmentRecorded(uint256 indexed invoiceId, bytes32 assignmentEvidenceHash);
    event InvoiceStatusChanged(uint256 indexed invoiceId, Status oldStatus, Status newStatus);
    event CoordinatorUpdated(address indexed coordinator);
    event VerifierUpdated(address indexed verifier);

    constructor() { owner = msg.sender; }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier onlyCoordinator() { if (msg.sender != coordinator) revert Unauthorized(); _; }
    modifier onlyVerifierOrOwner() { if (msg.sender != owner && msg.sender != verifier) revert Unauthorized(); _; }

    function setCoordinator(address next) external onlyOwner {
        if (next == address(0)) revert InvalidInput();
        coordinator = next;
        emit CoordinatorUpdated(next);
    }

    function setVerifier(address next) external onlyOwner {
        if (next == address(0)) revert InvalidInput();
        verifier = next;
        emit VerifierUpdated(next);
    }

    function submitInvoice(bytes32 invoiceKey, bytes32 debtorRef, bytes32 evidenceHash, uint128 faceValue, uint64 dueDate) external returns (uint256 id) {
        if (invoiceKey == bytes32(0) || debtorRef == bytes32(0) || evidenceHash == bytes32(0) || faceValue == 0 || dueDate <= block.timestamp) revert InvalidInput();
        if (invoiceKeyToId[invoiceKey] != 0) revert DuplicateInvoice();
        id = nextInvoiceId++;
        _invoices[id] = Invoice({supplier: msg.sender, debtorRef: debtorRef, evidenceHash: evidenceHash, faceValue: faceValue, dueDate: dueDate, createdAt: uint64(block.timestamp), riskTier: 0, status: Status.Submitted, assignmentComplete: false});
        invoiceKeyToId[invoiceKey] = id;
        emit InvoiceSubmitted(id, msg.sender, invoiceKey, faceValue, dueDate, evidenceHash);
    }

    /// @dev Owner or authorized Chainlink CRE verifier reviews the invoice off-chain and attests on-chain.
    function reviewInvoice(uint256 id, bool approved, uint8 riskTier) external onlyVerifierOrOwner {
        Invoice storage inv = _get(id);
        if (inv.status != Status.Submitted) revert InvalidStatus();
        if (approved && (riskTier < 1 || riskTier > 4)) revert InvalidInput();
        Status next = approved ? Status.Verified : Status.Rejected;
        Status old = inv.status;
        inv.status = next;
        inv.riskTier = approved ? riskTier : 0;
        emit InvoiceReviewed(id, next, inv.riskTier);
        emit InvoiceStatusChanged(id, old, next);
    }

    /// @dev This records a workflow gate; it does not itself establish legal assignment under applicable law.
    function recordAssignment(uint256 id, bytes32 assignmentEvidenceHash) external onlyOwner {
        Invoice storage inv = _get(id);
        if (inv.status != Status.Verified || assignmentEvidenceHash == bytes32(0)) revert InvalidStatus();
        inv.assignmentComplete = true;
        inv.status = Status.Assigned;
        emit AssignmentRecorded(id, assignmentEvidenceHash);
        emit InvoiceStatusChanged(id, Status.Verified, Status.Assigned);
    }

    function setStatus(uint256 id, Status next) external onlyCoordinator {
        Invoice storage inv = _get(id);
        Status old = inv.status;
        bool allowed =
            (old == Status.Assigned && next == Status.Funding) ||
            (old == Status.Funding && next == Status.Funded) ||
            (old == Status.Funded && next == Status.Collecting) ||
            (old == Status.Collecting && (next == Status.Settled || next == Status.Overdue || next == Status.Disputed || next == Status.Defaulted)) ||
            (old == Status.Overdue && (next == Status.Collecting || next == Status.Disputed || next == Status.Defaulted || next == Status.Settled));
        if (!allowed) revert InvalidStatus();
        inv.status = next;
        emit InvoiceStatusChanged(id, old, next);
    }

    function getInvoice(uint256 id) external view returns (Invoice memory) { return _get(id); }

    function _get(uint256 id) internal view returns (Invoice storage inv) {
        inv = _invoices[id];
        if (inv.status == Status.None) revert UnknownInvoice();
    }
}
