# Session 7 — Consensus Fundamentals: PoA, IBFT & QBFT

**Phase:** Consensus  
**Status:** Complete  
**Primary Platform:** Hyperledger Besu 26.8.0  
**Consensus:** QBFT  
**Hands-on duration:** ~40–60 minutes

---

## 1. Session Objective

Develop a practical architectural understanding of Proof of Authority (PoA), IBFT, and QBFT, with emphasis on:

- Byzantine fault tolerance
- Quorum
- Safety vs. liveness
- Proposer vs. commit authority
- Transaction execution vs. block validity
- Validator-set management
- Genesis vs. runtime configuration
- Failure-domain and consortium architecture

The session intentionally used the existing four-validator QBFT network created in Session 5 rather than rebuilding infrastructure.

---

## 2. Session Deviations

The original learning plan was adjusted based on progress from Sessions 1–6.

### Multi-node network

The multi-node Besu network was already successfully built and tested in Session 5 and architecturally analyzed in Session 6.

**Decision:** Do not rebuild the network.

### Clique

Besu 26.8.0 reported:

> Clique Block Production (mining) is no longer supported.

The Clique production lab was therefore permanently skipped.

### IBFT

IBFT was covered conceptually rather than through a separate deployment lab.

**Reason:** The current Besu Certified Professional objectives require understanding PoA consensus mechanisms and comparison of consensus mechanisms, but a separate IBFT implementation lab was not necessary to achieve the learning objective.

QBFT remained the primary hands-on consensus implementation.

---

## 3. Consensus Mental Model

### Simple PoA

In a basic PoA model, authorized validators are trusted to produce blocks.

The security model depends heavily on:

- Validator identity
- Validator authorization
- Validator operational security
- Governance and institutional trust

A validator may have significant authority over block production.

### IBFT

IBFT introduces Byzantine fault-tolerant, quorum-based agreement between validators.

The key architectural improvement is that block commitment is no longer dependent on a single validator acting correctly.

### QBFT

QBFT provides Byzantine fault-tolerant consensus for private/consortium networks.

The critical distinction is:

> **A validator can propose a block, but it cannot commit the block unilaterally.**

Validators independently validate the proposed block and participate in the consensus process.

---

## 4. QBFT Fault Model

For a validator set of `N` nodes:

\[
N \geq 3f + 1
\]

where `f` is the maximum number of Byzantine faults tolerated under the model.

The commit quorum is:

\[
quorum = 2f + 1
\]

Examples:

| Validators | Byzantine faults tolerated | Quorum |
|---:|---:|---:|
| 4 | 1 | 3 |
| 5 | 1 | 3 |
| 6 | 1 | 3 |
| 7 | 2 | 5 |
| 8 | 2 | 5 |
| 9 | 2 | 5 |
| 10 | 3 | 7 |

Important observation:

> Adding a validator does not necessarily increase Byzantine fault tolerance. The validator count must cross the next `3f + 1` threshold.

For example, moving from 4 to 5 validators adds redundancy but does not increase `f` from 1 to 2. Seven validators are required to tolerate two Byzantine faults.

---

## 5. Safety vs. Liveness

A key Session 7 distinction was:

### Safety

The network should not commit conflicting or invalid blockchain state.

### Liveness

The network should continue making progress and committing new blocks.

QBFT prioritizes maintaining safety when quorum is unavailable.

For seven validators:

- Quorum = 5
- If only 4 validators remain operational, quorum is unavailable.
- The network should therefore stop normal consensus progress rather than independently commit potentially conflicting state.

This leads to an important enterprise principle:

> **Loss of quorum primarily causes loss of liveness; it does not mean the blockchain should abandon its safety guarantees.**

---

## 6. Network Partition Example

A seven-validator network was analyzed under this partition:

```text
Partition A: V1 V2 V3 V4 V5
Partition B: V6 V7
```

Partition A has five validators and can potentially achieve quorum.

Partition B has only two validators and cannot independently commit blocks.

This illustrates why BFT consensus does not simply allow every network partition to continue producing independent canonical blocks.

---

## 7. Proposer vs. Commit Authority

A proposer is responsible for proposing a block.

The proposer does not have unilateral authority to commit it.

Conceptually:

```text
Proposer
   |
   v
Proposed Block
   |
   +--> Validator independently validates
   +--> Validator independently executes
   +--> Validator participates in consensus
   |
   v
Required QBFT quorum
   |
   v
Committed Block
```

An invalid proposal cannot become canonical merely because it originated from the designated proposer.

### Architecture principle

> **Proposal authority ≠ commit authority.**

This is particularly important in financial networks where a compromised validator must not be able to unilaterally alter canonical state.

---

## 8. Transaction Execution vs. Block Validity

A transaction can be validly signed and included in a block while its smart-contract execution fails.

Example:

- Alice owns 50 TOKEN-X.
- Alice attempts to transfer 100 TOKEN-X.
- The transaction is validly signed.
- The contract executes.
- The contract's business logic detects insufficient balance.
- Execution reverts.
- Transaction receipt has `status = 0x0`.
- The transaction can remain part of the committed block.

Therefore:

> **Transaction execution failure does not necessarily make the block invalid.**

This gives the payment architecture an important state distinction:

```text
Initiated
   ↓
Approved
   ↓
Signed
   ↓
Submitted
   ↓
Included
   ↓
Execution successful ──> Confirmed
   │
   └── Execution reverted ──> Failed
```

**Inclusion is not settlement success.**

---

## 9. Genesis vs. Node Configuration

The live QBFT network demonstrated a clear separation between blockchain-wide protocol configuration and node-local operational configuration.

### Shared genesis

The current genesis contains:

```text
chainId                  = 2026
berlinBlock              = 0
qbft.blockperiodseconds  = 5
qbft.epochlength         = 30000
qbft.requesttimeoutseconds = 10
```

Genesis location:

```text
C:\Kamlesh\besu-lab\session5-private-network\qbft-network-files\genesis.json
```

### Node-local `config.toml`

Each node's configuration contains operational settings such as:

- Data path
- P2P port
- RPC port
- Node key location
- Static peers
- RPC APIs
- Logging and local behavior

Architecture principle:

> **Genesis = shared blockchain protocol contract.**

> **`config.toml` = node-specific operational configuration.**

---

## 10. Genesis Immutability and Network Changes

The genesis file establishes the initial blockchain configuration and state.

Editing `genesis.json` after the chain has started does not mutate the existing blockchain.

Changing foundational genesis properties can make an existing node database incompatible with the new chain definition.

Examples of high-risk changes include:

- `chainId`
- Consensus mechanism
- Initial validator configuration
- Initial allocation/state
- Historical fork activation parameters

Such changes should not be treated as ordinary runtime configuration changes.

For supported post-genesis changes, the appropriate Besu/QBFT network configuration or governance mechanism must be used, depending on the specific parameter.

### Important distinction

> **Chain incompatibility is not necessarily database corruption.**

The database may remain internally healthy while representing a chain initialized under a different genesis definition.

The Session 5 EIP-155 correction demonstrated this practically: the corrected genesis required fresh node data initialization rather than simply editing the existing database.

---

## 11. QBFT `extraData`

The QBFT genesis contains an `extraData` field.

The live genesis was inspected and produced:

```text
extraData length: 250
```

The hexadecimal structure contained the four validator addresses:

```text
0x1cd5c3366c355df102058132055116ac17dafd79
0x11af991db40f2490adf2b1927dc3cbcfe1c78c3a
0x4b0879143eda8e0a1e3740d02d32614611720fc7
0x7e0f2caafbc6e55a760aa0a5f018c6ed1d9be9e3
```

The `extraData` value is encoded as a larger hexadecimal structure rather than four human-readable addresses.

It contains validator identities and QBFT-specific structure.

It does **not** contain validator private keys.

### Security distinction

| Item | Role | Sensitive |
|---|---|---|
| Validator address | Public validator identity | No |
| Validator public key | Cryptographic identity material | Generally public |
| Validator private key | Signs validator messages | **Highly sensitive** |
| Genesis QBFT parameters | Shared protocol rules | No |
| RPC credentials | Node/API access control | Sensitive |

The initial validator set is established by genesis. Subsequent validator-set changes must use the supported live validator-management/configuration mechanism rather than editing genesis.

---

## 12. Live Proposer Rotation Evidence

The running four-validator QBFT network was inspected through Node1 RPC.

Latest observed block:

```text
Block Number : 12112
Block Hash   : 0x99e18aee2cbb992697b915b1349618faa203d8c17fbcb71565142694cf279073
Miner/Proposer: 0x7e0f2caafbc6e55a760aa0a5f018c6ed1d9be9e3
TX Count     : 0
```

The proposer address corresponds to Validator 4.

Five consecutive blocks were then inspected:

```text
Block 12108 -> 0x7e0f2caafbc6e55a760aa0a5f018c6ed1d9be9e3
Block 12109 -> 0x11af991db40f2490adf2b1927dc3cbcfe1c78c3a
Block 12110 -> 0x1cd5c3366c355df102058132055116ac17dafd79
Block 12111 -> 0x4b0879143eda8e0a1e3740d02d32614611720fc7
Block 12112 -> 0x7e0f2caafbc6e55a760aa0a5f018c6ed1d9be9e3
```

This provided direct evidence of proposer rotation:

```text
V4 → V1 → V2 → V3 → V4
```

The observed blocks were also able to be empty, demonstrating that block production is not dependent on application transactions being present.

The `miner` field in this context should be interpreted as the block author/proposer, not as a Proof-of-Work miner.

---

## 13. Block Period Interpretation

The network uses:

```text
blockperiodseconds = 5
```

This should not be interpreted as a guarantee that an RPC query performed every second will observe a new block.

Block production depends on:

- Proposer scheduling
- Validator communication
- Consensus rounds
- Processing time
- Network conditions
- Timeout behavior

Therefore:

> **A configured five-second block period is a protocol timing parameter, not an absolute end-to-end settlement SLA.**

For a payment requirement such as a two-second settlement SLA, the entire path must be evaluated:

```text
Application
→ Authorization
→ Signing/HSM
→ RPC
→ Transaction propagation
→ TX pool
→ EVM execution
→ QBFT consensus
→ Block inclusion
→ Confirmation
```

---

## 14. Enterprise Validator Architecture

Validator count alone is not sufficient to establish resilience.

A seven-validator network can still have poor fault tolerance if validators are concentrated in one institution or one infrastructure failure domain.

Example:

```text
Institution A: V1 V2 V3 V4 V5
Institution B: V6
Institution C: V7
```

If Institution A loses its entire data center:

```text
Remaining = 2
Quorum = 5

2 < 5
```

The network loses liveness.

A stronger architecture distributes validators across:

- Institutions
- Availability zones
- Data centers
- Network/security boundaries
- Operational teams
- Independent failure domains

Architecture principle:

> **Don't distribute nodes merely for node count. Distribute trust and failure domains.**

---

## 15. Banking Architecture Implication

For a consortium settlement network, QBFT provides a technical resilience layer complementary to institutional governance.

A useful architecture statement:

> **Governance establishes who is trusted to operate validators; QBFT limits the impact when that trust fails.**

For four validators:

```text
N = 4
f = 1
quorum = 3
```

One Byzantine validator can be tolerated while the remaining three can maintain consensus, assuming the fault model and network conditions remain satisfied.

This should not be described as making a compromised validator harmless. The validator can still behave maliciously or disrupt its own participation. QBFT provides bounded Byzantine fault tolerance.

---

## 16. BCP Alignment

Session 7 primarily supports the following Besu Certified Professional domains:

### Networking — 26%

- PoA consensus mechanisms
- Comparison of consensus mechanisms
- Validator networking
- Private/trusted networks

### Execution Engine & Consensus — 8%

- Consensus behavior
- Transaction validation
- Block proposal and commitment
- TX execution vs. consensus validity

### Permissioning & Privacy — 10%

- Consortium trust boundaries
- Validator authorization
- Institutional governance

### Monitoring — 8%

- Consensus health
- Validator availability
- Liveness/failure observation

---

## 17. Key Architecture Decisions

| Decision | Rationale |
|---|---|
| Use QBFT for hands-on private network | Enterprise-oriented BFT consensus |
| Skip Clique deployment | Besu 26.8.0 no longer supports Clique block production |
| Cover IBFT conceptually | Sufficient for current learning/BCP objective without duplicating implementation effort |
| Reuse Session 5 network | Avoid redundant infrastructure work |
| Treat genesis as initial chain definition | Prevent unsafe post-genesis configuration changes |
| Separate validator keys from genesis | Public validator identity must not expose signing credentials |
| Distribute validators across failure domains | Make mathematical fault tolerance operationally meaningful |
| Separate proposer from commit authority | Prevent unilateral validator control |
| Evaluate settlement latency end-to-end | Block period alone is not a settlement SLA |

---

## 18. Session Assessment

**Result: 5/5**

The assessment covered:

1. Byzantine validator tolerance
2. Safety vs. liveness
3. Genesis vs. runtime configuration
4. Proposer vs. consensus authority
5. Enterprise validator/failure-domain architecture

The assessment was supplemented by live inspection of the running four-validator QBFT network.

---

## 19. Capability Gained

At the end of Session 7, I can:

- Explain PoA, IBFT, and QBFT at an architectural level.
- Calculate QBFT Byzantine fault tolerance and quorum.
- Distinguish safety from liveness.
- Explain proposer authority vs. commit authority.
- Distinguish transaction execution failure from block invalidity.
- Explain the role of genesis `extraData`.
- Distinguish genesis configuration from node-local configuration.
- Reason about validator-set evolution.
- Analyze network partitions and quorum loss.
- Design validator placement across institutional and infrastructure failure domains.
- Evaluate QBFT suitability for banking settlement and consortium networks.
- Explain why block period is not equivalent to end-to-end settlement latency.

---

## 20. Architecture Milestone

**Session 7 moves the practical capability from “running QBFT” to “reasoning about QBFT as an enterprise consensus architecture.”**

The network is no longer being treated simply as four Besu processes.

It is being evaluated as a distributed system with:

**Validators → Proposers → Quorum → State Transition → Safety/Liveness → Failure Domains → Consortium Governance**

This forms the consensus foundation for the upcoming architecture modules.