import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import nacl from 'tweetnacl';

/** Ed25519 validator identities and signature helpers. */

export interface ValidatorKeypair {
  publicKey: string; // base64
  secretKey: string; // base64
}

/** DER prefix that wraps a raw 32-byte Ed25519 key as a SubjectPublicKeyInfo. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const keyCache = new Map<string, ReturnType<typeof createPublicKey>>();

function publicKeyFor(publicKeyB64: string) {
  const cached = keyCache.get(publicKeyB64);
  if (cached) return cached;
  const raw = Buffer.from(publicKeyB64, 'base64');
  if (raw.length !== 32) return null;
  const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
  // Validator sets are small and fixed; still bound the cache defensively.
  if (keyCache.size > 64) keyCache.clear();
  keyCache.set(publicKeyB64, key);
  return key;
}

export function newValidatorKeypair(): ValidatorKeypair {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(kp.publicKey).toString('base64'),
    secretKey: Buffer.from(kp.secretKey).toString('base64'),
  };
}

export function signMessage(secretKeyB64: string, message: string): string {
  const sk = Buffer.from(secretKeyB64, 'base64');
  const sig = nacl.sign.detached(Buffer.from(message, 'utf8'), sk);
  return Buffer.from(sig).toString('base64');
}

/**
 * Verifies a detached Ed25519 signature. Uses Node's native implementation,
 * which is functionally identical to tweetnacl's but two orders of magnitude
 * faster — verifying a full ledger re-checks thousands of signatures.
 */
export function verifySignature(publicKeyB64: string, message: string, signatureB64: string): boolean {
  try {
    const signature = Buffer.from(signatureB64, 'base64');
    if (signature.length === 64) {
      const key = publicKeyFor(publicKeyB64);
      if (key) return cryptoVerify(null, Buffer.from(message, 'utf8'), key, signature);
    }
  } catch {
    /* fall back to the pure-JS verifier below */
  }
  try {
    return nacl.sign.detached.verify(
      Buffer.from(message, 'utf8'),
      Buffer.from(signatureB64, 'base64'),
      Buffer.from(publicKeyB64, 'base64'),
    );
  } catch {
    return false;
  }
}
