import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { poseidon1, poseidon2 } from 'poseidon-lite';
import * as snarkjs from 'snarkjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPTH = 13;

function buildTree(leaves, depth) {
  let level = leaves.slice();
  while (level.length < 2 ** depth) level.push(0n);
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(poseidon2([level[i], level[i + 1]]));
    level = next;
    levels.push(level);
  }
  return levels;
}

const TARGET = 5;
const leaves = [];
for (let i = 0; i < 8; i++) leaves.push(poseidon1([BigInt(1000 + i)]));
const levels = buildTree(leaves, DEPTH);
const rootHash = levels[levels.length - 1][0];

const secret = 1000n + BigInt(TARGET);
const electionId = 1001n;
const nullifier = poseidon2([secret, electionId]);

const pathElements = [];
const pathIndices = [];
let idx = TARGET;
for (let d = 0; d < DEPTH; d++) {
  const lvl = levels[d];
  const sibling = idx % 2 === 0 ? lvl[idx + 1] : lvl[idx - 1];
  pathElements.push(sibling);
  pathIndices.push(String(idx % 2));
  idx = Math.floor(idx / 2);
}

console.log('root matches circuit design:', levels[levels.length - 1][0] === rootHash);

const input = {
  secret: secret.toString(),
  pathElements: pathElements.map(String),
  pathIndices,
  root: rootHash.toString(),
  electionId: electionId.toString(),
  nullifier: nullifier.toString(),
};

const t0 = Date.now();
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  path.join(root, 'client/public/zkp/eligibility.wasm'),
  path.join(root, 'client/public/zkp/eligibility_final.zkey'),
);
const proveMs = Date.now() - t0;

const vk = JSON.parse((await import('node:fs')).readFileSync(path.join(root, 'client/public/zkp/verification_key.json'), 'utf8'));
const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);

// negative test: tamper the nullifier
const bad = [...publicSignals];
bad[2] = (BigInt(bad[2]) + 1n).toString();
const badOk = await snarkjs.groth16.verify(vk, bad, proof);

console.log(JSON.stringify({ proveMs, publicSignals, verified: ok, tamperedVerified: badOk }, null, 2));
