# Session 10 — Troubleshoot Connectivity, Ports & Node Discovery

**Phase:** Networking  
**Focus:** Connectivity troubleshooting, port-plane separation, node isolation and production diagnostic reasoning  
**Environment:** Windows 11 + Hyperledger Besu 26.8.0 + 4-validator QBFT network  
**Status:** Complete

---

## 1. Objective

Extend the P2P networking knowledge from Sessions 1–9 into a practical connectivity troubleshooting model.

This session deliberately avoided repeating topics already covered in Sessions 1–9, including:

- RPC vs P2P fundamentals
- P2P ports and RPC ports
- enodes
- static peers
- discovery fundamentals
- bootnode concepts
- `net_peerCount`
- TCP/socket inspection
- synchronization state
- blockchain progression

Instead, the focus was on:

- Separating RPC, P2P and monitoring planes
- Reasoning about firewall/network segmentation
- Distinguishing local node health from network connectivity
- Diagnosing the failure domain behind an application symptom
- Understanding the effect of validator isolation on payments and settlement

---

## 2. Port-Plane Architecture

The production-oriented separation established during the session was:

```text
Payment Application
        |
      HTTPS
        |
        v
   RPC Gateway
        |
      RPC
        |
        v
+-------------------+
| Besu RPC endpoint |
+-------------------+
        |
        | internal
        v
+-------------------+
| Validator network |
|  V1 <-> V2 <-> V3 |
|       QBFT        |
+-------------------+
```

### Port roles

| Port | Plane | Purpose |
|---:|---|---|
| `8546` | RPC / Application | JSON-RPC access |
| `30305` | P2P / Validator | Besu-to-Besu communication |
| `9545` | Operations / Monitoring | Prometheus metrics |

### Security principle

The payment application should not require direct access to validator P2P.

The preferred architecture is:

```text
Payment Application
        |
        v
Controlled RPC/API layer
        |
        v
Besu RPC
        |
        v
Validator P2P network
```

Validator P2P should remain inside the controlled validator network.

Metrics should similarly not be directly exposed to payment applications.

---

## 3. Firewall / Network Policy

The proposed production policy was:

| Source | Destination | Port | Policy |
|---|---|---:|---|
| Payment App | RPC Gateway | 443 | ALLOW |
| RPC Gateway | Besu RPC | Appropriate RPC port | ALLOW |
| Validator | Validator | P2P | ALLOW |
| Payment App | Validator P2P | P2P | DENY |
| Payment App | Validator Metrics | Metrics port | DENY |
| Internet | Validator P2P | P2P | DENY |
| Internet | Validator RPC | RPC | DENY |

The important architectural distinction is:

> Application-to-validator communication is through a controlled RPC/API path, not through the validator P2P network.

A production RPC/API gateway can additionally provide authentication, authorization, TLS, rate limiting and API-method controls.

---

## 4. Runtime Port Inspection

After restarting the nodes, the previous N1 process ID was no longer valid.

The old PID was replaced by a new N1 process:

```text
PID 6336
```

This reinforced an operational principle:

> Never hard-code a process ID in a production troubleshooting runbook. Resolve the current process dynamically.

The current N1 process was then inspected for listening sockets.

Observed:

```text
:::30305       Listen
127.0.0.1:8546 Listen
127.0.0.1:9545 Listen
```

Therefore:

- `30305` = P2P listener
- `8546` = RPC listener
- `9545` = metrics listener

The P2P listener was again bound to the IPv6 wildcard address `::`.

This reinforced the Session 9 lesson:

> Configuration tells you what you intended to run; runtime sockets tell you what is actually running.

---

## 5. Controlled Failure Exercise — Reasoning

A deliberate P2P isolation experiment was considered but not executed because the same failure behavior had already been demonstrated in Sessions 8–9.

The purpose of the exercise was instead tested through architectural reasoning.

Scenario:

> N1's P2P connectivity is blocked while RPC remains available.

Expected behavior:

### N1

- RPC can remain available.
- P2P peer count eventually falls to zero.
- N1 eventually stops receiving new blocks.
- N1 becomes progressively stale as the rest of the network advances.

### N2–N4

With four QBFT validators:

```text
N = 4
f = 1
quorum = 3
```

If N1 is isolated, N2–N4 still provide the required quorum.

Therefore the remaining validators can continue committing blocks.

### Payment application

A payment application may still be able to reach N1's RPC endpoint.

However:

> RPC availability does not imply successful blockchain settlement.

A signed transaction submitted through an isolated validator may not propagate to the validator network and therefore cannot be assumed to settle.

---

## 6. Failure-Domain Diagnosis

A production incident was considered:

```text
RPC request from payment application times out

N1 process        UP
N1 RPC :8546      UP
N1 P2P :30305     UP
N1 peer count     0
N1 sync           IN SYNC
N2–N4             UP
Blockchain        progressing
```

The architectural diagnosis was:

> Investigate N1's P2P connectivity/discovery path rather than immediately restarting N1 or changing QBFT configuration.

The evidence points to a node that is locally healthy but logically isolated from the validator network.

This is distinct from a network-wide QBFT failure.

---

## 7. Troubleshooting Hierarchy

The session reinforced the following operational sequence:

```text
Process
   ↓
RPC
   ↓
P2P Listener
   ↓
Peer Connectivity
   ↓
Synchronization
   ↓
Block Progress
   ↓
Consensus Health
```

The diagnostic principle is:

> Do not treat an application symptom as proof of the underlying failure domain.

For example:

```text
RPC timeout
    ≠
RPC process failure
```

and:

```text
Peer count = 0
    ≠
Besu process is down
```

and:

```text
RPC available
    ≠
Blockchain settlement available
```

---

## 8. Payment / Settlement Relevance

The session connected connectivity troubleshooting to the payment lifecycle.

### `eth_sendRawTransaction`

`eth_sendRawTransaction` is the JSON-RPC method used to submit an already cryptographically signed transaction to a Besu node.

Conceptually:

```text
Payment Application
       |
       | transaction intent
       v
Signing Service / HSM
       |
       | signed raw transaction
       v
   Besu RPC
       |
       | eth_sendRawTransaction
       v
Transaction processing
       |
       v
      P2P
       |
       v
      QBFT
       |
       v
Committed Block
       |
       v
Transaction Receipt
       |
       v
Business Reconciliation
       |
       v
     SETTLED
```

A successful `eth_sendRawTransaction` response returns a transaction hash / indicates acceptance of the signed transaction by the RPC node.

It does **not** by itself prove:

- Block inclusion
- Execution success
- Consensus finality
- Business settlement

Therefore:

> A transaction hash is not settlement evidence.

The payment application should reconcile the transaction using the transaction hash, receipt, block information and business-level payment identity.

---

## 9. Validator Isolation and Payment Risk

A validator can be:

- Process healthy
- RPC healthy
- P2P unhealthy
- Eventually out of sync

This creates an important risk:

```text
Node locally responsive
        ≠
Node connected to consensus network
        ≠
Transaction settled
```

A resilient payment architecture should therefore provide:

- Multiple RPC endpoints
- Validator redundancy
- P2P failure isolation
- QBFT fault tolerance
- Transaction-hash reconciliation
- Monitoring across RPC, P2P, synchronization and consensus
- Clear separation between transaction signing and validator infrastructure

---

## 10. Architectural Challenge Outcome

### Question 1

**A Besu node has `net_peerCount = 0`, but its RPC endpoint responds normally. Does that mean the node is down?**

Answer:

No.

The Besu process and RPC layer may be healthy while the node is isolated from the P2P network.

The node may receive RPC requests and process signed transactions locally, but it cannot independently reach network consensus while isolated.

---

### Question 2

**Four QBFT validators: one loses P2P connectivity completely. Can the other three continue committing blocks?**

Answer:

Yes.

For four validators:

```text
N = 4
f = 1
quorum = 3
```

The remaining three validators can maintain quorum and continue committing blocks, assuming they remain healthy and connected.

---

### Question 3

**A payment application receives a successful `eth_sendRawTransaction` response from an RPC endpoint whose validator subsequently becomes isolated. Is that response by itself proof that the payment settled?**

Answer:

No.

`eth_sendRawTransaction` submits an already signed transaction and returns its transaction hash when accepted by the RPC node.

It is not proof of block inclusion, execution success or business settlement.

Settlement requires subsequent blockchain evidence and business reconciliation.

---

## 11. BCP Alignment

### Networking — 26%

This session reinforced:

- RPC nodes
- Validator nodes
- Node networking
- Connectivity failures
- Discovery/peer failure diagnosis
- Network segmentation

### Monitoring — 8%

Applied:

- Runtime port inspection
- Process identification
- Peer-state reasoning
- Synchronization evidence
- Blockchain progress

### Execution Engine & Consensus — 8%

Applied:

- Relationship between P2P connectivity and QBFT
- Validator isolation
- Quorum requirements
- Consensus liveness

### Permissioning & Privacy — 10%

Applied:

- Network boundaries
- RPC/P2P separation
- Controlled validator connectivity
- Restricted operational endpoints

---

## 12. Session Assessment

I can now:

- Design a network security boundary between payment applications and Besu validators.
- Distinguish RPC, P2P and monitoring ports.
- Diagnose connectivity incidents by separating application symptoms from infrastructure failure domains.
- Identify when a validator is locally healthy but isolated from the blockchain network.
- Reason about the effect of validator isolation on QBFT quorum.
- Explain why P2P isolation of one validator does not necessarily stop the blockchain.
- Explain why RPC availability does not prove transaction settlement.
- Explain the role of `eth_sendRawTransaction` in the payment transaction lifecycle.
- Connect validator networking failures to payment/settlement risk.
- Build a layered Besu connectivity troubleshooting approach.

---

## 13. Capability Statement

After Session 10, I can:

> **Diagnose Besu connectivity incidents by separating RPC availability, P2P connectivity, synchronization and QBFT liveness, and assess how validator isolation affects payment transaction submission and settlement.**

---

## 14. Key Principle

> **A responsive node is not necessarily a connected validator, and an accepted transaction is not necessarily a settled payment.**

---

## 15. GitHub Artifact

Primary artifact:

```text
sessions/session-10/README.md
```

Suggested commit:

```text
docs: document session 10 connectivity troubleshooting
```

Root README progress entry:

```text
| [Session 10](sessions/session-10/README.md) | Troubleshoot Connectivity, Ports & Node Discovery | ✅ Complete |
```

Suggested root README commit:

```text
docs: update course progress for session 10
```

---

## 16. Next Session

**Session 11 — Besu RPC Architecture, Security & Production API Exposure**

Focus:

- HTTP JSON-RPC vs WebSocket
- RPC authentication and authorization
- TLS/mTLS
- API/method allow-listing
- RPC gateway architecture
- Load balancing and failover
- Payment application integration
- Production RPC security
