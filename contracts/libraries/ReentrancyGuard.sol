// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract ReentrancyGuard {
    uint256 private _guard = 1;
    modifier nonReentrant() {
        require(_guard == 1, "REENTRANCY");
        _guard = 2;
        _;
        _guard = 1;
    }
}
