# Session 9 — Besu P2P Networking, Discovery & Peers

**Phase:** Networking  
**Focus:** P2P networking, discovery, peers and operational diagnostics  
**Environment:** Windows 11 + Hyperledger Besu 26.8.0 + 4-validator QBFT network  
**Status:** Complete

---

## 1. Objective

Understand how Besu nodes communicate with each other, how peers are established and discovered, and how to diagnose P2P problems without confusing them with RPC, synchronization or consensus failures.

The session used the existing 4-validator QBFT network rather than rebuilding it.

---

## 2. Core Architecture

### RPC vs P2P

**RPC**

```text
Application / Tool
       |
       v
     RPC
       |
       v
     Besu
```

RPC is the application-facing interface.

**P2P**

```text
Besu <----> Besu <----> Besu
```

P2P is the validator/full-node communication layer.

A payment application should normally access Besu through RPC. It should not require direct access to the validator P2P network.

### Architectural principle

> RPC connectivity and validator P2P connectivity are separate architectural planes.

---

## 3. Enode and Node Identity

An `enode://` URL identifies a Besu P2P node and contains:

- Node public-key identity
- P2P endpoint
- Host/IP
- P2P port

An Ethereum transaction account address is different from a P2P node identity.

The following must not be confused:

```text
P2P node identity  !=  Ethereum account address  !=  Transaction hash
```

---

## 4. P2P Configuration

Node 1:

```toml
p2p-host="127.0.0.1"
p2p-port=30305
static-nodes-file="C:/Kamlesh/besu-lab/session5-private-network/nodes/node1/static-nodes.json"
```

Node 1's static peer file contained the enodes for Nodes 2–4.

Static peers are explicitly configured peer targets.

They are different from:

- Bootnodes
- Dynamic peer discovery

These mechanisms are complementary rather than simple precedence layers.

---

## 5. Peer Discovery

Besu 26.8.0 reports:

```text
--discovery-enabled=<peerDiscoveryEnabled>
Enable P2P discovery (default: true)
```

Discovery allows nodes to dynamically find peer candidates.

### Static peers vs bootnodes

| Mechanism | Purpose |
|---|---|
| Static peers | Explicitly connect to known nodes |
| Bootnodes | Bootstrap the discovery process |
| Discovery | Dynamically identify/connect to peer candidates |

A bootnode is not intended to act as a traffic router.

Conceptually:

```text
             Bootnode
                |
          Peer information
                |
        +-------+-------+
        |               |
        v               v
       N1              N2
        ^               ^
        |               |
        +-------+-------+
                |
               N5
```

Once discovered, nodes establish their own P2P connections.

---

## 6. Bootnode Experiment

A standalone Besu bootnode was created on:

```text
127.0.0.1:30400
```

It generated its own P2P identity and enode.

The bootnode was configured to connect to Node 1 through a static peer relationship.

This demonstrated that a bootnode is itself a Besu P2P node; it is not a special network-routing appliance.

### N5 experiment

A fifth node was created as a **non-validator full node**:

```text
N5 P2P : 30405
N5 RPC : 8550
```

N5 used the same QBFT genesis as Nodes 1–4 but was not included in the initial validator set.

Therefore:

> Sharing the same genesis establishes the same blockchain configuration; it does not automatically make a node a validator.

### Windows/Besu 26.8.0 deviation

Attempting to configure the bootnode through `bootnodes` repeatedly produced:

```text
Illegal char <:> at index 5: enode://...
```

The same issue occurred when attempting the bootnode through both the TOML configuration and startup CLI in the Windows lab environment.

The experiment was intentionally stopped rather than replacing bootnode discovery with static peering.

This is recorded as a **lab/environment deviation**, not as a conclusion that Besu bootnodes do not support enode URLs.

---

## 7. Peer Count Is Not Consensus Health

Node 1 returned:

```text
net_peerCount = 0x4
```

This demonstrated four connected P2P peers.

However:

> Peer count proves connectivity, not validator health or consensus participation.

A node may have peers and still experience:

- Synchronization problems
- Consensus liveness problems
- Validator failures
- Application/RPC problems

Conversely, a temporary peer-count problem does not automatically mean the blockchain itself is unhealthy.

---

## 8. OS-Level P2P Diagnostics

Node 1's current Besu process was identified using its configuration path.

Current process:

```text
PID 18144
```

The actual listening sockets were:

```text
:::30305       Listen
127.0.0.1:8546 Listen
127.0.0.1:9545 Listen
```

The P2P listener was therefore actually bound to the IPv6 wildcard address `::`.

An earlier query restricted to:

```text
127.0.0.1:30305
```

returned no result.

This initially looked like a P2P listener failure, but inspection of all sockets owned by the Besu process showed that the P2P listener was healthy.

### Operational lesson

> Configuration tells you what you intended to run; runtime sockets tell you what is actually running.

---

## 9. P2P Metrics

Node 1's Prometheus metrics showed:

```text
besu_peers_connected_total 4.0
```

The metric provided additional evidence of peer connectivity.

The current-state peer count was independently confirmed through:

```text
net_peerCount = 0x4
```

Metrics should be interpreted according to their semantics; a metric labelled as a counter should not automatically be treated as a current-state gauge.

---

## 10. Synchronization and Blockchain Progress

Node 1 reported:

```text
besu_synchronizer_in_sync 1.0
```

Blockchain height was measured twice:

```text
28,530
28,540
```

The increase demonstrated that the blockchain was actively progressing.

Therefore, the node was not merely:

- Running
- Listening
- Connected
- Synchronized

It was also observing continued blockchain progress.

### Important distinction

> Synchronization is not the same as consensus liveness.

A complete operational diagnosis requires evidence across multiple layers.

---

## 11. P2P Troubleshooting Decision Tree

The operational diagnostic sequence developed during this session was:

```text
                Besu node issue?
                       |
                       v
              Is process running?
                 /           \
               NO             YES
               |               |
          Process failure   P2P listening?
                              /       \
                            NO         YES
                            |           |
                       Listener      Peer count
                       failure          |
                                      Sync?
                                    /      \
                                  NO        YES
                                  |          |
                             Sync issue   Block height
                                          progressing?
                                          /       \
                                        NO         YES
                                        |           |
                                  Investigate   P2P / consensus
                                  QBFT liveness     healthy
                                  and quorum
```

The core production principle is:

> Never restart a distributed-system node before collecting enough evidence to explain what failed, unless immediate business recovery requires otherwise.

---

## 12. Production Payment Architecture

For a payment/settlement network:

```text
Payment Application
        |
        v
   RPC Gateway
        |
        v
 Besu RPC / Node Layer
        |
        v
 Validator P2P Network
        |
        v
      QBFT
```

The application should not be directly exposed to the validator P2P network.

Security and operational controls should separate:

- Application/RPC access
- Validator P2P connectivity
- Consensus infrastructure
- Transaction signing infrastructure
- Monitoring and audit infrastructure

---

## 13. Failure-Diagnosis Principle

A useful production diagnostic hierarchy is:

```text
Process
   ↓
RPC
   ↓
P2P Listener
   ↓
Peers
   ↓
Synchronization
   ↓
Block Progress
   ↓
Consensus Health
```

Therefore:

> `RPC UP` does not mean `P2P healthy`.

> `Peers > 0` does not mean `Consensus healthy`.

> `IN SYNC` does not mean `Consensus currently progressing`.

> Block progression provides stronger evidence of liveness than a peer count alone.

---

## 14. Payment and Settlement Relevance

For enterprise payments, a P2P failure on one validator should not automatically become a payment-processing failure.

A resilient architecture should provide:

- Multiple RPC endpoints
- Validator redundancy
- P2P failure isolation
- Consensus fault tolerance
- Transaction-hash reconciliation
- Monitoring across RPC, P2P, synchronization and consensus
- Clear separation between application signing and validator infrastructure

A payment application should be able to distinguish:

```text
RPC failure
P2P failure
Validator failure
Consensus failure
Transaction failure
Business settlement failure
```

These are different failure domains and require different remediation.

---

## 15. BCP Alignment

This session primarily mapped to:

### Networking — 26%

- Node networking
- Discovery
- P2P connectivity
- Peer relationships
- PoA/private-network networking

### Monitoring — 8%

- Peer monitoring
- Synchronization monitoring
- Runtime metrics
- Operational diagnostics

### Execution Engine & Consensus — 8%

- Understanding the boundary between P2P connectivity and consensus participation
- Using blockchain progress as an operational liveness signal

### Permissioning & Privacy — 10%

- Network segmentation
- Separation of application/RPC and validator P2P planes
- Consortium network boundaries

---

## 16. Session Assessment

### Knowledge demonstrated

I can now:

- Explain RPC vs P2P architecture.
- Explain enode identity and its relationship to P2P networking.
- Distinguish Ethereum account identity from P2P node identity.
- Explain static peers, bootnodes and discovery.
- Explain why bootnodes do not act as blockchain traffic routers.
- Distinguish peer connectivity from consensus health.
- Diagnose a Besu node using process, socket, peer, sync and blockchain evidence.
- Interpret P2P-related Besu metrics.
- Build a layered P2P troubleshooting sequence.
- Apply P2P architecture to enterprise payment and settlement networks.
- Recognize when a Windows-specific environment issue should be documented rather than allowed to derail the architectural objective.

---

## 17. Capability Statement

After Session 9, I can:

> **Design and troubleshoot the P2P networking layer of a Besu-based enterprise blockchain, distinguish discovery and static peering mechanisms, and diagnose whether a node's problem is local process, transport, peer connectivity, synchronization or consensus-related.**

---

## 18. Key Principle

> **A connected node is not necessarily a healthy validator. Diagnose the layers independently.**

---

## 19. Next Session

**Session 10 — Besu RPC Architecture, Security & Production API Exposure**

Focus:

- RPC architecture
- HTTP vs WebSocket
- RPC authentication and authorization
- TLS/mTLS
- API/method allow-listing
- Network segmentation
- Load balancing and failover
- Payment application integration
- Production RPC security architecture
