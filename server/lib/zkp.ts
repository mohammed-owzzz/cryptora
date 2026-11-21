import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as snarkjs from 'snarkjs';
import { FIELD_PRIME, MERKLE_DEPTH } from './merkle.js';

/**
 * Server-side Groth16 verification. The proving key never touches the server for
 * live votes: the browser generates the proof locally and posts only the proof
 * and its public signals. Verification below re-checks the proof against the
 * circuit's verification key.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
export const ZKP_DIR = path.resolve(here, '../../client/public/zkp');
const VKEY_PATH = path.join(ZKP_DIR, 'verification_key.json');

let cachedVkey: any = null;

export function verificationKey() {
  if (!cachedVkey) {
    if (!fs.existsSync(VKEY_PATH)) {
      throw new Error('Verification key missing — run `npm run setup` to compile the circuit');
    }
    cachedVkey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
  }
  return cachedVkey;
}

export interface ProveArtifacts {
  proof: Record<string, unknown>;
  publicSignals: string[];
}

export interface VerificationOutcome {
  verified: boolean;
  durationMs: number;
  reason?: string;
}

export async function verifyProof(artifacts: ProveArtifacts, expected: {
  root: string;
  fieldId: string;
  nullifier: string;
}): Promise<VerificationOutcome> {
  const started = Date.now();
  const { proof, publicSignals } = artifacts;

  if (!proof || !Array.isArray(publicSignals) || publicSignals.length !== 3) {
    return { verified: false, durationMs: Date.now() - started, reason: 'Malformed proof payload' };
  }

  const [root, fieldId, nullifier] = publicSignals;
  if (root !== expected.root) {
    return { verified: false, durationMs: Date.now() - started, reason: 'Public input mismatch: merkle root' };
  }
  if (fieldId !== expected.fieldId) {
    return { verified: false, durationMs: Date.now() - started, reason: 'Public input mismatch: election identifier' };
  }
  if (nullifier !== expected.nullifier) {
    return { verified: false, durationMs: Date.now() - started, reason: 'Public input mismatch: nullifier' };
  }

  try {
    const ok = await snarkjs.groth16.verify(verificationKey(), publicSignals, proof);
    return { verified: Boolean(ok), durationMs: Date.now() - started, reason: ok ? undefined : 'Groth16 verification failed' };
  } catch (err: any) {
    return { verified: false, durationMs: Date.now() - started, reason: err?.message ?? 'Verifier error' };
  }
}

export const CIRCUIT_INFO = {
  name: 'eligibility',
  depth: MERKLE_DEPTH,
  fieldPrime: FIELD_PRIME.toString(),
  protocol: 'groth16',
  curve: 'bn128',
};

export function artifactsReady(): boolean {
  return (
    fs.existsSync(VKEY_PATH) &&
    fs.existsSync(path.join(ZKP_DIR, 'eligibility.wasm')) &&
    fs.existsSync(path.join(ZKP_DIR, 'eligibility_final.zkey'))
  );
}
