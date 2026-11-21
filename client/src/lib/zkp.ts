/**
 * Browser-side cryptography.
 *
 * The voter's eligibility proof is generated here — the witness (credential
 * secret + Merkle path) never leaves the browser. Ballot vectors are encrypted
 * locally with the election's Paillier public key before transmission.
 */
import * as snarkjs from 'snarkjs';

export interface WitnessPayload {
  electionId: string;
  fieldId: string;
  root: string;
  secret: string;
  nullifier: string;
  pathElements: string[];
  pathIndices: string[];
  depth: number;
  tallyPublicKey: { n: string; g: string; bits: number };
}

export interface GeneratedProof {
  proof: Record<string, unknown>;
  publicSignals: string[];
  proveMs: number;
}

export async function generateEligibilityProof(witness: WitnessPayload): Promise<GeneratedProof> {
  const input = {
    secret: witness.secret,
    pathElements: witness.pathElements,
    pathIndices: witness.pathIndices,
    root: witness.root,
    electionId: witness.fieldId,
    nullifier: witness.nullifier,
  };
  const started = performance.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input as any,
    '/zkp/eligibility.wasm',
    '/zkp/eligibility_final.zkey',
  );
  return {
    proof: proof as unknown as Record<string, unknown>,
    publicSignals: publicSignals as string[],
    proveMs: Math.round(performance.now() - started),
  };
}

export async function verifyLocally(
  verificationKey: Record<string, unknown>,
  publicSignals: string[],
  proof: Record<string, unknown>,
): Promise<boolean> {
  try {
    return await snarkjs.groth16.verify(verificationKey as any, publicSignals, proof as any);
  } catch {
    return false;
  }
}

/* --------------------------- Paillier (client) --------------------------- */

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Cryptographically random integer below `max` (rejection sampling). */
function randomBelow(max: bigint): bigint {
  const bytes = Math.ceil(max.toString(2).length / 8) + 8;
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let hex = '';
  for (const b of buf) hex += b.toString(16).padStart(2, '0');
  return BigInt('0x' + hex) % max;
}

function randomCoprime(n: bigint): bigint {
  for (;;) {
    const r = randomBelow(n);
    if (r > 1n && gcd(r, n) === 1n) return r;
  }
}

export function encryptVector(
  publicKey: { n: string; g: string },
  oneHot: number[],
): string[] {
  const n = BigInt(publicKey.n);
  const g = BigInt(publicKey.g);
  const n2 = n * n;
  return oneHot.map((m) => {
    const r = randomCoprime(n);
    const gm = modPow(g, BigInt(m), n2);
    const rn = modPow(r, n, n2);
    return ((gm * rn) % n2).toString();
  });
}

/** SHA-256 over the canonical ciphertext bundle (matches the server's check). */
export async function ballotCommitment(ciphertexts: string[]): Promise<string> {
  const canonical = JSON.stringify(ciphertexts);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
