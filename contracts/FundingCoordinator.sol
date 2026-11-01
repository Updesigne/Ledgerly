// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {SafeToken} from "./libraries/SafeToken.sol";
import {ReentrancyGuard} from "./libraries/ReentrancyGuard.sol";
import {InvoiceRegistry} from "./InvoiceRegistry.sol";
import {PricingEngine} from "./PricingEngine.sol";
import {CapitalAccounts} from "./CapitalAccounts.sol";

/// @notice Coordinates accepted offers, compliant funding, mock collection, and pro-rata settlement.
/// @dev A single terminal collection is supported in this MVP; partial payments are recorded as recoveries
///      and close the invoice with a shortfall rather than pretending the invoice was fully paid.
contract FundingCoordinator is ReentrancyGuard {
    using SafeToken for IERC20Minimal;

    struct Offer {
        uint128 purchasePrice;
        uint16 discountBps;
        uint16 baseDiscountBps;
        uint16 riskAdjustmentBps;
        uint64 expiry;
        bool accepted;
        bool funded;
    }
    struct Contribution {
        address investor;
        uint128 amount;
    }

    address public owner;
    IERC20Minimal public immutable token;
    InvoiceRegistry public immutable registry;
    PricingEngine public immutable pricing;
    CapitalAccounts public immutable capital;
    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Contribution[]) private _contributions;
    mapping(uint256 => bool) public terminalSettlement;

    error Unauthorized();
    error InvalidInput();
    error InvalidStatus();
    error OfferExpired();
    error FundingMismatch();
    error PolicyRejected(address investor);
    error DuplicateSettlement();

    event OfferCreated(
        uint256 indexed invoiceId,
        uint256 purchasePrice,
        uint256 discountBps,
        uint64 expiry
    );
    event OfferAccepted(
        uint256 indexed invoiceId,
        address indexed supplier,
        uint256 purchasePrice
    );
    event InvoiceFunded(
        uint256 indexed invoiceId,
        uint256 purchasePrice,
        uint256 participantCount
    );
    event ContributionRecorded(
        uint256 indexed invoiceId,
        address indexed investor,
        uint256 amount
    );
    event CollectionRecorded(
        uint256 indexed invoiceId,
        uint256 amountReceived,
        bool fullyPaid
    );
    event SettlementDistributed(
        uint256 indexed invoiceId,
        uint256 totalReceived,
        uint256 totalPrincipal,
        bool fullyPaid
    );

    constructor(
        address tokenAddress,
        address registryAddress,
        address pricingAddress,
        address capitalAddress
    ) {
        if (
            tokenAddress == address(0) ||
            registryAddress == address(0) ||
            pricingAddress == address(0) ||
            capitalAddress == address(0)
        ) revert InvalidInput();
        owner = msg.sender;
        token = IERC20Minimal(tokenAddress);
        registry = InvoiceRegistry(registryAddress);
        pricing = PricingEngine(pricingAddress);
        capital = CapitalAccounts(capitalAddress);
    }
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function createOffer(
        uint256 invoiceId,
        uint64 validForSeconds
    ) external onlyOwner returns (uint256 purchasePrice) {
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(invoiceId);
        if (
            inv.status != InvoiceRegistry.Status.Assigned ||
            !inv.assignmentComplete ||
            validForSeconds == 0 ||
            validForSeconds > 7 days ||
            inv.dueDate <= block.timestamp
        ) revert InvalidStatus();
        uint256 daysRemaining = (uint256(inv.dueDate) -
            block.timestamp +
            1 days -
            1) / 1 days;
        (uint256 price, uint256 discount, uint256 base, uint256 risk) = pricing
            .quote(inv.faceValue, daysRemaining, inv.riskTier);
        if (
            price == 0 ||
            price > type(uint128).max ||
            discount > type(uint16).max
        ) revert InvalidInput();
        offers[invoiceId] = Offer(
            uint128(price),
            uint16(discount),
            uint16(base),
            uint16(risk),
            uint64(block.timestamp + validForSeconds),
            false,
            false
        );
        emit OfferCreated(
            invoiceId,
            price,
            discount,
            uint64(block.timestamp + validForSeconds)
        );
        return price;
    }

    function acceptOffer(uint256 invoiceId) external {
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(invoiceId);
        Offer storage offer = offers[invoiceId];
        if (msg.sender != inv.supplier) revert Unauthorized();
        if (offer.purchasePrice == 0 || offer.accepted || offer.funded)
            revert InvalidStatus();
        if (block.timestamp > offer.expiry) revert OfferExpired();
        offer.accepted = true;
        emit OfferAccepted(invoiceId, msg.sender, offer.purchasePrice);
    }

    /// @param investors Investor accounts to fund the purchase.
    /// @param amounts Exact token-base-unit contribution per investor; sum must equal offer purchase price.
    function fundInvoice(
        uint256 invoiceId,
        address[] calldata investors,
        uint128[] calldata amounts
    ) external nonReentrant {
        if (
            investors.length == 0 ||
            investors.length != amounts.length ||
            investors.length > 50
        ) revert InvalidInput();
        Offer storage offer = offers[invoiceId];
        if (!offer.accepted || offer.funded || block.timestamp > offer.expiry)
            revert InvalidStatus();
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(invoiceId);
        if (
            inv.status != InvoiceRegistry.Status.Assigned ||
            !inv.assignmentComplete ||
            inv.dueDate <= block.timestamp
        ) revert InvalidStatus();
        uint256 daysRemaining = (uint256(inv.dueDate) -
            block.timestamp +
            1 days -
            1) / 1 days;
        uint256 expectedReturnBps = (uint256(offer.discountBps) * 10_000) /
            (10_000 - offer.discountBps);
        uint256 total;
        for (uint256 i; i < investors.length; ++i) {
            if (investors[i] == address(0) || amounts[i] == 0)
                revert InvalidInput();
            for (uint256 j; j < i; ++j)
                if (investors[j] == investors[i]) revert InvalidInput();
            bool eligible = capital.isEligible(
                investors[i],
                amounts[i],
                daysRemaining,
                inv.riskTier,
                expectedReturnBps
            );
            if (!eligible) revert PolicyRejected(investors[i]);
            total += amounts[i];
        }
        if (total != offer.purchasePrice) revert FundingMismatch();

        // Any revert below rolls back every reservation and transfer in this transaction.
        registry.setStatus(invoiceId, InvoiceRegistry.Status.Funding);
        for (uint256 i; i < investors.length; ++i)
            capital.reserve(investors[i], invoiceId, amounts[i]);
        for (uint256 i; i < investors.length; ++i) {
            capital.executePurchase(
                investors[i],
                invoiceId,
                inv.supplier,
                amounts[i]
            );
            _contributions[invoiceId].push(
                Contribution(investors[i], amounts[i])
            );
            emit ContributionRecorded(invoiceId, investors[i], amounts[i]);
        }
        offer.funded = true;
        registry.setStatus(invoiceId, InvoiceRegistry.Status.Funded);
        emit InvoiceFunded(invoiceId, total, investors.length);
    }

    /// @notice Demo collection: caller transfers actual mock tokens into shared custody, then proceeds are distributed.
    /// @dev Authorized owner simulates payment. In production replace this with a robust payment attestation/reconciliation model.
    function collectAndSettle(
        uint256 invoiceId,
        uint256 amountReceived
    ) external onlyOwner nonReentrant {
        if (terminalSettlement[invoiceId] || amountReceived == 0)
            revert DuplicateSettlement();
        Offer memory offer = offers[invoiceId];
        if (!offer.funded) revert InvalidStatus();
        InvoiceRegistry.Invoice memory inv = registry.getInvoice(invoiceId);
        if (
            inv.status != InvoiceRegistry.Status.Funded &&
            inv.status != InvoiceRegistry.Status.Collecting &&
            inv.status != InvoiceRegistry.Status.Overdue
        ) revert InvalidStatus();
        // Owner must hold the demo collection tokens and approve this coordinator first.
        token.safeTransferFrom(msg.sender, address(capital), amountReceived);
        if (
            inv.status == InvoiceRegistry.Status.Funded ||
            inv.status == InvoiceRegistry.Status.Overdue
        ) {
            registry.setStatus(invoiceId, InvoiceRegistry.Status.Collecting);
        }
        bool fullyPaid = amountReceived >= inv.faceValue;
        terminalSettlement[invoiceId] = true;
        uint256 totalPrincipal;
        uint256 distributed;
        Contribution[] storage cs = _contributions[invoiceId];
        for (uint256 i; i < cs.length; ++i) totalPrincipal += cs[i].amount;
        uint256 allocated;
        for (uint256 i; i < cs.length; ++i) {
            uint256 share = i == cs.length - 1
                ? amountReceived - allocated
                : (amountReceived * uint256(cs[i].amount)) / totalPrincipal;
            allocated += share;
            distributed += share;
            capital.settleContribution(
                cs[i].investor,
                invoiceId,
                cs[i].amount,
                share
            );
        }
        // The registry's terminal state is Settled for full collection, Defaulted for a shortfall.
        registry.setStatus(
            invoiceId,
            fullyPaid
                ? InvoiceRegistry.Status.Settled
                : InvoiceRegistry.Status.Defaulted
        );
        emit CollectionRecorded(invoiceId, amountReceived, fullyPaid);
        emit SettlementDistributed(
            invoiceId,
            distributed,
            totalPrincipal,
            fullyPaid
        );
    }

    function getContributions(
        uint256 invoiceId
    ) external view returns (Contribution[] memory) {
        return _contributions[invoiceId];
    }

    function getOffer(uint256 invoiceId) external view returns (Offer memory) {
        return offers[invoiceId];
    }

    /// @notice Return unused reservations only if a future version introduces a separate pre-reservation flow.
    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidInput();
        owner = nextOwner;
    }
}
