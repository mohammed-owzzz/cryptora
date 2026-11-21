import crypto from 'node:crypto';

/**
 * Paillier additively-homomorphic encryption (prototype implementation).
 *
 * A ballot is encoded as a one-hot vector [b_0 .. b_{n-1}] with exactly one 1.
 * Encrypting each component independently yields ciphertexts that multiply
 * homomorphically, so component-wise aggregation of ciphertexts decrypts to the
 * candidate totals without ever decrypting an individual ballot.
 *
 * NOTE: this is a local single-key prototype. Real elections require threshold
 * decryption with distributed trustees — see docs/SECURITY.md.
 */

export interface PublicKey {
  n: string;
  g: string;
  bits: number;
}

export interface PrivateKey {
  lambda: string;
  mu: string;
  n: string;
}

export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
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

export function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a % m, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1n) throw new Error('Value is not invertible');
  return ((old_s % m) + m) % m;
}

function randomBelow(max: bigint): bigint {
  const bytes = Math.ceil(max.toString(2).length / 8) + 8;
  let v = BigInt('0x' + crypto.randomBytes(bytes).toString('hex'));
  return v % max;
}

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n];

function isProbablePrime(n: bigint, rounds = 24): boolean {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    s += 1n;
  }
  for (let i = 0; i < rounds; i++) {
    const a = 2n + randomBelow(n - 3n);
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let r = 1n; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

function randomPrime(bits: number): bigint {
  for (;;) {
    let candidate = randomBelow(1n << BigInt(bits)) | (1n << BigInt(bits - 1)) | 1n;
    // ensure it is odd and top bit set
    candidate |= 1n;
    if (isProbablePrime(candidate)) return candidate;
  }
}

export function generateKeypair(bits = 1024): { publicKey: PublicKey; privateKey: PrivateKey } {
  const half = Math.floor(bits / 2);
  for (;;) {
    const p = randomPrime(half);
    const q = randomPrime(half);
    if (p === q) continue;
    const n = p * q;
    if (n.toString(2).length < bits - 1) continue;
    const lambda = (p - 1n) * (q - 1n) / gcd(p - 1n, q - 1n);
    const g = n + 1n;
    let mu: bigint;
    try {
      mu = modInverse(lambda, n);
    } catch {
      continue;
    }
    return {
      publicKey: { n: n.toString(), g: g.toString(), bits },
      privateKey: { lambda: lambda.toString(), mu: mu.toString(), n: n.toString() },
    };
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

function randomCoprime(n: bigint): bigint {
  for (;;) {
    const r = randomBelow(n);
    if (r > 1n && gcd(r, n) === 1n) return r;
  }
}

export function encrypt(pub: PublicKey, message: number | bigint): bigint {
  const n = BigInt(pub.n);
  const g = BigInt(pub.g);
  const n2 = n * n;
  const m = BigInt(message);
  const r = randomCoprime(n);
  return (modPow(g, m, n2) * modPow(r, n, n2)) % n2;
}

/** Encrypts a one-hot ballot vector, one ciphertext per candidate slot. */
export function encryptVector(pub: PublicKey, oneHot: number[]): bigint[] {
  return oneHot.map((m) => encrypt(pub, m));
}

export function aggregate(ciphertexts: (string | bigint)[], nStr: string): bigint {
  const n2 = BigInt(nStr) * BigInt(nStr);
  return ciphertexts.reduce<bigint>((acc, c) => (acc * BigInt(c)) % n2, 1n);
}

export function decrypt(priv: PrivateKey, ciphertext: string | bigint): bigint {
  const n = BigInt(priv.n);
  const n2 = n * n;
  const lambda = BigInt(priv.lambda);
  const mu = BigInt(priv.mu);
  const c = BigInt(ciphertext);
  const u = modPow(c, lambda, n2);
  const l = (u - 1n) / n;
  return (l * mu) % n;
}

export function tallyCiphertexts(priv: PrivateKey, aggregated: bigint[]): number[] {
  return aggregated.map((c) => Number(decrypt(priv, c)));
}
