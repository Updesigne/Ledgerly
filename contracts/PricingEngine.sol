// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Demo discount curve. It is a configurable demonstration, not a validated market pricing model.
contract PricingEngine {
    uint256 public constant BPS = 10_000;
    address public owner;
    uint16 public baseMinBps = 400;  // 4%
    uint16 public baseMaxBps = 1000; // 10%
    uint16 public maxRiskAdjustmentBps = 2000; // +20 percentage points
    uint16 public maxTotalDiscountBps = 5000;  // 50%
    mapping(uint8 => uint16) public riskAdjustmentBps; // tier 1..4

    error Unauthorized();
    error InvalidInput();
    event PricingParametersUpdated(uint16 baseMinBps, uint16 baseMaxBps, uint16 maxRiskAdjustmentBps, uint16 maxTotalDiscountBps);
    event RiskAdjustmentUpdated(uint8 indexed tier, uint16 adjustmentBps);

    constructor() {
        owner = msg.sender;
        riskAdjustmentBps[1] = 0;
        riskAdjustmentBps[2] = 100;
        riskAdjustmentBps[3] = 300;
        riskAdjustmentBps[4] = 700;
    }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }

    function setParameters(uint16 minBps, uint16 maxBps, uint16 maxRiskBps, uint16 maxDiscountBps) external onlyOwner {
        if (minBps > maxBps || maxBps > BPS || maxRiskBps > BPS || maxDiscountBps > BPS || maxDiscountBps < minBps) revert InvalidInput();
        baseMinBps = minBps;
        baseMaxBps = maxBps;
        maxRiskAdjustmentBps = maxRiskBps;
        maxTotalDiscountBps = maxDiscountBps;
        emit PricingParametersUpdated(minBps, maxBps, maxRiskBps, maxDiscountBps);
    }

    function setRiskAdjustment(uint8 tier, uint16 adjustmentBps) external onlyOwner {
        if (tier < 1 || tier > 4 || adjustmentBps > maxRiskAdjustmentBps) revert InvalidInput();
        riskAdjustmentBps[tier] = adjustmentBps;
        emit RiskAdjustmentUpdated(tier, adjustmentBps);
    }

    /// @param faceValue Total invoice face value.
    /// @param daysRemaining Remaining contractual term, capped at 365 days.
    /// @param tier Risk tier from 1 to 4.
    /// @return purchasePrice Price paid to seller.
    /// @return discountBps Total discount in basis points; price is faceValue * (10000 - discountBps) / 10000.
    /// @return baseBps Base discount in basis points.
    /// @return riskBps Risk adjustment in basis points.
    function quote(uint256 faceValue, uint256 daysRemaining, uint8 tier) public view returns (uint256 purchasePrice, uint256 discountBps, uint256 baseBps, uint256 riskBps) {
        if (faceValue == 0 || tier < 1 || tier > 4) revert InvalidInput();
        if (daysRemaining > 365) daysRemaining = 365;
        baseBps = uint256(baseMinBps) + ((uint256(baseMaxBps) - baseMinBps) * daysRemaining / 365);
        riskBps = riskAdjustmentBps[tier];
        if (riskBps > maxRiskAdjustmentBps) revert InvalidInput();
        discountBps = baseBps + riskBps;
        if (discountBps > maxTotalDiscountBps) discountBps = maxTotalDiscountBps;
        if (discountBps >= BPS) revert InvalidInput();
        purchasePrice = faceValue * (BPS - discountBps) / BPS;
    }
}
