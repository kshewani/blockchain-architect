// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

contract PaymentLedger {
    uint256 public total;

    function record(uint256 amount) public {
        total = total + amount;
    }
}