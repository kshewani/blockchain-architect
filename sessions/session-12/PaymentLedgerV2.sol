 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.37;

 contract PaymentLedgerV2 {
     uint256 public total;

     event PaymentRecorded(
         bytes32 indexed paymentId,
         address indexed sender,
         uint256 amount,
         uint256 timestamp
     );

     function record(bytes32 paymentId, uint256 amount) public {
         total = total + amount;

         emit PaymentRecorded(
             paymentId,
             msg.sender,
             amount,
             block.timestamp
         );
     }
 }
