# Session 6 — Multi-Node Besu Architecture: Topology, Failure & Consensus

## Objective

Evaluate whether a working multi-node Besu/QBFT network is also architecturally resilient.

This session focused on:

- Validator topology
- P2P connectivity
- QBFT quorum and failure tolerance
- Failure-domain design
- RPC/application separation
- Transaction-signing isolation
- Consortium network security
- Enterprise production topology

---

## Starting Point

Session 5 established a working four-validator Hyperledger Besu private network using QBFT.

The network had:

- 4 validators
- QBFT consensus
- Custom genesis
- Chain ID 2026
- JSON-RPC endpoints
- P2P connectivity
- Static peer configuration
- Successful signed transaction
- Block and receipt verification

The objective in Session 6 was not to rebuild the network, but to test whether its architecture remained resilient when individual nodes failed.

---

## 1. Initial Topology Failure

The original topology relied too heavily on Node 1 for connectivity.

When Node 1 was stopped:

- Node 1 became unavailable.
- Node 2 remained connected to Node 3.
- Node 4 became isolated.
- Only two validators could communicate with each other.
- No new QBFT blocks were produced.

### Key Lesson

Validator count alone does not provide fault tolerance.

Consensus resilience depends on:

**Validator count + quorum + network connectivity + failure-domain design**

A validator that is alive but partitioned from the other validators cannot contribute effectively to consensus.

---

## 2. Topology Redesign

The four-validator network was redesigned as a full-mesh P2P topology.

Each validator was configured with the other three validators as static peers.

Conceptually:

```text
        Node 1
       /  |  \
      /   |   \
   Node 2--+--Node 3
      \   |   /
       \  |  /
        Node 4
```

For four validators, this creates six bidirectional peer relationships.

### Why Full Mesh Was Selected

For a small four-validator enterprise/consortium network, full mesh provides:

- Multiple communication paths
- No single validator acting as a connectivity hub
- Better resilience to individual node failure
- Simple operational reasoning
- Straightforward troubleshooting

However, full mesh does not scale efficiently because the number of pairwise relationships grows approximately as:

```text
N × (N - 1) / 2
```

Therefore, larger networks require deliberate topology and peer-management strategies.

---

## 3. Resilience Test

Node 1 was stopped after implementing the full-mesh topology.

Before the failure, the four validators were connected.

After Node 1 was stopped:

- Node 2 retained two validator peers.
- Node 3 retained two validator peers.
- Node 4 retained two validator peers.
- The remaining three validators continued producing blocks.

Observed block heights continued advancing, demonstrating that the remaining validator set maintained QBFT liveness.

### Result

The redesigned topology successfully removed Node 1 as a connectivity dependency.

This demonstrated the difference between:

**A network that operates**

and

**A network that remains operational when a node fails.**

---

## 4. QBFT Quorum and Failure Tolerance

For a QBFT network with `N` validators:

```text
f = floor((N - 1) / 3)
```

where `f` is the maximum number of Byzantine validator failures tolerated while maintaining consensus.

For four validators:

```text
N = 4
f = 1
```

Therefore, the network can tolerate one validator failure while maintaining liveness, assuming the remaining validators can communicate.

For seven validators:

```text
N = 7
f = 2
```

The required quorum is five validators.

Therefore:

```text
7 validators - 2 failures = 5 remaining
```

Consensus can continue.

But:

```text
7 validators - 3 failures = 4 remaining
```

Four validators are insufficient for the required quorum of five.

### Architecture Lesson

Adding validators does not mean arbitrary failure tolerance.

Validator count must be considered together with:

- QBFT quorum
- Network connectivity
- Failure domains
- Availability zones
- Organizational ownership
- Geographic distribution

---

## 5. Failure-Domain Reasoning

Validator placement must not concentrate too many validators in one failure domain.

For example, with seven validators:

```text
AZ1 = 3
AZ2 = 2
AZ3 = 2
```

Loss of AZ1 leaves four validators.

Because seven validators require five for quorum, the network loses liveness.

Therefore, validator distribution must be designed together with the intended failure scenario.

For twelve validators:

```text
AZ1 = 4
AZ2 = 4
AZ3 = 4
```

With:

```text
N = 12
f = 3
quorum = 7
```

Loss of one entire four-validator AZ leaves eight validators.

Therefore, the network can still maintain quorum.

### Key Principle

**Consensus resilience and infrastructure resilience must be designed together.**

---

## 6. RPC Layer vs Validator Layer

The application-facing RPC layer was separated conceptually from the validator layer.

Target architecture:

```text
Payment / Settlement Applications
              |
              v
       Load Balancer
              |
        +-----+-----+
        |           |
      RPC-1       RPC-2
        |           |
        +-----+-----+
              |
              v
       Besu Validator Layer
     +------+------+------+
     |      |      |      |
    V1     V2     V3     V4
     \      |      |     /
             QBFT
```

### RPC Layer Responsibilities

- Application connectivity
- Authentication and authorization
- TLS termination where appropriate
- Rate limiting
- API method allow-listing
- Request validation
- Operational monitoring
- Failover between RPC nodes

### Validator Layer Responsibilities

- Transaction validation
- Transaction pool processing
- EVM execution
- Block proposal
- QBFT consensus
- Blockchain state persistence
- Validator-to-validator communication

### Architectural Principle

**RPC exposure should not imply validator exposure.**

Applications should not require direct access to validator P2P ports.

---

## 7. Transaction Signing Architecture

Private transaction-signing keys should be isolated from:

- Application source code
- Git repositories
- RPC configuration
- Besu configuration files
- Developer workstations

A production architecture should use a dedicated signing control such as:

- HSM
- Cloud KMS
- Dedicated signing service integrated with protected key storage

Conceptually:

```text
Application
     |
     | Transaction Intent
     v
Signing Service
     |
     v
HSM / KMS
     |
     | Signed Transaction
     v
RPC Layer
     |
     v
Besu Network
```

### Important Distinction

Three different concepts were separated:

1. **Business authorization**
2. **Cryptographic transaction signing**
3. **QBFT validator consensus signatures**

They are related but are not the same control.

---

## 8. Transaction Lifecycle and Reconciliation

A production payment/settlement application should treat transaction submission as a state machine:

```text
INITIATED
    |
APPROVED
    |
SIGNED
    |
SUBMITTED
    |
PENDING
    |
+---+---+
|       |
v       v
CONFIRMED  FAILED
```

A critical lesson from the RPC failure scenario:

**Submission is not settlement.**

If an RPC node accepts a transaction but fails before the application receives confirmation, the application should reconcile using the transaction hash and blockchain state.

It should not blindly create another transaction with a new nonce, because this can introduce duplicate-payment risk.

---

## 9. Consortium Network Security

For a multi-institution enterprise blockchain:

```text
Institution A Network
        |
        | Required P2P
        |
Institution B Network
        |
        | Required P2P
        |
Institution C Network
```

Each institution should maintain its own:

- Network boundary
- Firewall/security controls
- Validator infrastructure
- Key-management controls
- Monitoring
- Operational ownership

Only the required validator-to-validator P2P communication should cross institutional boundaries.

RPC access should remain a separate security concern.

---

## 10. Enterprise Architecture Principles Demonstrated

### Principle 1 — Consensus Is Not Connectivity

A validator being part of the QBFT validator set does not guarantee that it can participate if network connectivity is lost.

### Principle 2 — Fault Tolerance Requires Communication

QBFT failure tolerance assumes the surviving validators can communicate.

### Principle 3 — Separate Application and Consensus Planes

Applications should interact through controlled RPC infrastructure rather than directly with validator P2P endpoints.

### Principle 4 — Protect Signing Keys Independently

Private keys should be managed through dedicated security controls rather than being treated as ordinary application configuration.

### Principle 5 — Design for Failure Domains

Validator placement must account for AZ, host, network, organizational and geographic failure domains.

### Principle 6 — Scale Topology Deliberately

Full mesh is reasonable for a small validator set but becomes increasingly expensive as validator count grows.

---

## BCP Alignment

This session reinforced the following Besu Certified Professional objectives:

| BCP Objective | Relevance |
|---|---|
| Networking | High |
| Execution Engine & Consensus | High |
| Monitoring | Medium |
| Permissioning & Privacy | Medium |
| Transactions & Storage | Medium |
| Besu Core Concepts | Medium |

The strongest alignment was with:

- Node networking
- Validator nodes
- Trusted private networks
- PoA/QBFT consensus
- Consensus failure tolerance
- Transaction flow
- Enterprise network architecture

---

## Architecture Capability Demonstrated

At the end of Session 6, the following capability was demonstrated:

> Evaluate a multi-node Besu/QBFT network not merely for whether it operates, but for whether its topology, quorum, network connectivity and failure-domain design provide the required enterprise resilience.

This includes the ability to reason about:

- Validator topology
- P2P connectivity
- QBFT quorum
- Validator failure
- Network partition
- Availability-zone failure
- RPC redundancy
- Signing-service isolation
- Consortium network boundaries
- Application-to-blockchain transaction flow

---

## Evidence

The practical evidence for this session includes:

- Four-validator QBFT private network
- Full-mesh static peer configuration
- Validator failure test
- Continued block production after Node 1 failure
- Peer-count verification
- Block-height verification
- RPC/validator separation design
- Failure-domain architecture analysis

The implementation artifacts from Session 5 remain the technical foundation for this session.

---

## Session Outcome

Session 6 established that a functional blockchain network is not automatically a resilient blockchain architecture.

The key architectural question is not:

> "Are all validators running?"

It is:

> "Can the surviving validator set communicate, achieve quorum, and continue operating when infrastructure fails?"

That distinction is fundamental to enterprise blockchain architecture.

---

## Next

Close the session by committing this documentation and updating the course progress index.

The next session should build on this architecture rather than rebuilding the same network.
