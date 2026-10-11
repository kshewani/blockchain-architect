# Session 12 --- Solidity & EVM Fundamentals for Besu

**Program:** Blockchain Architect --- Six-Month Program\
**Phase:** Smart Contracts\
**Environment:** Windows 11, Hyperledger Besu 26.8.0, local QBFT network

## 1. Learning objectives

-   Explain Solidity source, ABI, creation bytecode, and runtime
    bytecode.
-   Diagnose compiler/EVM fork incompatibility.
-   Deploy and interact with Solidity contracts on Besu.
-   Distinguish `eth_call` from state-changing transactions.
-   Inspect receipts, persistent storage, runtime code, and emitted
    events.
-   Explain why successful EVM execution alone does not prove business
    settlement completion.

## 2. Environment

Lab workspace: `<session-12-lab-root>`\
Course repository:
`<repository-root>`\
Node.js: `v20.11.0`\
Solidity compiler: `solcjs 0.8.37+commit.f401782d.Emscripten.clang`\
ethers.js: `6.17.0`\
Besu RPC: `http://127.0.0.1:8546`

The development account file is stored outside the repository at
`<external-lab-secrets>/dev-account.json`.

**Security:** never commit the account file, private keys, credentials,
`.env` files, runtime blockchain data, or node databases.

## 3. V1 --- PaymentLedger

Source: `PaymentLedger.sol`

``` solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.37;

contract PaymentLedger {
    uint256 public total;

    function record(uint256 amount) public {
        total = total + amount;
    }
}
```

### Observed results

-   Contract address: `0x8Ed27fBC0e90acC69e9b9942BaD4C0c65B6c41E6`
-   Deployment transaction:
    `0xc471a859735cb3cb4de1eff41d36c5377622148bd81bb34f571cd9ce7023a803`
-   `total()` initially returned `0`.
-   `record(100)` transaction:
    `0xa2e0aa5cf116ed03b78ed49713960a0afb35e59253203bdb8ce729763da33c70`
-   Receipt block: `48711`; status: `1`; gas used: `43890`
-   After inclusion, `total()` returned `100`.
-   `eth_getCode` returned 445 bytes of runtime code; compiled creation
    bytecode was 476 bytes.

These block numbers and hashes are evidence from this lab run; future
runs will differ.

## 4. Compiler/EVM compatibility incident

The first deployment attempt failed during gas estimation with
`Invalid opcode: 0x5f`.

The network genesis activates Berlin with `berlinBlock: 0`. The
compiler's default target generated `PUSH0` (`0x5f`), introduced after
Berlin, so the Berlin EVM could not execute it.

**Resolution:** compile using Solidity Standard JSON input with:

``` json
{
  "settings": {
    "evmVersion": "berlin"
  }
}
```

The Berlin-targeted bytecode deployed successfully without changing Besu
or genesis.

**Architecture lesson:** maintain a tested compatibility matrix between
compiler version, EVM target, and the chain's active protocol fork. The
compiler warns that targeting pre-London EVM versions is deprecated;
Berlin is used here to match this lab network, not as a production
recommendation.

## 5. Core EVM concepts

-   **ABI:** describes callable functions, arguments, outputs,
    mutability, and events. Applications use it to encode calls and
    decode results/logs.
-   **Creation bytecode:** executes during deployment, initializes the
    contract, and returns runtime code.
-   **Runtime bytecode:** code stored at the contract address and
    executed for subsequent interactions.
-   **`eth_call`:** reads state without submitting a state-changing
    transaction. `total()` is a `view` function.
-   **State-changing transaction:** `record(100)` requires a
    transaction, gas, and block inclusion to persist its state change.
-   **Receipt status `1`:** indicates successful EVM execution, not
    proof that a wider payment or settlement process is complete.

Conceptual lifecycle:

``` text
Application prepares and signs transaction
        ↓
Transaction submitted to Besu
        ↓
QBFT validators process/commit a block
        ↓
Transactions execute during block processing
        ↓
Contract state changes and logs are produced
        ↓
Application inspects receipt and logs
```

Execution, validation, and block commitment are coupled at protocol
level; this is a conceptual application-level view.

## 6. V2 --- PaymentLedgerV2 and events

Source: `PaymentLedgerV2.sol`

``` solidity
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
```

### Event design

-   `paymentId` is indexed for filtering logs by business payment.
-   `sender` is indexed for queries by originating account.
-   `amount` and `timestamp` are non-indexed event data.
-   Logs also carry transaction/block metadata, including transaction
    hash, block number, transaction index, log index, and contract
    address.
-   A `bytes32` payment ID is fixed-size. The off-chain system must
    define a consistent encoding or hashing rule for business
    identifiers.

### Observed deployment and event test

-   Contract address: `0xdf32842F957c117585429D6838Dd8Cf3F91B9081`
-   Deployment transaction:
    `0x62eb96dcb0060957d7f3549c9f8bd3ee14f783d81e8ccb87333a1c4aa0ee15b2`
-   Deployment receipt status: `1`; block: `52990`

Test call: - Payment ID: `PAYMENT-2026-0001` - Sender:
`0xd91C060B071F5aF12C3756EA2ba2288e7C154F51` - Amount: `250`

Observed transaction: - Hash:
`0x5ec05c5a9a421ea21c6d33091e427c62a5ec8e0c71fbb02c538d64b3bca4449b` -
Receipt status: `1`; block: `53071` - Decoded event: `PaymentRecorded` -
Decoded payment ID: `PAYMENT-2026-0001` - Decoded sender:
`0xd91C060B071F5aF12C3756EA2ba2288e7C154F51` - Decoded amount: `250` -
Timestamp: `1791707089` - Final `total`: `250`

Future runs will produce different timestamps, blocks, transaction
hashes, and contract addresses.

## 7. Event-driven payment monitoring

A production consumer should validate more than receipt status. At
minimum, check:

1.  Expected contract address and event signature.
2.  Business `paymentId`.
3.  Sender and amount against the business payment record.
4.  Receipt execution status.
5.  Block inclusion and the chain's confirmation/finality policy.
6.  Duplicate delivery/idempotency and reconnect/reorganization
    handling.
7.  Reconciliation with the business ledger or settlement workflow.

WebSocket events are notifications, not a durable queue. After a
disconnect, reconnect and reconcile from a known block/log checkpoint
using receipts and logs. Events exist only when contract code emits
them.

For tokenized assets, apply the same pattern to asset ID, sender,
recipient, quantity, and business settlement/payment ID.

## 8. Reproducing the lab

The workspace used `solc@0.8.37` and `ethers@6`. For a fresh workspace:

``` powershell
npm init -y
npm install --save-dev solc@0.8.37
npm install ethers@6
```

Compiler inputs `compiler-input.json` and `compiler-input-v2.json` use
Standard JSON with `evmVersion` set to `berlin`.

Compile using UTF-8 output in PowerShell:

``` powershell
Get-Content compiler-input.json -Raw | npx solcjs --standard-json | Set-Content -Encoding utf8 compiler-output.json
Get-Content compiler-input-v2.json -Raw | npx solcjs --standard-json | Set-Content -Encoding utf8 compiler-output-v2.json
```

PowerShell's default redirection previously wrote UTF-16 output, which
broke Node's UTF-8 JSON parser. `solcjs` also prints an informational
SMT diagnostic before the JSON; the extraction scripts locate the first
`{` before parsing.

Scripts: - `deploy.js` --- deploys V1. - `read-contract.js` --- reads V1
`total()`. - `extract-artifacts.js` --- extracts V1 ABI and bytecode. -
`deploy-v2.js` --- deploys V2 and reports receipt details. -
`extract-v2.js` --- extracts V2 ABI and bytecode. - `interact-v2.js` ---
calls V2 `record()` and decodes its event.

Scripts use local RPC and filesystem paths. Verify and update these
deliberately for other environments. Keep private keys outside the
repository.

## 9. Recommended GitHub contents

``` text
sessions/session-12/
├── README.md
├── PaymentLedger.sol
├── PaymentLedgerV2.sol
├── compiler-input.json
├── compiler-input-v2.json
├── deploy.js
├── deploy-v2.js
├── extract-artifacts.js
├── extract-v2.js
├── read-contract.js
└── interact-v2.js
```

Generated compiler outputs and ABI/bytecode can be regenerated, so keep
them out of Git unless there's a specific reason to version them. Do not
commit private keys, `dev-account.json`, runtime data, `.env`, or
credentials.

Consider including `package.json` and `package-lock.json` if the
repository should reproduce the JavaScript tooling with pinned
dependencies; review their metadata and dependency versions first.

Suggested commits:

``` text
docs: document session 12 solidity and evm fundamentals
docs: update course progress for session 12
```

## 10. Besu Certified Professional relevance

This session supports the course's current mapping to: - **Execution
Engine & Consensus:** EVM execution and transaction processing. -
**Transactions & Storage:** transactions, gas, contract account state,
persistent storage. - **Monitoring:** receipts, logs, and event-driven
observation.

This is a practical learning mapping, not a claim that every exercise is
an official exam objective.

## 11. Session outcome

The learner can compile, deploy, inspect, and interact with a Solidity
contract on Besu; diagnose compiler/EVM fork mismatch; inspect
transaction receipts and persistent state; and emit/decode events for
off-chain payment monitoring.

**Key principle:** successful EVM execution is necessary but not
sufficient for business settlement completion. Validate the event,
correlate it to the business payment, apply confirmation/finality
policy, and reconcile the business workflow.
