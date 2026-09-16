# Session 8 — QBFT Validator Operations: Recovery, Isolation & Failure Runbooks

## Objective

Move from understanding QBFT fault tolerance to being able to **diagnose, recover, and operate a validator without unnecessarily disrupting the network**.

The session focused on:

- Validator outage and recovery
- Persistent blockchain state
- P2P connectivity and synchronization
- QBFT quorum and liveness boundaries
- Failure diagnosis using logs and metrics
- Network isolation troubleshooting
- Production validator recovery principles
- Payment transaction reconciliation after RPC failure

---

## 1. Baseline Network

The lab used the existing four-validator QBFT network from Session 5/6.

| Validator | P2P | RPC | Role |
|---|---:|---:|---|
| N1 | 30305 | 8546 | Validator |
| N2 | 30306 | 8547 | Validator |
| N3 | 30307 | 8548 | Validator |
| N4 | 30308 | 8549 | Validator |

The network operates with:

```text
Validators = 4
f = floor((4-1)/3) = 1
QBFT quorum = 3
```

Therefore:

- 4 validators → normal operation
- 3 validators → consensus can continue
- 2 validators → quorum unavailable
- 1 validator → quorum unavailable

---

# 2. Controlled Validator Outage

N1 was stopped while N2, N3 and N4 remained operational.

Observed:

- N2 peer count → 2
- N3/N4 remained connected
- Block height continued increasing

This demonstrated that a single validator failure does not stop a four-validator QBFT network because the remaining three validators retain quorum.

### Operational principle

> A validator failure is not automatically a blockchain failure.

The first question after a validator failure should be:

> **Does the remaining validator set still have quorum and consensus liveness?**

---

# 3. Validator Recovery

After N1 was stopped, its data directory was inspected.

Important persisted components included:

```text
caches/
database/
DATABASE_METADATA.json
key
VERSION_METADATA.json
```

The blockchain database remained after the Besu process was stopped.

N1 was restarted using its existing configuration and data directory.

The recovery logs demonstrated:

```text
Existing database detected
        ↓
QBFT initial synchronization
        ↓
Node out of sync
        ↓
Transaction handling disabled
        ↓
Full synchronization
        ↓
Node in sync
        ↓
Transaction handling enabled
        ↓
BFT mining coordinator started
```

N1 subsequently re-established three peers and converged to the same blockchain height as the other validators.

### Recovery model

```text
Validator process fails
        ↓
Persistent blockchain state remains
        ↓
Validator restarts
        ↓
Reconnects to P2P network
        ↓
Determines local state is behind
        ↓
Synchronizes missing blocks/state
        ↓
Reaches network head
        ↓
Resumes transaction handling
        ↓
Resumes QBFT participation
```

### Key principle

> **A validator restart should normally recover from persisted state rather than recreate the blockchain.**

---

# 4. Transaction Handling During Recovery

Besu disabled transaction handling while the recovering validator was out of sync.

This reinforced an important distinction:

```text
Transaction accepted
        ≠
Transaction propagated
        ≠
Transaction included
        ≠
Transaction committed
        ≠
Business payment settled
```

A payment application must therefore not interpret an RPC response or transaction hash as proof of settlement.

---

# 5. Network Isolation Experiment

A temporary Windows firewall rule was used to attempt isolation of N1's P2P port.

Blocking the inbound listener on port 30305 did not isolate N1 because the node had already established **outbound P2P connections using ephemeral local ports**.

Inspection showed connections such as:

```text
N1 ephemeral port → N2:30306
N1 ephemeral port → N3:30307
N1 ephemeral port → N4:30308
```

Therefore, blocking N1's inbound listener alone was insufficient to isolate an already-connected node.

The temporary firewall rules were subsequently removed and the network returned to the clean baseline.

### Lesson

> **A P2P listener port is not the same thing as the complete network communication path.**

For production network isolation, firewall/security-group design must consider both inbound and outbound connectivity and the actual network topology.

---

# 6. Sequential Validator Failure

The four-validator network was then tested at the quorum boundary.

First:

```text
N1 ❌
N2 ✅
N3 ✅
N4 ✅
```

Three validators remained, and block production continued.

Then:

```text
N1 ❌
N2 ❌
N3 ✅
N4 ✅
```

Only two validators remained.

Observed:

- N3 peer count → 1
- Block height stopped advancing

This demonstrated the QBFT quorum boundary:

```text
4 validators
      ↓
3 required for quorum
      ↓
2 remaining
      ↓
NO QUORUM
      ↓
No new block commitment
```

Importantly, previously committed blockchain history remained intact.

### Key principle

> **Loss of quorum causes loss of liveness/availability, not automatic loss of already-committed ledger history.**

---

# 7. Recovery From Quorum Loss

N1 and N2 were restarted.

During recovery, logs showed synchronization activity, transaction-handling transitions and QBFT round changes.

The network eventually resumed block production and the validators converged again.

Temporary differences in QBFT round numbers were observed during recovery.

These differences were **not treated as proof of a specific root cause**.

The final diagnosis was:

> Consensus liveness was temporarily degraded following validator recovery, but the network subsequently self-recovered. The available logs and metrics were insufficient to establish a definitive root cause.

This distinction is important.

### Operational principle

> **Do not claim a root cause when the evidence only supports a symptom classification.**

---

# 8. Metrics-Based Diagnosis

N1 was instrumented with Prometheus metrics:

```text
--metrics-enabled
--metrics-protocol=PROMETHEUS
--metrics-host=127.0.0.1
--metrics-port=9545
```

The metrics endpoint confirmed:

- Synchronizer in sync
- Blockchain height advancing
- Three peers connected
- P2P connections established
- QBFT Proposal messages
- QBFT Prepare messages
- QBFT Commit messages
- QBFT RoundChange messages
- QBFT executor activity
- Zero rejected QBFT executor tasks

Representative metrics included:

```text
ethereum_peer_count = 3
ethereum_blockchain_height = 15773
ethereum_best_known_block_number = 15773
besu_synchronizer_in_sync = 1
```

P2P metrics also showed Proposal, Prepare, Commit and RoundChange traffic.

### Important observation

The console did not show every consensus message at INFO level, but the metrics demonstrated that QBFT consensus traffic was actually flowing.

Therefore:

> **Absence of detailed consensus messages in normal console logs does not prove absence of consensus activity.**

---

# 9. Failure Diagnosis Matrix

| Failure | Primary evidence | Expected effect |
|---|---|---|
| Validator/process failure | Process status, RPC availability, logs | Node unavailable |
| Synchronization failure | Sync metrics, block height | Node behind network |
| P2P failure | Peer count, connection metrics, P2P logs | Connectivity degraded |
| Quorum loss | Validator availability vs quorum requirement | New blocks cannot commit |
| Consensus-liveness degradation | Block height stagnant while nodes are up/synced/connected + QBFT evidence | Consensus progress temporarily stalls |

### Critical operational rule

> **Restart is a remediation action, not a diagnosis.**

Before restarting a distributed-system node, collect sufficient evidence to understand what failed unless immediate business recovery requires otherwise.

---

# 10. Production Validator Recovery Runbook

For a production validator failure:

### Step 1 — Establish impact

Determine:

- How many validators are unavailable?
- Is quorum still available?
- Are blocks still being committed?
- Are payment transactions being confirmed?

### Step 2 — Preserve evidence

Before restarting where practical:

- Capture logs
- Capture metrics
- Capture peer count
- Capture block height
- Capture synchronization state
- Capture relevant infrastructure events

### Step 3 — Protect the healthy quorum

Do **not** restart healthy validators unnecessarily.

For example, with seven validators:

```text
N = 7
f = 2
quorum = 5
```

If two fail:

```text
5 healthy validators remain
        ↓
quorum maintained
        ↓
network can continue
```

Restarting the remaining five would introduce unnecessary operational risk.

### Step 4 — Recover failed validators individually

Restart one failed validator at a time.

Verify:

- P2P connectivity
- synchronization
- block-height convergence
- transaction handling
- QBFT participation

### Step 5 — Confirm recovery

A validator should not be considered recovered merely because its process is running.

Recovery should mean:

```text
Process healthy
      +
P2P connected
      +
In sync
      +
Consensus participation
      +
Transaction handling enabled
```

---

# 11. Payment / Settlement Failure Scenario

A payment application submits a signed transaction:

```text
Payment App
     ↓
Signing Service / HSM
     ↓
Signed transaction
     ↓
N1 RPC
     ↓
QBFT network
```

N1 returns:

```text
Transaction hash = 0xABC
```

Immediately afterward, N1 crashes.

The critical lesson is:

> **The transaction hash confirms RPC acceptance, not settlement.**

The application must not blindly submit another payment.

---

# 12. RPC-Based Reconciliation

There is no single `reconcileTransaction` RPC.

Reconciliation is an **application-level workflow built using several Ethereum JSON-RPC methods**.

### Transaction discovery

```text
eth_getTransactionByHash
```

Query a healthy RPC node for the original transaction hash.

Possible outcomes:

```text
Transaction found
       ↓
Inspect blockNumber
       ↓
If included → obtain receipt
```

or:

```text
Transaction not found
       ↓
Do NOT immediately conclude failure
       ↓
Query other RPC nodes
       ↓
Investigate sender nonce
       ↓
Look for conflicting/replacement transaction
```

### Receipt

```text
eth_getTransactionReceipt
```

This is used when there is evidence of transaction inclusion.

Typical outcomes:

```text
status = 0x1
    ↓
Execution successful
```

or:

```text
status = 0x0
    ↓
Transaction included but execution reverted
```

If the transaction has not been included, the receipt can be `null`.

Therefore:

> **`eth_getTransactionReceipt` is an inclusion/status check, not a transaction-discovery mechanism.**

### Nonce investigation

```text
eth_getTransactionCount
```

The application can inspect the sender's account nonce.

However:

> **Nonce consumption alone is not proof that the intended payment succeeded.**

If expected nonce 17 has been consumed, the application must determine **which transaction consumed nonce 17**.

---

# 13. Payment Reconciliation State Machine

A production payment service should explicitly support uncertainty:

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
 ┌──────────────┬──────────────┬─────────────┐
 ↓              ↓              ↓
CONFIRMED     FAILED        UNKNOWN
                              ↓
                        RECONCILIATION
                              ↓
                     SAFE TO RETRY / HOLD
```

### Critical principle

> **Unknown is a valid operational state.**

Absence of a transaction receipt does not automatically mean failure.

Absence of a transaction from one RPC node does not automatically mean failure.

An RPC failure does not automatically justify resubmission.

---

# 14. Business Payment vs Blockchain Transaction

A payment application should maintain its own business-level correlation.

Example:

```text
Payment ID: PAY-12345
Amount: ₹10 Cr
Sender
Beneficiary
Original TX hash: 0xABC
Expected nonce: 17
Settling TX hash
Block number
Blockchain status
Reconciliation status
```

This is important because:

> **Blockchain transaction identity is not the same as business payment identity.**

For example:

```text
PAY-12345
    │
    ├── 0xABC → not found
    │
    └── 0xXYZ → nonce 17
                  │
                  ├── correct beneficiary
                  ├── correct amount
                  ├── authorized
                  ├── committed
                  └── receipt status = 1
```

The application can then reconcile the business payment against `0xXYZ`.

It should not simply label `0xXYZ` a duplicate because the amount is identical; it must establish the business correlation and authorization.

---

# 15. Key Architecture Principles Learned

### Principle 1

**Node availability ≠ blockchain availability**

A node can be healthy while the network lacks consensus quorum.

### Principle 2

**Quorum determines consensus availability**

For QBFT:

```text
N = 3f + 1
```

and quorum is required to commit new blocks.

### Principle 3

**Restart is remediation, not diagnosis**

Collect evidence before disruptive recovery whenever practical.

### Principle 4

**Persistent state enables validator recovery**

A restarted validator can synchronize from its existing local blockchain state.

### Principle 5

**Transaction hash ≠ settlement**

A successful RPC response only establishes an earlier stage in the transaction lifecycle.

### Principle 6

**Nonce ≠ business outcome**

Nonce analysis helps reconciliation but cannot independently prove payment settlement.

### Principle 7

**Unknown must be handled explicitly**

Payment systems require reconciliation workflows for infrastructure-induced uncertainty.

### Principle 8

**Blockchain integrity does not replace payment reconciliation**

The application still needs:

- Idempotency
- Transaction correlation
- Reconciliation
- Exception handling
- Retry controls
- Duplicate-payment protection

---

# 16. BCP Alignment

Session 8 reinforced the following BCP domains:

| BCP Domain | Application |
|---|---|
| Networking — 26% | P2P connectivity, validator topology, node recovery |
| Execution Engine & Consensus — 8% | QBFT quorum, liveness, validator participation |
| Monitoring — 8% | Metrics, logs, peer and synchronization diagnosis |
| Permissioning & Privacy — 10% | Validator/network operational boundaries |
| Transactions & Storage — 14% | Transaction lifecycle, nonce, persistent blockchain state |

---

# 17. Session 8 Capability Statement

After this session, I can:

- Diagnose a Besu validator outage.
- Explain validator recovery from persisted state.
- Distinguish process failure, synchronization failure, P2P failure, quorum loss and consensus-liveness degradation.
- Use Besu metrics and logs as operational evidence.
- Explain why unnecessary validator restarts can increase operational risk.
- Design a validator recovery runbook.
- Explain the difference between transaction acceptance and settlement.
- Design a multi-RPC transaction reconciliation workflow.
- Use transaction hash, receipt, block and nonce information as reconciliation evidence.
- Design payment-state handling for blockchain uncertainty.
- Explain duplicate-payment risk in an enterprise settlement architecture.

---

## Final Session 8 Principle

> **A production blockchain architect must design not only for successful transactions, but also for uncertainty.**

A resilient payment architecture assumes that infrastructure can fail **after submission but before business confirmation**.

The architecture must therefore answer:

> **“How do I prove what happened before I take the next financial action?”**

That is the foundation of safe blockchain operations for payments and tokenized assets.