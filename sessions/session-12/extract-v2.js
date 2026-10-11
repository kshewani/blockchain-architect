const fs = require("fs");

const raw = fs.readFileSync("./compiler-output-v2.json", "utf8");
const jsonStart = raw.indexOf("{");

if (jsonStart === -1) {
    throw new Error("No JSON object found in compiler-output-v2.json");
}

const output = JSON.parse(raw.slice(jsonStart));
const contract = output.contracts["PaymentLedgerV2.sol"].PaymentLedgerV2;

fs.writeFileSync(
    "./build-berlin/PaymentLedgerV2_sol_PaymentLedgerV2.abi",
    JSON.stringify(contract.abi)
);

fs.writeFileSync(
    "./build-berlin/PaymentLedgerV2_sol_PaymentLedgerV2.bin",
    contract.evm.bytecode.object
);

console.log("V2 ABI and Berlin bytecode extracted successfully.");
console.log("Bytecode length:", contract.evm.bytecode.object.length);
