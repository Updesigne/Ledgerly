// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {SafeToken} from "./libraries/SafeToken.sol";
import {ReentrancyGuard} from "./libraries/ReentrancyGuard.sol";

/// @notice Shared USDC custody with individually accounted investor balances.
contract CapitalAccounts is ReentrancyGuard {
    using SafeToken for IERC20Minimal;

    struct Policy {
        bool enabled;
        uint16 maxDurationDays;
        uint16 minExpectedReturnBps;
        uint8 maxRiskTier;
        uint128 maxPerInvoice;
    }
    struct Balance { uint256 available; uint256 reserved; uint256 deployed; }

    IERC20Minimal public immutable token;
    address public owner;
    address public coordinator;
    mapping(address => Policy) public policies;
    mapping(address => Balance) private _balances;

    error Unauthorized();
    error InvalidInput();
    error InsufficientAvailable();
    error Ineligible();

    event Deposited(address indexed investor, uint256 amount);
    event Withdrawn(address indexed investor, uint256 amount);
    event PolicyUpdated(address indexed investor, bool enabled, uint16 maxDurationDays, uint16 minExpectedReturnBps, uint8 maxRiskTier, uint128 maxPerInvoice);
    event CapitalReserved(address indexed investor, uint256 indexed invoiceId, uint256 amount);
    event PurchaseExecuted(address indexed investor, uint256 indexed invoiceId, address indexed supplier, uint256 amount);
    event CapitalSettled(address indexed investor, uint256 indexed invoiceId, uint256 principalWrittenOff, uint256 proceedsReceived);
    event CoordinatorUpdated(address indexed coordinator);

    constructor(address tokenAddress) {
        if (tokenAddress == address(0)) revert InvalidInput();
        token = IERC20Minimal(tokenAddress);
        owner = msg.sender;
    }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier onlyCoordinator() { if (msg.sender != coordinator) revert Unauthorized(); _; }

    function setCoordinator(address next) external onlyOwner {
        if (next == address(0)) revert InvalidInput();
        coordinator = next;
        emit CoordinatorUpdated(next);
    }

    function setPolicy(bool enabled, uint16 maxDurationDays, uint16 minExpectedReturnBps, uint8 maxRiskTier, uint128 maxPerInvoice) external {
        if (maxDurationDays == 0 || maxRiskTier < 1 || maxRiskTier > 4 || maxPerInvoice == 0) revert InvalidInput();
        policies[msg.sender] = Policy(enabled, maxDurationDays, minExpectedReturnBps, maxRiskTier, maxPerInvoice);
        emit PolicyUpdated(msg.sender, enabled, maxDurationDays, minExpectedReturnBps, maxRiskTier, maxPerInvoice);
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidInput();
        token.safeTransferFrom(msg.sender, address(this), amount);
        _balances[msg.sender].available += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0 || _balances[msg.sender].available < amount) revert InsufficientAvailable();
        _balances[msg.sender].available -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getBalance(address investor) external view returns (Balance memory) { return _balances[investor]; }

    function isEligible(address investor, uint256 amount, uint256 durationDays, uint8 riskTier, uint256 expectedReturnBps) external view returns (bool) {
        Policy memory p = policies[investor];
        Balance memory b = _balances[investor];
        return p.enabled && amount > 0 && amount <= p.maxPerInvoice && amount <= b.available && durationDays <= p.maxDurationDays && riskTier <= p.maxRiskTier && expectedReturnBps >= p.minExpectedReturnBps;
    }

    function reserve(address investor, uint256 invoiceId, uint256 amount) external onlyCoordinator {
        if (amount == 0 || _balances[investor].available < amount) revert InsufficientAvailable();
        _balances[investor].available -= amount;
        _balances[investor].reserved += amount;
        emit CapitalReserved(investor, invoiceId, amount);
    }

    function executePurchase(address investor, uint256 invoiceId, address supplier, uint256 amount) external onlyCoordinator nonReentrant {
        if (supplier == address(0) || amount == 0 || _balances[investor].reserved < amount) revert InvalidInput();
        _balances[investor].reserved -= amount;
        _balances[investor].deployed += amount;
        token.safeTransfer(supplier, amount);
        emit PurchaseExecuted(investor, invoiceId, supplier, amount);
    }

    /// @notice Terminal distribution for an invoice. Each participant's deployed principal is closed;
    /// proceeds are credited pro-rata, so any shortfall is reflected as a loss.
    function settleContribution(address investor, uint256 invoiceId, uint256 principal, uint256 proceeds) external onlyCoordinator {
        if (principal == 0 || _balances[investor].deployed < principal) revert InvalidInput();
        _balances[investor].deployed -= principal;
        _balances[investor].available += proceeds;
        emit CapitalSettled(investor, invoiceId, principal, proceeds);
    }

    function releaseReservation(address investor, uint256 amount) external onlyCoordinator {
        if (amount == 0 || _balances[investor].reserved < amount) revert InvalidInput();
        _balances[investor].reserved -= amount;
        _balances[investor].available += amount;
    }
}
