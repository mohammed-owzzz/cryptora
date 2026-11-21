import crypto from 'node:crypto';

/** Deterministic JSON serialisation — key order is normalised so that hashes are stable. */
export function canonical(value: unknown): string {
  const walk = (v: any): any => {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

export function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function sha256Canonical(value: unknown): string {
  return sha256(canonical(value));
}

export function randomHex(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function shortHash(hash: string, head = 6, tail = 4): string {
  if (!hash) return '';
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

export const ZERO_HASH = '0'.repeat(64);
