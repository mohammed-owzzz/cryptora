import crypto from 'node:crypto';
import { poseidon1, poseidon2 } from 'poseidon-lite';

/** BN254 scalar field prime — must match the Circom circuit's field. */
export const FIELD_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Merkle depth of the eligibility circuit (2^13 = 8,192 leaves per election). */
export const MERKLE_DEPTH = 13;

export interface MerkleLevels {
  levels: bigint[][];
  root: bigint;
}

/** Election identifier reduced into the circuit field (public input #2). */
export function electionFieldId(electionId: string): bigint {
  const digest = crypto.createHash('sha256').update(electionId).digest('hex');
  return BigInt('0x' + digest) % FIELD_PRIME;
}

/** Leaf commitment for a voter credential: Poseidon(secret). */
export function leafCommitment(secret: bigint): bigint {
  return poseidon1([secret]);
}

/** Election-scoped nullifier: Poseidon(secret, electionFieldId). */
export function nullifierFor(secret: bigint, fieldId: bigint): bigint {
  return poseidon2([secret, fieldId]);
}

/** Deterministic per-voter, per-election secret derived from the stored credential. */
export function deriveSecret(credential: string, electionId: string): bigint {
  const digest = crypto.createHash('sha256').update(`${credential}:${electionId}`).digest('hex');
  return BigInt('0x' + digest) % FIELD_PRIME;
}

/**
 * Builds a fixed-depth Merkle tree. Unused leaves are zero, so the root is a
 * commitment to exactly the registered set while keeping the depth constant.
 */
export function buildTree(leaves: bigint[], depth = MERKLE_DEPTH): MerkleLevels {
  if (leaves.length > 2 ** depth) {
    throw new Error(`Too many leaves (${leaves.length}) for depth ${depth}`);
  }
  let level = leaves.slice();
  while (level.length < 2 ** depth) level.push(0n);
  const levels: bigint[][] = [level];
  while (level.length > 1) {
    const next: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(poseidon2([level[i], level[i + 1]]));
    level = next;
    levels.push(level);
  }
  return { levels, root: levels[levels.length - 1][0] };
}

export function authPath(merkle: MerkleLevels, leafIndex: number) {
  const pathElements: string[] = [];
  const pathIndices: string[] = [];
  let idx = leafIndex;
  for (let d = 0; d < merkle.levels.length - 1; d++) {
    const level = merkle.levels[d];
    const sibling = idx % 2 === 0 ? level[idx + 1] : level[idx - 1];
    pathElements.push(sibling.toString());
    pathIndices.push(String(idx % 2));
    idx = Math.floor(idx / 2);
  }
  return { pathElements, pathIndices };
}

/** Compact audit representation of the tree (levels as hex digests). */
export function levelsDigest(merkle: MerkleLevels): string {
  return JSON.stringify(
    merkle.levels.map((lvl) => lvl.slice(0, 8).map((v) => '0x' + v.toString(16).slice(0, 16))),
  );
}
