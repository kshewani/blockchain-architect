# Session 13 --- Build a Tokenized Asset Smart Contract

## Overview

This session builds and tests a small Solidity prototype representing
fractional interests in a single real-estate property. The contract is
an educational tokenized-asset model, not a production
asset-tokenization platform, a complete ERC-20 implementation, or legal
evidence of property ownership.

**Blockchain:** Private Hyperledger Besu QBFT network\
**Chain ID:** `2026`\
**Solidity compiler:** `0.8.37`\
**EVM target:** `berlin`\
**Contract:** `TokAnshPropertyShare.sol`

## Learning objectives

-   Model a property identifier, token supply, and holder balances.
-   Implement transfers and voluntary token burning.
-   Restrict regulatory burns to the designated authority.
-   Emit events that make transfers and regulatory actions auditable.
-   Compile for the Berlin EVM target used by this lab's genesis
    configuration.
-   Deploy to Besu and test successful and rejected operations.
-   Record deployment evidence, including gas usage, block number,
    transaction hash, and deployed runtime bytecode.

## Contract behavior

The prototype includes:

-   `propertyId`: immutable identifier for the represented property.
-   `totalSupply`: current outstanding token supply.
-   `balanceOf`: token balances by address.
-   `regulatoryAuthority`: address permitted to perform regulatory burns
    and update the authority.
-   `transfer`: moves tokens between holders, with validation for
    invalid recipients, zero amounts, and insufficient balances.
-   `burn`: allows a holder to burn their own tokens and reduces total
    supply.
-   `forceBurn`: allows the regulatory authority to burn a holder's
    tokens when the required inputs and balance are valid.
-   `setRegulatoryAuthority`: allows the current authority to appoint a
    nonzero replacement.
-   Events: `Transfer`, `TokensBurned`, `RegulatoryBurn`, and
    `RegulatoryAuthorityChanged`.

## Prerequisites

-   Node.js and npm.
-   Dependencies installed in this project (`ethers` and `solc`).
-   A running Besu node exposing JSON-RPC at `http://127.0.0.1:8546`.
-   A development account funded on the lab chain and configured locally
    for the test script.

Do not put private keys, account JSON files, seed phrases, or other
credentials in Git. Keep local account material outside tracked files
and verify `.gitignore` before committing.

## Compile

From this project directory, run:

``` powershell
npm install
npm run compile
```

The compiler script is expected to target the `berlin` EVM version to
match the lab chain's genesis configuration. The compiler may warn that
Berlin is an older EVM target; do not change the network genesis or EVM
target as part of this session without a deliberate compatibility
review.

## Run the tests

Ensure the existing Besu node is running and the development account is
configured locally, then run:

``` powershell
npm test
```

The test suite covers:

-   Deployment, property identifier, and initial supply.
-   Transfer balances and the `Transfer` event's sender, recipient, and
    amount.
-   Rejection of transfers to the zero address and transfers exceeding
    the sender's balance.
-   Successful voluntary burn.
-   Rejection of zero-value voluntary burn and burn exceeding the
    holder's balance.
-   Rejection of an unauthorized regulatory burn.
-   Successful authorized regulatory burn and its audit event.
-   Rejection of regulatory burns with a zero amount, zero case ID,
    zero-address holder, or an amount exceeding the holder's balance.
-   Assertions that rejected burn operations do not change balances or
    total supply.

The verified test run reported:

``` text
All Session 13 contract tests passed.
```

## Deployment evidence

A successful test run deploys a fresh test instance, so its contract
address, transaction hash, and block number change between runs. Use the
values printed by the latest run rather than copying an address from an
earlier run.

The deployment receipt records:

-   Deployment transaction hash.
-   Gas used by the deployment transaction.
-   Deployment block number.
-   Deployed contract address.

The runtime bytecode check returned `true` and reported `2106` bytes for
the verified test deployment. This is evidence that executable code was
present at that address on the queried chain.

**Gas note:** `gasUsed` is gas consumption, not the transaction fee in
ETH. The fee also depends on the effective gas price.

## Known limitations and risks

-   This is a learning prototype for one property's fractional-interest
    model; it does not establish or transfer legal title to real estate.
-   It is not a complete ERC-20 implementation and should not be
    represented as standards-compliant.
-   The model does not implement a full issuance/redemption workflow,
    investor onboarding, KYC/AML, regulatory reporting, property
    valuation, income distribution, governance, dispute resolution, or
    legal transfer restrictions.
-   A regulatory authority with `forceBurn` powers is a privileged role.
    A production design would need formal governance, strong operational
    controls, auditable authorization, and legal review.
-   The current tests validate the implemented behavior, not production
    security. Independent review, broader testing, and threat modeling
    would be required before any real deployment.
-   The npm audit reported high-severity findings associated with `tmp`
    in the dependency tree. This was deliberately deferred for this
    session; record it as technical debt and review compatible
    remediation separately. Do not run a forced dependency downgrade
    without checking compiler compatibility.

## Troubleshooting notes

-   Confirm the Besu RPC endpoint is reachable at
    `http://127.0.0.1:8546`.
-   Confirm the node is on chain ID `2026`.
-   Ensure the development account has sufficient test-chain funds for
    deployment and transactions.
-   If compilation fails, check that the installed `solc` version and
    `compile.js` EVM target match the project configuration.
-   Do not treat an expected-revert test as passing if the operation
    actually succeeds or if the failure was caused by an RPC/network
    error.

## Repository hygiene

Before committing:

1.  Review the changed files with `git status`.
2.  Confirm private keys, `dev-account.json`, local environment files,
    and other secrets are not staged.
3.  Avoid committing local chain databases, node logs, or other runtime
    data.
4.  Include the source contract, test and compile scripts, package
    metadata/lockfile, and this README as appropriate.
5.  Re-run `npm test` against the intended running lab network and
    record the result.

## Session outcome

At the end of this session, I can now model a basic
tokenized-property-share lifecycle in Solidity, compile for a specified
EVM target, deploy to a private Besu network, verify deployed code and
deployment gas evidence, and test successful and rejected token
operations with event and state assertions.

**Next step:** review the project files and Git changes, then commit the
session artifact to the `blockchain-architect` repository after
verifying that no secrets or local runtime data are included.
