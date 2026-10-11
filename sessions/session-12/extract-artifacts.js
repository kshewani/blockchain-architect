const fs = require("fs");

const raw = fs.readFileSync("./compiler-output.json", "utf8");
const jsonStart = raw.indexOf("{");

if (jsonStart === -1) {
    throw new Error("No JSON object found in compiler-output.json");
}

const output = JSON.parse(raw.slice(jsonStart));
const contract = output.contracts["PaymentLedger.sol"].PaymentLedger;

fs.writeFileSync(
    "./build-berlin/PaymentLedger_sol_PaymentLedger.abi",
    JSON.stringify(contract.abi)
);

fs.writeFileSync(
    "./build-berlin/PaymentLedger_sol_PaymentLedger.bin",
    contract.evm.bytecode.object
);

console.log("ABI and Berlin bytecode extracted successfully.");
console.log("Bytecode length:", contract.evm.bytecode.object.length);
