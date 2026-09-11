# Blockchain Architect — Zero to Hero

This repository documents my hands-on journey from blockchain fundamentals to enterprise **Blockchain Architect**.

The primary implementation platform is **Hyperledger Besu**, with practical experience across Ethereum, private blockchain networks, smart contracts, security, Kubernetes, OpenShift, AWS and production operations.

The capstone is an enterprise blockchain platform for **payments/settlement and tokenized assets**.

---

## Learning Approach

This is a hands-on, architecture-focused learning journey.

The goal is not to become only a Besu specialist. Besu is the primary implementation platform used to develop practical expertise across:

- Blockchain architecture
- Consensus
- Ethereum and EVM
- Smart contracts
- Networking
- Security
- Cloud architecture
- Kubernetes/OpenShift
- Observability and operations
- Enterprise governance
- Interoperability
- Production architecture
- Payments and tokenized assets

The repository contains reproducible configurations, lab artifacts and concise learning notes for each completed session.

---

# Course Progress

| Session | Topic | Status |
|---|---|---|
| Session 1 | Environment & Architecture Foundations | ✅ Complete |
| Session 2 | WSL2 & Linux Environment | ✅ Complete |
| Session 3 | Besu Runtime Forensics | ✅ Complete |
| Session 4 | Besu Node & JSON-RPC | ✅ Complete |
| [Session 5](sessions/session-05/README.md) | QBFT Private Network & First Transaction | ✅ Complete |
| [Session 6](sessions/session-06/README.md) | Multi-Node Besu Architecture: Topology, Failure & Consensus | ✅ Complete |

> **Note:** Detailed READMEs for Sessions 1–4 will be added as those sessions are revisited and documented.

> **Session 6:** Established resilient multi-node topology, QBFT failure tolerance, RPC/validator separation, signing isolation and enterprise failure-domain reasoning.
---

# Session 1 — Environment & Architecture Foundations

### Key Learnings

- Established the Windows/PowerShell, Git, VS Code and GitHub development baseline.
- Distinguished immutable application/configuration artifacts from mutable blockchain runtime state.
- Learned that blockchain databases are runtime state and should not be committed to Git.
- Established validator private keys as security-sensitive credentials that must never enter source control.
- Introduced production concerns around persistent storage, backups, secrets, HSM/KMS and operational recovery.

**Status:** ✅ Complete

---

# Session 2 — WSL2 & Linux Environment

### Key Learnings

- Established WSL2 with Ubuntu as the Linux execution environment.
- Learned that Windows and WSL2 are separate runtime environments.
- Cloned and synchronized the course repository in Linux.
- Established GitHub as the source of truth for source/configuration.
- Distinguished source-code synchronization from blockchain runtime-state synchronization.

**Status:** ✅ Complete

---

# Session 3 — Besu Runtime Forensics

### Key Learnings

- Inspected the Hyperledger Besu 26.8.0 installation and Java runtime.
- Understood the structure of the Besu distribution.
- Successfully started Besu using an isolated data path.
- Distinguished Besu binaries, mutable blockchain state and credentials.
- Diagnosed a Windows native-library startup issue instead of masking the failure.
- Established the architecture principle of immutable application artifacts plus persistent runtime state.

**Status:** ✅ Complete

---

# Session 4 — Besu Node & JSON-RPC

### Key Learnings

- Built the Besu node mental model:

  **RPC → Transaction Pool → EVM → Consensus → Storage/P2P**

- Distinguished application-facing RPC from node-to-node P2P networking.
- Understood HTTP JSON-RPC and WebSocket interfaces.
- Distinguished chain ID from P2P network ID.
- Learned the anatomy of an Ethereum transaction.
- Understood nonce as a transaction sequence mechanism rather than a timestamp.
- Understood that private keys are used to sign transactions and do not need to be sent to Besu.
- Used real JSON-RPC calls to inspect client version, block height, chain ID, blocks, accounts and balances.
- Established the security principle that RPC exposure requires defense in depth.

**Status:** ✅ Complete

---

# Session 5 — QBFT Private Network & First Transaction

### Key Learnings

- Built a four-validator **QBFT private blockchain** using Hyperledger Besu.
- Learned how genesis defines blockchain identity and initial protocol configuration.
- Generated validator identities and understood validator key management.
- Configured four Besu nodes with static P2P topology.
- Understood QBFT quorum and Byzantine fault tolerance.
- Learned that four validators provide tolerance for one validator failure under the QBFT model.
- Distinguished proposer responsibility from collective consensus.
- Diagnosed and fixed the EIP-155 transaction compatibility issue by adding `berlinBlock: 0` to genesis.
- Rebuilt the network correctly after changing immutable genesis configuration.
- Demonstrated blockchain persistence across shutdown and restart.
- Created and cryptographically signed a real transaction outside Besu.
- Submitted the signed transaction through `eth_sendRawTransaction`.
- Verified transaction inclusion, receipt, gas usage and account balances.
- Distinguished transaction validation failure from EVM execution failure.
- Learned why empty blocks can be produced and the resource/latency trade-off of block period configuration.
- Distinguished QBFT block production and consensus from Proof-of-Work mining.
- Established the principle that each validator maintains its own local blockchain/state while independently validating and executing the agreed transaction sequence.

### Detailed Session 5 Lab

The complete Session 5 learning notes, rebuild procedure, commands, expected outputs, architecture explanations and troubleshooting guide are available here:

**[Session 5 — QBFT Private Network & First Transaction](sessions/session-05/README.md)**

**Status:** ✅ Complete

---

# Current Architecture Milestone

At the end of Session 6, the practical lab architecture is:

```text
                     Enterprise Application
                              |
                           JSON-RPC
                              |
                              v
                     +----------------+
                     |   Besu Node    |
                     +-------+--------+
                             |
                    Transaction Pool
                             |
                             v
                       QBFT Proposer
                             |
                       Candidate Block
                             |
             +---------------+---------------+
             |               |               |
             v               v               v
          Validator       Validator       Validator
          Node 2          Node 3          Node 4
             |               |               |
             +---------------+---------------+
                             |
                       QBFT Consensus
                             |
                         Quorum >= 3
                             |
                             v
                     Committed Blockchain
                             |
                             v
                    Local State on Nodes
```

The next major conceptual step is understanding **how independent validator nodes execute the same transactions and converge on exactly the same blockchain state**.

---

# Security Principles

The repository intentionally excludes:

- Validator private keys
- Transaction account private keys
- Blockchain runtime databases
- Besu runtime state
- Logs
- Local dependency directories

Source control should contain **reproducible configuration and documentation**, not credentials or mutable runtime state.

---

# Long-Term Capstone

The course will progressively build toward an enterprise blockchain architecture supporting:

- Payments and settlement
- Tokenized assets
- Enterprise identity
- Permissioning
- Smart contracts
- Secure transaction processing
- Cloud deployment
- Kubernetes/OpenShift deployment
- Observability
- High availability
- Disaster recovery
- Governance
- Interoperability
- Production operations

The final objective is to demonstrate the ability to **design, justify, deploy and operate an enterprise-grade blockchain platform**, rather than simply operate a blockchain node.

---

## Repository Philosophy

> **Learn → Build → Validate → Document → Commit → Explain**

Every major learning milestone should leave behind a reproducible technical artifact and a concise explanation of the architectural reasoning behind it.