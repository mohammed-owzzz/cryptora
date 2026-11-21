/**
 * CRYPTORA — ZKP toolchain setup.
 *
 *  1. Compiles circuits/eligibility.circom -> R1CS + WASM witness generator
 *     using the WASM build of the circom compiler (`circom2`, no Rust needed).
 *  2. Runs a local development Groth16 trusted setup (powers of tau, phase 2,
 *     zkey contribution).
 *  3. Exports the verification key.
 *  4. Copies the prover artifacts into client/public/zkp so the browser can
 *     generate proofs locally (the witness never leaves the device).
 *
 * Run: npm run setup
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'zkp', 'build');
const outDir = path.join(root, 'client', 'public', 'zkp');
const circom = path.join(root, 'node_modules', '.bin', 'circom2');
const snarkjs = path.join(root, 'node_modules', '.bin', 'snarkjs');

const run = (bin, args, label) => {
  process.stdout.write(`  → ${label}\n`);
  execFileSync(bin, args, { cwd: root, stdio: 'inherit' });
};

fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

console.log('[1/5] Compiling circom circuit (Poseidon Merkle membership, depth 13)');
run(circom, ['circuits/eligibility.circom', '-l', path.join(root, 'node_modules'), '--r1cs', '--wasm', '--sym', '-o', buildDir], 'circom2');

const r1cs = path.join(buildDir, 'eligibility.r1cs');
if (!fs.existsSync(r1cs)) throw new Error('Circuit compilation failed: no r1cs produced');

console.log('[2/5] Powers of tau (2^13 constraints, local dev ceremony)');
const pot0 = path.join(buildDir, 'pot13_0000.ptau');
const pot1 = path.join(buildDir, 'pot13_0001.ptau');
const potFinal = path.join(buildDir, 'pot13_final.ptau');
if (!fs.existsSync(potFinal)) {
  run(snarkjs, ['powersoftau', 'new', 'bn128', '13', pot0, '-v'], 'new ceremony');
  run(snarkjs, ['powersoftau', 'contribute', pot0, pot1, '--name=cryptora-dev', '-e=cryptora dev entropy'], 'contribute');
  run(snarkjs, ['powersoftau', 'prepare', 'phase2', pot1, potFinal, '-v'], 'prepare phase2');
}

console.log('[3/5] Groth16 setup');
const zkey0 = path.join(buildDir, 'eligibility_0000.zkey');
const zkeyFinal = path.join(buildDir, 'eligibility_final.zkey');
const vkeyPath = path.join(buildDir, 'verification_key.json');
run(snarkjs, ['groth16', 'setup', r1cs, potFinal, zkey0], 'groth16 setup');
run(snarkjs, ['zkey', 'contribute', zkey0, zkeyFinal, '--name=cryptora-dev', '-e=cryptora zkey entropy'], 'zkey contribute');
run(snarkjs, ['zkey', 'export', 'verificationkey', zkeyFinal, vkeyPath], 'export vkey');

console.log('[4/5] Verifier artifacts ready');

console.log('[5/5] Publishing prover artifacts to client/public/zkp');
fs.copyFileSync(path.join(buildDir, 'eligibility_js', 'eligibility.wasm'), path.join(outDir, 'eligibility.wasm'));
fs.copyFileSync(zkeyFinal, path.join(outDir, 'eligibility_final.zkey'));
fs.copyFileSync(vkeyPath, path.join(outDir, 'verification_key.json'));

const info = execFileSync(snarkjs, ['r1cs', 'info', r1cs], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
console.log("\nCircuit info:\n" + info);
console.log('Artifacts written to client/public/zkp and zkp/build');
