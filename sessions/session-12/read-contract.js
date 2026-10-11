const fs = require("fs");
const { ethers } = require("ethers");

const RPC_URL = "http://127.0.0.1:8546";
const CONTRACT_ADDRESS = "0x8Ed27fBC0e90acC69e9b9942BaD4C0c65B6c41E6";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const abi = JSON.parse(
        fs.readFileSync(
            "./build-berlin/PaymentLedger_sol_PaymentLedger.abi",
            "utf8"
        )
    );

    const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        abi,
        provider
    );

    const total = await contract.total();

    console.log("Contract:", CONTRACT_ADDRESS);
    console.log("total =", total.toString());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
