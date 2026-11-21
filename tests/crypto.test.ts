import { describe, expect, it } from 'vitest';
import { poseidon2 } from 'poseidon-lite';
import { canonical, sha256, sha256Canonical } from '../server/lib/hash';
import {
  MERKLE_DEPTH,
  authPath,
  buildTree,
  deriveSecret,
  electionFieldId,
  leafCommitment,
  nullifierFor,
} from '../server/lib/merkle';
import { aggregate, decrypt, encryptVector, generateKeypair, tallyCiphertexts } from '../server/lib/paillier';
import { newValidatorKeypair, signMessage, verifySignature } from '../server/lib/ed25519';

describe('canonical hashing', () => {
  it('is independent of object key order', () => {
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
    expect(sha256Canonical({ b: 1, a: 2 })).toBe(sha256Canonical({ a: 2, b: 1 }));
  });

  it('produces a 64-character digest', () => {
    expect(sha256('cryptora')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('eligibility Merkle tree', () => {
  const secrets = Array.from({ length: 5 }, (_, i) => deriveSecret(`salt-${i}`, 'ELEC-TEST-001'));
  const leaves = secrets.map((s) => leafCommitment(s));
  const tree = buildTree(leaves);

  it('keeps the circuit depth constant', () => {
    expect(tree.levels.length).toBe(MERKLE_DEPTH + 1);
    expect(tree.levels[0].length).toBe(2 ** MERKLE_DEPTH);
  });

  it('recomputes the root from any authentication path', () => {
    for (let leafIndex = 0; leafIndex < secrets.length; leafIndex++) {
      const path = authPath(tree, leafIndex);
      expect(path.pathElements).toHaveLength(MERKLE_DEPTH);

      let node = leafCommitment(secrets[leafIndex]);
      for (let d = 0; d < MERKLE_DEPTH; d++) {
        const sibling = BigInt(path.pathElements[d]);
        // pathIndices[d] === '1' means the current node is the right child.
        const isRight = path.pathIndices[d] === '1';
        node = isRight ? poseidon2([sibling, node]) : poseidon2([node, sibling]);
      }
      expect(node).toBe(tree.root);
    }
  });

  it('does not accept a commitment from outside the set', () => {
    const outsider = leafCommitment(deriveSecret('not-registered', 'ELEC-TEST-001'));
    const forged = buildTree([...leaves.slice(0, 4), outsider]).root;
    expect(forged).not.toBe(tree.root);
  });

  it('scopes nullifiers per election and voter', () => {
    const a = electionFieldId('ELEC-TEST-001');
    const b = electionFieldId('ELEC-TEST-002');
    expect(nullifierFor(secrets[0], a)).toBe(nullifierFor(secrets[0], a));
    expect(nullifierFor(secrets[0], a)).not.toBe(nullifierFor(secrets[0], b));
    expect(nullifierFor(secrets[0], a)).not.toBe(nullifierFor(secrets[1], a));
  });
});

describe('Paillier homomorphic tally', () => {
  const { publicKey, privateKey } = generateKeypair(512);

  it('decrypts an encrypted one-hot vector', () => {
    const vector = encryptVector(publicKey, [0, 1, 0]);
    const tallies = tallyCiphertexts(privateKey, vector.map((c) => BigInt(c.toString())));
    expect(tallies).toEqual([0, 1, 0]);
  });

  it('aggregates many ballots without decrypting any single one', () => {
    const ballots = [
      [1, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ].map((oneHot) => encryptVector(publicKey, oneHot));

    const aggregated = [0, 1, 2].map((index) =>
      aggregate(
        ballots.map((b) => b[index]),
        publicKey.n,
      ),
    );

    expect(tallyCiphertexts(privateKey, aggregated)).toEqual([3, 1, 1]);
  });

  it('never reveals the message through the ciphertext', () => {
    const ciphertext = encryptVector(publicKey, [1])[0];
    expect(ciphertext.toString()).not.toBe('1');
    expect(decrypt(privateKey, ciphertext)).toBe(1n);
  });
});

describe('validator signatures', () => {
  const pair = newValidatorKeypair();

  it('verifies a genuine Ed25519 signature', () => {
    const message = sha256Canonical({ blockNumber: 12, previousHash: 'abc' });
    const signature = signMessage(pair.secretKey, message);
    expect(verifySignature(pair.publicKey, message, signature)).toBe(true);
  });

  it('rejects a tampered header or signature', () => {
    const message = sha256Canonical({ blockNumber: 12, previousHash: 'abc' });
    const signature = signMessage(pair.secretKey, message);
    expect(verifySignature(pair.publicKey, sha256Canonical({ blockNumber: 13, previousHash: 'abc' }), signature)).toBe(false);
    expect(verifySignature(pair.publicKey, message, signMessage(newValidatorKeypair().secretKey, message))).toBe(false);
  });
});
