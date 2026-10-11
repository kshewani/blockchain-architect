const fs = require("fs");
const { ethers } = require("ethers");

const RPC_URL = "http://127.0.0.1:8546";
const ACCOUNT_FILE = "C:/Kamlesh/besu-lab/tx-lab/dev-account.json";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const account = JSON.parse(
        fs.readFileSync(ACCOUNT_FILE, "utf8")
    );
    const wallet = new ethers.Wallet(account.privateKey, provider);

    const abi = JSON.parse(
        fs.readFileSync(
            "./build-berlin/PaymentLedgerV2_sol_PaymentLedgerV2.abi",
            "utf8"
        )
    );

    const bytecode =
        "0x" +
        fs.readFileSync(
            "./build-berlin/PaymentLedgerV2_sol_PaymentLedgerV2.bin",
            "utf8"
        ).trim();

    console.log("Deployer:", wallet.address);
    console.log("Deploying PaymentLedgerV2...");

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();

    console.log("Transaction hash:", contract.deploymentTransaction().hash);

    const receipt = await contract.deploymentTransaction().wait();
    console.log("Deployment receipt status:", receipt.status);
    console.log("Deployment block:", receipt.blockNumber);
    console.log("Contract address:", await contract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
