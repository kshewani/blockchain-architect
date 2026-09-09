# Session 5 — QBFT Private Network & First Transaction

## 1. Session Objective

Build and operate a four-validator Hyperledger Besu private blockchain using QBFT consensus.

By the end of this session, the following should be understood and demonstrated:

- How a private Besu network is defined by its genesis file.
- How QBFT validators are generated and configured.
- How multiple Besu nodes discover/connect to each other.
- How QBFT reaches consensus and produces blocks.
- How validator quorum works.
- How to submit a real signed Ethereum transaction.
- How to verify transaction inclusion, receipt and balances.
- Why empty blocks can be produced.
- The difference between block production, transaction execution and consensus.
- The difference between QBFT block production and Proof-of-Work mining.
- How to rebuild the network without committing private keys or blockchain runtime data.

---

# 2. Architecture

The Session 5 network contains four Besu validator nodes.

```text
                         QBFT Private Network
                                |
             +------------------+------------------+
             |                  |                  |
          Node 1             Node 2             Node 3             Node 4
        Validator           Validator           Validator           Validator
             |                  |                  |                  |
             +------------------+------------------+------------------+
                                |
                         QBFT Consensus
                                |
                         Quorum >= 3
                                |
                         Committed Block
```

Transaction flow:

```text
Transaction Application
        |
        | JSON-RPC
        v
     Besu Node
        |
        v
  Transaction Pool
        |
        v
   QBFT Proposer
        |
        v
    Candidate Block
        |
        +-----------------------------+
        |                             |
        v                             v
 Other Validators              EVM Execution
 Validate / Vote               State Transition
        |                             |
        +-------------+---------------+
                      |
                 QBFT Quorum
                      |
                      v
               Block Committed
                      |
                      v
             Local Blockchain State
```

Important distinction:

Each validator maintains its own local copy of the blockchain and state.

However, this is not ordinary primary/replica database replication. Each validator independently validates and executes the agreed transaction sequence and should deterministically arrive at the same state.

---

# 3. Network Parameters

| Parameter | Value |
|---|---|
| Besu version used | 26.8.0 |
| Consensus | QBFT |
| Validators | 4 |
| Chain ID | 2026 |
| Block period | 5 seconds |
| Epoch length | 30,000 blocks |
| QBFT request timeout | 10 seconds |
| Node 1 P2P | 30305 |
| Node 2 P2P | 30306 |
| Node 3 P2P | 30307 |
| Node 4 P2P | 30308 |
| Node 1 RPC | 8546 |
| Node 2 RPC | 8547 |
| Node 3 RPC | 8548 |
| Node 4 RPC | 8549 |

For four validators:

```text
N = 4

f = floor((N - 1) / 3)
  = 1

QBFT supermajority/quorum = 3 validators
```

Therefore:

- One validator can fail while the network can still make progress.
- Two validator failures can prevent new blocks from being committed.
- The existing blockchain data is not automatically lost when validators stop.

Validator count alone does not guarantee high availability. Validator placement, failure domains, networking, storage and key management also matter.

---

# 4. Repository Artifacts

The repository contains the reproducible configuration:

```text
sessions/
└── session-05/
    ├── README.md
    └── qbft-network/
        ├── config.json
        ├── genesis.json
        ├── node1/
        │   ├── config.toml
        │   └── static-nodes.json
        ├── node2/
        │   ├── config.toml
        │   └── static-nodes.json
        ├── node3/
        │   ├── config.toml
        │   └── static-nodes.json
        └── node4/
            ├── config.toml
            └── static-nodes.json
```

The repository intentionally does NOT contain:

- Validator private keys
- Blockchain databases
- Besu runtime data
- Logs
- `node_modules`
- Transaction account private keys

---

# 5. Important Security Rule

**Never commit private keys to Git.**

Validator private keys control validator identity and therefore validator authority.

Runtime blockchain data should also not be committed to Git because it is:

- Mutable
- Potentially large
- Environment-specific
- I/O-intensive
- Not source configuration

Git should contain the configuration required to reproduce the network, not the live blockchain database.

For production, validator keys should be managed using appropriate enterprise key-management mechanisms such as HSM-backed infrastructure and/or Web3Signer rather than simple filesystem keys.

---

# 6. Rebuild the Network from Scratch

## 6.1 Prerequisites

The following were used in this lab:

- Windows 11
- PowerShell
- Hyperledger Besu 26.8.0
- Java 26
- Node.js 20+
- npm

Verify Besu:

```powershell
C:\Kamlesh\besu\besu-26.8.0\bin\besu.bat --version
```

Expected:

```text
besu/v26.8.0/windows-x86_64/oracle-java-26
```

The Java version may also produce harmless Picocli reflective-access warnings.

If required for Java 26 warning suppression in the current PowerShell session:

```powershell
$env:JAVA_TOOL_OPTIONS="--enable-final-field-mutation=ALL-UNNAMED"
```

This suppresses the recurring warning related to reflective final-field mutation. Do not treat the warning itself as a Besu failure.

Verify Node.js:

```powershell
node --version
```

Expected:

```text
v20.11.0
```

---

# 7. Create a Clean Lab Workspace

The following rebuild procedure is intended for a new lab network.

```powershell
mkdir C:\Kamlesh\besu-lab\session5-rebuild
cd C:\Kamlesh\besu-lab\session5-rebuild
```

Expected:

```text
C:\Kamlesh\besu-lab\session5-rebuild
```

Create the QBFT configuration directory:

```powershell
mkdir .\qbft-config
mkdir .\qbft-network-files
mkdir .\nodes
```

---

# 8. Create the QBFT Generator Configuration

Create:

```text
qbft-config\config.json
```

Use:

```json
{
  "genesis": {
    "config": {
      "chainId": 2026,
      "berlinBlock": 0,
      "qbft": {
        "blockperiodseconds": 5,
        "epochlength": 30000,
        "requesttimeoutseconds": 10
      }
    },
    "nonce": "0x0",
    "timestamp": "0x0",
    "gasLimit": "0x1fffffffffffff",
    "difficulty": "0x1",
    "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "coinbase": "0x0000000000000000000000000000000000000000"
  },
  "blockchain": {
    "nodes": {
      "generate": true,
      "count": 4
    }
  }
}
```

### Why `berlinBlock: 0` matters

The first version of our Session 5 network did not include this setting.

Although:

```text
eth_chainId
```

returned:

```text
0x7ea
```

transactions using replay-protected signatures failed with:

```text
ChainId not supported
```

The genesis was immutable, so we had to rebuild the blockchain from a clean data directory after correcting the genesis.

The final working genesis therefore contains:

```json
"berlinBlock": 0
```

---

# 9. Generate the QBFT Network

Run:

```powershell
C:\Kamlesh\besu\besu-26.8.0\bin\besu.bat operator generate-blockchain-config `
  --config-file=C:\Kamlesh\besu-lab\session5-rebuild\qbft-config\config.json `
  --to=C:\Kamlesh\besu-lab\session5-rebuild\qbft-network-files `
  --private-key-file-name=key
```

Besu generates:

- `genesis.json`
- Four validator keypairs
- Validator public keys
- Validator addresses
- QBFT `extraData`

Expected result includes four generated node key directories under the output location.

The exact generated addresses will be different every time because new keys are generated.

---

# 10. Verify the Generated Genesis

Run:

```powershell
Get-Content ".\qbft-network-files\genesis.json" |
  ConvertFrom-Json |
  Select-Object -ExpandProperty config |
  Format-List
```

Expected:

```text
chainId     : 2026
berlinBlock : 0
qbft        : @{blockperiodseconds=5; epochlength=30000; requesttimeoutseconds=10}
```

Also verify:

```powershell
Get-Item ".\qbft-network-files\genesis.json" |
  Select-Object FullName,Length
```

A small JSON file should be returned.

---

# 11. Create Node Directories

```powershell
mkdir .\nodes\node1
mkdir .\nodes\node2
mkdir .\nodes\node3
mkdir .\nodes\node4
```

Create separate data directories later when starting the nodes.

Do not use the same data directory for multiple Besu nodes.

---

# 12. Configure the Four Nodes

Each node must have:

- The same genesis file
- Its own data path
- Its own P2P port
- Its own RPC port
- Its own validator private key
- Appropriate static peer configuration

Example Node 1 configuration:

```toml
genesis-file="C:/Kamlesh/besu-lab/session5-rebuild/qbft-network-files/genesis.json"
data-path="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node1/data"
p2p-host="127.0.0.1"
p2p-port=30305
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=8546
rpc-http-api=["ETH","NET","WEB3"]
static-nodes-file="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node1/static-nodes.json"
sync-min-peers=1
```

Node 2:

```toml
genesis-file="C:/Kamlesh/besu-lab/session5-rebuild/qbft-network-files/genesis.json"
data-path="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node2/data"
p2p-host="127.0.0.1"
p2p-port=30306
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=8547
rpc-http-api=["ETH","NET","WEB3"]
static-nodes-file="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node2/static-nodes.json"
sync-min-peers=1
```

Node 3:

```toml
genesis-file="C:/Kamlesh/besu-lab/session5-rebuild/qbft-network-files/genesis.json"
data-path="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node3/data"
p2p-host="127.0.0.1"
p2p-port=30307
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=8548
rpc-http-api=["ETH","NET","WEB3"]
static-nodes-file="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node3/static-nodes.json"
sync-min-peers=1
```

Node 4:

```toml
genesis-file="C:/Kamlesh/besu-lab/session5-rebuild/qbft-network-files/genesis.json"
data-path="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node4/data"
p2p-host="127.0.0.1"
p2p-port=30308
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=8549
rpc-http-api=["ETH","NET","WEB3"]
static-nodes-file="C:/Kamlesh/besu-lab/session5-rebuild/nodes/node4/static-nodes.json"
sync-min-peers=1
```

---

# 13. Validator Keys

The generator creates four validator private keys.

They will be under the generated `keys` directory.

For each validator:

```text
keys/
├── <validator-address-1>/
│   └── key
├── <validator-address-2>/
│   └── key
├── <validator-address-3>/
│   └── key
└── <validator-address-4>/
    └── key
```

Each validator key must be placed in its corresponding node's data directory as:

```text
nodes\node1\data\key
nodes\node2\data\key
nodes\node3\data\key
nodes\node4\data\key
```

Verify a key is a file, not a directory:

```powershell
Get-Item ".\nodes\node1\data\key" |
  Select-Object FullName,Length,PSIsContainer
```

Expected:

```text
PSIsContainer : False
```

The private key must never be displayed, copied into documentation, or committed to Git.

---

# 14. Obtain the Node Enodes

Start Node 1 first.

Use a dedicated PowerShell window.

Set the title:

```powershell
$Host.UI.RawUI.WindowTitle = "Besu Node-1"
```

Start:

```powershell
C:\Kamlesh\besu\besu-26.8.0\bin\besu.bat `
  --config-file=C:\Kamlesh\besu-lab\session5-rebuild\nodes\node1\config.toml
```

Besu should report that it is listening on:

```text
P2P port: 30305
RPC port: 8546
```

The startup log also reports the node's `enode://...` address.

Record the Node 1 enode.

Repeat for Nodes 2–4 using:

```text
Node 2 → P2P 30306 / RPC 8547
Node 3 → P2P 30307 / RPC 8548
Node 4 → P2P 30308 / RPC 8549
```

Each node will have a different enode because each has a different node identity.

---

# 15. Configure Static Nodes

Each `static-nodes.json` file contains an array of enode URLs.

Example:

```json
[
  "enode://NODE2_PUBLIC_KEY@127.0.0.1:30306",
  "enode://NODE3_PUBLIC_KEY@127.0.0.1:30307"
]
```

For this lab topology:

```text
Node 1 → Node 2, Node 3
Node 2 → Node 1, Node 3
Node 3 → Node 1
Node 4 → Node 1
```

This topology is sufficient for the local lab.

**Do not escape the `enode://` URL.**

The file must be valid JSON.

Verify:

```powershell
Get-Content ".\nodes\node1\static-nodes.json" | ConvertFrom-Json
```

Expected:

```text
enode://...
enode://...
```

A single-element peer list must still be a JSON array:

```json
[
  "enode://..."
]
```

not:

```json
"enode://..."
```

---

# 16. Verify P2P Connectivity

Once the nodes are running, query Node 1:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8546" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
```

Expected:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x..."
}
```

For example:

```text
0x3
```

means three connected peers.

Check whether Node 1 is listening:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8546" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"net_listening","params":[],"id":2}'
```

Expected:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": true
}
```

---

# 17. Verify QBFT Block Production

Query Node 1:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8546" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":3}'
```

Expected:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": "0x..."
}
```

Because the block period is 5 seconds, the value should increase over time.

For example:

```text
0x1
0x2
0x3
...
```

The exact number will depend on how long the network has been running.

---

# 18. Understand Empty Blocks

QBFT can continue producing blocks even when there are no user transactions.

For example:

```text
Block 956 → 0 transactions
Block 957 → 1 transaction
Block 958 → 0 transactions
```

This is not Proof-of-Work mining.

Empty blocks consume some:

- CPU
- network bandwidth
- cryptographic processing
- disk space

Therefore, block period is an architecture trade-off.

Shorter block period:

```text
Lower latency
Higher block-production overhead
```

Longer block period:

```text
Higher latency
Lower block-production overhead
```

The appropriate value depends on the application's latency, throughput and operational requirements.

---

# 19. Submit a Real Signed Transaction

The application does not send the private key to Besu.

Instead:

```text
Private Key
     |
     v
Application signs transaction
     |
     v
Signed Raw Transaction
     |
     v
eth_sendRawTransaction
     |
     v
Besu
```

The private key therefore remains with the transaction signer.

In our original lab we used:

- Node.js
- ethers.js
- a disposable transaction account
- a 1 ETH transfer
- chain ID 2026
- legacy transaction type
- gas price 0

The transaction account was funded from the genesis allocation.

Never put the account's private key into Git.

---

# 20. Verify Transaction Inclusion

After submission, obtain the transaction hash:

```text
0x...
```

Query:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8546" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":["TX_HASH"],"id":4}'
```

A mined transaction should contain:

```text
blockHash
blockNumber
transactionIndex
from
to
value
```

Before inclusion, `blockHash` and `blockNumber` may be null.

---

# 21. Verify the Transaction Receipt

Run:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8546" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_getTransactionReceipt","params":["TX_HASH"],"id":5}'
```

Successful transaction:

```text
status = 0x1
```

Failed execution:

```text
status = 0x0
```

For our successful 1 ETH transfer:

```text
GasUsed = 0x5208
```

which is:

```text
21000 gas
```

---

# 22. Failed Transactions

There are two important categories.

## Transaction rejected before execution

Example:

```text
Insufficient funds
```

If the transaction cannot satisfy transaction-level validation requirements, Besu may reject it before it enters the transaction pool/block.

Therefore:

```text
Signed TX
   |
   v
Validation
   |
   X
Rejected
```

There is no committed transaction in this case.

## Transaction included but execution fails

A smart-contract transaction can be valid enough to enter a block but fail during EVM execution.

Example:

```text
Transaction
    |
    v
Block
    |
    v
EVM
    |
  REVERT
```

The transaction can still be recorded in the blockchain.

The receipt will contain:

```text
status = 0x0
```

The state changes that should be reverted are rolled back according to EVM semantics, while gas consumed by the execution is generally charged.

Important principle:

> Transaction validity and transaction execution success are different concepts.

---

# 23. Block Proposer vs Consensus

In QBFT, one validator is selected as proposer for a block.

For example:

```text
Block 956 → Node 4
Block 957 → Node 1
Block 958 → Node 2
```

Node 1 therefore proposed Block 957.

But Node 1 did not unilaterally decide that Block 957 was valid.

Conceptually:

```text
Node 1
  |
  | proposes block
  v
Block 957
  |
  +----> Node 2 validates
  |
  +----> Node 3 validates
  |
  +----> Node 4 validates
  |
  v
QBFT quorum
  |
  v
Block committed
```

With four validators, the supermajority threshold is three validators.

The proposer participates in consensus; the other validators independently validate the proposal and participate in the QBFT agreement process.

---

# 24. QBFT Is Not Proof-of-Work Mining

Our network does not perform Bitcoin-style mining.

There is no:

```text
Hash puzzle
     |
Millions of attempts
     |
Winner
     |
Block
```

Instead:

```text
Select proposer
      |
      v
Create candidate block
      |
      v
Validators validate
      |
      v
Validators exchange consensus messages
      |
      v
Quorum reached
      |
      v
Block committed
```

Therefore the appropriate architectural terminology is:

> QBFT-based Proof-of-Authority block production and Byzantine Fault Tolerant consensus.

---

# 25. Chain ID vs Network ID

Chain ID and network ID are related but have different purposes.

### Chain ID

Primarily used for transaction signing/replay protection.

Our chain:

```text
Chain ID = 2026
```

Hexadecimal:

```text
0x7ea
```

### Network ID

Used for P2P network identification.

They can have the same numeric value, but they represent different concepts.

---

# 26. Verify Chain Identity

Run:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8546" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":6}'
```

Expected:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": "0x7ea"
}
```

`0x7ea` = decimal `2026`.

---

# 27. Verify Persistence

Stop all four Besu nodes gracefully.

Restart them using the same:

- genesis
- data paths
- validator keys
- configuration

Then query:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8546" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":7}'
```

The block height should resume from the persisted blockchain rather than starting from block 0.

This demonstrates the distinction between:

```text
Immutable configuration
        +
Persistent blockchain state
        +
Validator identity
```

All three are required for a real persistent node.

---

# 28. Troubleshooting

## Clique error

If Besu reports:

```text
Clique Block Production (mining) is no longer supported
```

Do not attempt to build a new Clique network.

Use QBFT.

---

## Chain ID not supported

If a signed transaction returns an error similar to:

```text
ChainId not supported
```

Check the genesis configuration.

For this lab, ensure:

```json
"chainId": 2026,
"berlinBlock": 0
```

Remember that changing genesis requires a fresh blockchain data directory.

You cannot safely change the genesis configuration underneath an already initialized blockchain.

---

## Static nodes JSON error

Correct:

```json
[
  "enode://..."
]
```

Incorrect:

```json
"enode://..."
```

Also verify that the enode URL is correctly formed and not unnecessarily escaped.

---

## Key is a directory instead of a file

Besu expects:

```text
data\key
```

to be a key file.

Verify:

```powershell
Get-Item ".\nodes\node1\data\key" |
  Select-Object FullName,PSIsContainer,Length
```

Expected:

```text
PSIsContainer : False
```

---

## No peers

Check:

```powershell
Test-NetConnection 127.0.0.1 -Port 30305
```

Expected:

```text
TcpTestSucceeded : True
```

Then check:

```text
net_peerCount
```

Also verify the static-nodes files and P2P ports.

---

## Block height stuck at zero

Check:

1. All validator nodes are running.
2. P2P connections exist.
3. All nodes use the exact same genesis.
4. Each node has the correct validator key.
5. Static nodes are correctly configured.
6. No stale/incorrect data directory is being reused.

Remember:

> Four validators do not mathematically require all four to be online. With four validators, three are sufficient for the QBFT supermajority. A temporary stall with three nodes therefore requires investigation rather than assuming that a fourth validator is mandatory.

---

# 29. Architecture Lessons

### Genesis

Genesis establishes the initial identity and protocol configuration of the blockchain.

It is effectively immutable after a node has initialized its chain.

### Validator

A validator participates in block validation and QBFT consensus.

Validator private keys are security-sensitive credentials.

### Proposer

The proposer creates the candidate block for its assigned round.

The proposer does not have unilateral authority.

### EVM

The EVM executes transactions and produces deterministic state transitions.

### Consensus

QBFT allows validators to agree on the canonical block sequence despite Byzantine failures within its tolerance.

### Storage

Each validator maintains its own local blockchain/state.

The nodes converge because they independently validate and execute the same agreed sequence.

### P2P

P2P networking is used for node-to-node communication and consensus.

### RPC

RPC is the application/tool interface to a Besu node.

---

# 30. Session 5 Key Learnings

1. **Private blockchain identity starts with genesis.**
2. **QBFT provides Byzantine Fault Tolerant consensus for enterprise private networks.**
3. **Four validators provide tolerance for one Byzantine/failing validator under the QBFT model.**
4. **Quorum is not the same as validator count.**
5. **A proposer proposes; the validator set collectively reaches consensus.**
6. **Every validator maintains its own local blockchain/state.**
7. **Validators independently execute and validate transactions.**
8. **Chain ID protects transaction signatures against replay across chains.**
9. **Genesis changes require blockchain reinitialization.**
10. **Transaction signing happens outside Besu; the private key need not be sent to the node.**
11. **A transaction can fail before entering a block or fail during EVM execution after being included.**
12. **Empty blocks can consume resources but may be an intentional block-production policy.**
13. **QBFT is consensus/block production, not Proof-of-Work mining.**
14. **Configuration, runtime state and credentials must be managed separately.**
15. **A reproducible blockchain environment should be defined in source control without committing secrets or runtime databases.**

---

# 31. Session 5 Completion Checklist

- [x] Generated a four-validator QBFT network
- [x] Created and inspected genesis
- [x] Configured four Besu nodes
- [x] Established P2P connectivity
- [x] Observed QBFT block production
- [x] Verified quorum concept
- [x] Submitted a real signed transaction
- [x] Verified transaction inclusion
- [x] Verified transaction receipt
- [x] Verified account balances
- [x] Inspected blocks before/after the transaction
- [x] Understood empty blocks
- [x] Understood proposer vs validator consensus
- [x] Understood QBFT vs mining
- [x] Demonstrated persistence across restart
- [x] Kept private keys and runtime data out of Git

**Session 5 Status: COMPLETE**