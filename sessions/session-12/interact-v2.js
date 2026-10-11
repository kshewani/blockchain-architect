// Demonstrates a state-changing call to PaymentLedgerV2 and decodes
// the PaymentRecorded event from the transaction receipt.
//
// IMPORTANT: Each run submits a new transaction and increases `total`.
// Configure the account file and contract address for your own environment.
// Never commit private keys or account JSON files to Git.

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

// Allow environment overrides so the script is not tied to one machine.
const RPC_URL = process.env.BESU_RPC_URL || "http://127.0.0.1:8546";
const CONTRACT_ADDRESS = process.env.PAYMENT_LEDGER_V2_ADDRESS;

const ACCOUNT_FILE = process.env.BESU_ACCOUNT_FILE;
const ABI_FILE = path.join(
    __dirname,
    "build-berlin",
    "PaymentLedgerV2_sol_PaymentLedgerV2.abi"
);

async function main() {
    // Fail early if required environment-specific configuration is missing.
    if (!CONTRACT_ADDRESS || !ACCOUNT_FILE) {
        throw new Error(
            "Set PAYMENT_LEDGER_V2_ADDRESS and BESU_ACCOUNT_FILE before running."
        );
    }

    // Connect ethers.js to the Besu JSON-RPC endpoint.
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Load the local development account. Keep this file outside Git.
    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, "utf8"));
    const wallet = new ethers.Wallet(account.privateKey, provider);

    // Load the ABI so ethers.js can encode record() and decode contract events.
    const abi = JSON.parse(fs.readFileSync(ABI_FILE, "utf8"));
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

    // bytes32 is fixed-size; encode the business payment ID accordingly.
    const businessPaymentId = "PAYMENT-2026-0001";
    const paymentId = ethers.encodeBytes32String(businessPaymentId);
    const amount = 250;

    console.log("Payment ID:", businessPaymentId);
    console.log("Sender:", wallet.address);
    console.log("Amount:", amount);

    // Submit a state-changing transaction. This requires gas and block inclusion.
    const tx = await contract.record(paymentId, amount);
    console.log("Transaction hash:", tx.hash);

    // Wait for a receipt before interpreting execution status or logs.
    const receipt = await tx.wait();
    console.log("Receipt status:", receipt.status);
    console.log("Block:", receipt.blockNumber);

    if (receipt.status !== 1) {
        throw new Error("Transaction was included but EVM execution failed.");
    }

    // Decode logs that match this contract's ABI; unrelated logs are ignored.
    const events = receipt.logs
        .map((log) => {
            try {
                return contract.interface.parseLog(log);
            } catch {
                return null;
            }
        })
        .filter((event) => event !== null);

    // Display decoded business-event fields for monitoring/reconciliation.
    for (const event of events) {
        if (event.name !== "PaymentRecorded") continue;

        console.log("Event:", event.name);
        console.log(
            "Payment ID:",
            ethers.decodeBytes32String(event.args.paymentId)
        );
        console.log("Sender:", event.args.sender);
        console.log("Amount:", event.args.amount.toString());
        console.log("Timestamp:", event.args.timestamp.toString());
    }

    // Read the resulting persistent contract state after transaction inclusion.
    console.log("Contract total:", (await contract.total()).toString());
}

main().catch((error) => {
    // Report failures and return a non-zero process exit code.
    console.error(error);
    process.exit(1);
});
