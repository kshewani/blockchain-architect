# Session 11 — JSON-RPC, WebSocket & Event-Driven Transaction Monitoring

**Phase:** Integration  
**Duration:** ~60 minutes  
**Status:** Complete

## 1. Session Objective

Move from understanding Besu transactions to designing an application that can observe, monitor, reconcile, and safely recover from uncertain blockchain transaction states.

Focus:
- JSON-RPC transaction submission
- Transaction lifecycle
- WebSocket RPC
- Pub/Sub subscriptions
- `newHeads` and `logs`
- Event-driven transaction monitoring
- Polling vs WebSocket
- Payment/settlement reconciliation
- Tokenized-asset event monitoring
- Recovery after WebSocket/application failure

## 2. Core Mental Model

### Command path

```text
Business Application
        |
        v
RPC / API Layer
        |
        v
Besu RPC Node
        |
        v
Transaction Pool
        |
        v
P2P Propagation
        |
        v
QBFT Consensus
        |
        v
Block
        |
        v
EVM Execution
        |
        v
Transaction Receipt
```

### Observation path

```text
Blockchain
     |
     v
WebSocket Events
     |
     v
Application Event Handler
     |
     v
Reconciliation
     |
     v
Receipt + Logs + Business Validation
```

**Core principle:** WebSocket is an event-delivery mechanism; blockchain state is the source of truth.

## 3. Transaction Lifecycle Recap

A signed transaction submitted using `eth_sendRawTransaction` follows:

```text
Signed Transaction
       |
       v
eth_sendRawTransaction
       |
       v
Transaction Hash
       |
       v
Transaction Pool
       |
       v
P2P Propagation
       |
       v
QBFT Consensus
       |
       v
Block Proposal / Commitment
       |
       v
EVM Execution
       |
       v
Transaction Receipt
```

A returned transaction hash does **not** prove:
- block inclusion
- consensus/finality
- successful EVM execution
- expected smart-contract event emission
- successful business settlement

The hash is an identifier for subsequent tracking and reconciliation.

## 4. Transaction Structure

Important fields reviewed:
- `nonce`
- gas / fee parameters
- `gasLimit`
- `to`
- `value`
- `data`
- `chainId`
- signature

The sender nonce provides transaction sequencing and is important for ordering, replacement, duplicate handling, and reconciliation.

## 5. Transaction Receipt and Execution Status

A receipt can contain:
- `blockNumber`
- `transactionIndex`
- `gasUsed`
- `status`
- `logs`

`status = 0x1` means EVM execution succeeded.

`status = 0x0` means the transaction was included in a valid block but EVM execution failed/reverted.

Therefore:

```text
QBFT consensus
      |
      v
Valid block
      |
      v
EVM execution
      |
      +---- 0x1 -> execution succeeded
      |
      +---- 0x0 -> execution failed
```

A `0x0` receipt does not mean QBFT consensus failed. Gas can still be consumed.

## 6. WebSocket Configuration

Node 1 was configured with:

```toml
rpc-ws-enabled=true
rpc-ws-host="127.0.0.1"
rpc-ws-port=8545
rpc-ws-api=["ETH","NET","WEB3"]
```

HTTP RPC remained:

```toml
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=8546
rpc-http-api=["ETH","NET","WEB3"]
```

Node 1 therefore used:

```text
HTTP RPC       127.0.0.1:8546
WebSocket RPC  127.0.0.1:8545
P2P            127.0.0.1:30305
Metrics        127.0.0.1:9545
```

Configuration changes required a node restart, while the persisted data directory could be retained.

## 7. WebSocket Health vs Validator Health

After restart, Node 1 was verified with:
- WebSocket listener on port `8545`
- `eth_syncing` = `false`
- `net_peerCount` = `0x3`
- advancing `eth_blockNumber`

WebSocket availability alone does not prove that the node is synchronized, has peers, is participating normally as a validator, or that the blockchain is progressing.

Useful diagnostic dimensions remain:

```text
Process
  ↓
RPC
  ↓
WebSocket
  ↓
P2P peers
  ↓
Synchronization
  ↓
Block progress
  ↓
Consensus health
```

## 8. `newHeads` Subscription

Postman connected to:

```text
ws://127.0.0.1:8545
```

Subscription tested:

```json
{
  "jsonrpc": "2.0",
  "method": "eth_subscribe",
  "params": ["newHeads"],
  "id": 1
}
```

A real `eth_subscription` notification was received for block `0x9749` (decimal 38729).

The notification included block number, block hash, parent hash, proposer (`miner`), gas used, transactions, logs bloom, and QBFT-related `extraData`.

The observed block had:

```text
transactions = []
gasUsed       = 0x0
```

This was an empty QBFT block.

**Lesson:** an empty block is still a valid block. In PoA/QBFT context, the `miner` field identifies the proposer rather than a traditional proof-of-work miner.

## 9. `newHeads` vs `logs`

### `newHeads`

Answers:

> Has a new block been observed?

Useful for block-driven processing, indexing, chain-progress monitoring, and block-based reconciliation.

### `logs`

Answers:

> Has a matching smart-contract event been emitted?

Example:

```solidity
event AssetTransferred(
    uint256 assetId,
    address from,
    address to,
    uint256 quantity
);
```

A tokenized-asset application can subscribe to matching logs.

**Important:** not every smart-contract state change creates a log. Logs exist when the contract explicitly emits an event.

## 10. Submission vs Observation

A tokenized-asset transaction can follow:

```text
Submit transaction
       |
       v
     txHash
       |
       v
Transaction processed
       |
       v
Block committed
       |
       v
Contract execution
       |
       v
Event emitted
       |
       v
WebSocket `logs` notification
```

| Mechanism | Meaning |
|---|---|
| `eth_sendRawTransaction` | Transaction submission path accepted the signed transaction and returned its identifier |
| `txHash` | Identifier for tracking |
| `newHeads` | A new block was observed |
| `logs` | A matching contract event was observed |
| Transaction receipt | Result/details of a specific transaction |
| `receipt.status` | EVM execution result |
| Business reconciliation | Whether blockchain activity matches the expected business operation |

## 11. WebSocket Failure and Reconciliation

Scenario:
1. Application submits a token-transfer transaction.
2. Receives `txHash`.
3. Receives an `AssetTransferred` WebSocket event.
4. WebSocket connection drops.
5. Application restarts.

Correct recovery:

```text
Reconnect
    |
    v
Use persisted txHash
    |
    v
Query blockchain
    |
    +--> Transaction receipt
    +--> Receipt status
    +--> Contract logs
    +--> Block information
    +--> Expected transaction details
    |
    v
Business reconciliation
    |
    v
CONFIRMED / FAILED / UNKNOWN / HOLD
```

A WebSocket notification is not permanent proof of business settlement. WebSocket delivery is transient; the application must recover using durable transaction identifiers and authoritative blockchain queries.

## 12. Payment Reconciliation Pattern

```text
INITIATED
    ↓
APPROVED
    ↓
SIGNED
    ↓
SUBMITTED
    ↓
PENDING
    ↓
+--------------------------+
|                          |
v                          v
CONFIRMED                UNKNOWN
                            |
                            v
                     RECONCILIATION
                            |
                 +----------+----------+
                 |                     |
                 v                     v
            SAFE_TO_RETRY             HOLD
```

A WebSocket outage should not automatically make a transaction `FAILED`. Likewise, successful transaction submission should not automatically make it `CONFIRMED`.

## 13. Tokenized-Asset Business Reconciliation

Example:

```text
Expected quantity: 120
Actual event:      100
```

Even with:

```text
receipt.status = 0x1
```

the business transaction should not automatically be marked settled.

Correct treatment:

```text
On-chain execution successful
        +
Business data mismatch
        ↓
Reconciliation exception
        ↓
HOLD / INVESTIGATE
```

Automatic compensation or resubmission requires explicit business controls because it can create duplicate or unintended asset movements.

## 14. Production Application Architecture

```text
                    +----------------------+
                    |    Business App      |
                    | Payments / Assets    |
                    +----------+-----------+
                               |
                         HTTPS / API
                               |
                    +----------v-----------+
                    |    RPC / API Layer   |
                    | AuthN/Z, TLS,        |
                    | Rate Limits, etc.    |
                    +----------+-----------+
                               |
                    +----------v-----------+
                    |    Besu RPC Nodes    |
                    | HTTP + WebSocket     |
                    +----------+-----------+
                               |
                         P2P networking
                               |
                    +----------v-----------+
                    |    Validator Layer   |
                    |        QBFT          |
                    +----------+-----------+
                               |
                         Blockchain
```

The business application should not directly access validator P2P networking. Application communication should flow through an RPC/API boundary. P2P is the blockchain-node networking plane.

## 15. Assessment

**Result: 6/7 correct on first attempt.**

The one missed question was the distinction between QBFT consensus and EVM execution for `status = 0x0`. The concept was corrected immediately.

Demonstrated capabilities:
- Explain the Besu transaction lifecycle.
- Distinguish transaction submission from block inclusion.
- Interpret transaction receipt status.
- Explain why `status=0x0` does not imply consensus failure.
- Configure and test Besu WebSocket RPC.
- Use `newHeads` subscriptions.
- Identify when `logs` is appropriate for contract-event monitoring.
- Distinguish WebSocket delivery from authoritative blockchain state.
- Design reconciliation after connection/application failure.
- Apply business-level validation to tokenized-asset transactions.
- Explain why applications should use an RPC/API layer rather than direct validator P2P access.

## 16. BCP Alignment

### Besu Core Concepts
- Node/application interaction
- RPC interfaces
- Transaction lifecycle
- Blockchain state and execution

### Networking
- HTTP RPC
- WebSocket RPC
- P2P vs RPC separation
- Application-facing node connectivity

### Transactions & Storage
- Transaction structure
- Nonce
- Transaction submission
- Receipts
- Transaction status
- Logs

### Execution Engine & Consensus
- Transaction execution after block commitment
- Distinction between consensus and EVM execution
- QBFT block production context

### Monitoring
- WebSocket subscriptions
- Block observation
- Event-driven monitoring
- Reconciliation after connectivity failure
- Operational health dimensions

## 17. Key Takeaways

1. A transaction hash is not proof of settlement.
2. Transaction submission, block inclusion, EVM execution, and business settlement are different states.
3. `status=0x0` can occur inside a valid QBFT block.
4. `newHeads` observes blocks; `logs` observes emitted contract events.
5. Not every state change produces a log.
6. WebSocket is a delivery mechanism, not the authoritative source of truth.
7. Persist transaction identifiers so application recovery can perform reconciliation.
8. On-chain success does not automatically equal business success.
9. Payment and tokenized-asset systems require explicit reconciliation and exception handling.
10. Production applications should use an RPC/API boundary rather than direct validator P2P connectivity.

## 18. GitHub Artifact

Recommended location:

```text
sessions/session-11/README.md
```

Suggested commit:

```text
docs: document session 11 json-rpc websocket monitoring
```

Root README progress entry:

```text
| [Session 11](sessions/session-11/README.md) | JSON-RPC, WebSocket & Event-Driven Transaction Monitoring | Complete |
```

Suggested root README commit:

```text
docs: update course progress for session 11
```

## 19. Session Completion

**Session 11 — JSON-RPC, WebSocket & Event-Driven Transaction Monitoring**

**Status: Complete**

The session establishes the application-integration foundation needed before moving deeper into smart-contract, tokenization, and enterprise Besu architecture.
