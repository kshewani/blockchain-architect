const fs = require("fs");
const { ethers } = require("ethers");

const RPC_URL = "http://127.0.0.1:8546";
const ACCOUNT_FILE = "C:/Kamlesh/besu-lab/tx-lab/dev-account.json";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const account = JSON.parse(fs.readFileSync(ACCOUNT_FILE, "utf8"));
    const wallet = new ethers.Wallet(account.privateKey, provider);

    const abi = JSON.parse(
        fs.readFileSync("./build-berlin/PaymentLedger_sol_PaymentLedger.abi", "utf8")
    );

    const bytecode =
        "0x" +
        fs.readFileSync(
            "./build-berlin/PaymentLedger_sol_PaymentLedger.bin",
            "utf8"
        ).trim();

    console.log("Deployer:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    console.log("Deploying PaymentLedger...");

    const contract = await factory.deploy();

    console.log("Transaction hash:", contract.deploymentTransaction().hash);

    await contract.waitForDeployment();

    console.log("Contract address:", await contract.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
