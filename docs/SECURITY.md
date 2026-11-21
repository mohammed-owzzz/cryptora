# Security Model

## Assets

| Asset | Where it lives | Exposure |
| --- | --- | --- |
| Ballot plaintext | Nowhere — only ciphertext exists after encryption | Never stored |
| Voter credential salt | `Voter.credentialSalt` | Server only; used to derive the secret |
| Tally private key | `Election.tallyPrivateKey` | Server only (documented limitation) |
| Session token | Client cookie; SHA-256 digest in `Session` | `HttpOnly`, `SameSite=Lax` |
| Validator secret keys | `Validator` keypair rows | Server only, used to sign blocks |
| Audit log | `AuditLog` | Append-only through the application |

## Threat model

| Threat | Control |
| --- | --- |
| Vote buying / coercion via receipts | A receipt proves inclusion, never content: it contains a block number and transaction hash, not a candidate |
| Double voting | Election-scoped nullifier, unique per election, re-checked by validators |
| Impersonating a voter | bcrypt password verification plus per-mode login; voter mode requires the voter number |
| Ballot tampering after submission | Encrypted vector commitment plus immutable block hash |
| Ledger rewriting | Hash-linked headers, transaction Merkle roots, 4-of-5 signatures, full-chain verification |
| Privilege escalation | `requireAuth(role)` on every router; a voter session receives 403 on admin routes |
| CSRF on mutations | `requireSameOrigin` rejects any request whose `Origin` host differs from the request host |
| Session theft | Tokens stored only as SHA-256 digests; expiry enforced server-side; "sign out other sessions" |
| Brute force | Eight failed attempts per identifier per ten minutes |
| SQL injection | Prisma parameterised queries only |
| XSS | React escaping; no `dangerouslySetInnerHTML` in the app |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |

## Separation of identity and ballot

This is the central design property, and it is enforced structurally rather than by convention:

- `Ballot` has columns for election, voter, nullifier, receipt, block and timestamp — **no candidate**.
- The selection exists only inside `EncryptedBallot.ciphertexts`.
- `ElectionResult` holds the only candidate totals, produced by decrypting the aggregate.
- No admin, voter or auditor endpoint returns a ballot's plaintext; the auditor's re-verify endpoint works on
  proofs, not ballots.

An administrator with full database access can join `Ballot.voterId` to `EligibleVoter`, learning *who voted*.
They cannot learn *what* was voted without also holding the tally private key and breaking the homomorphic
aggregation. This is the standard "ballot secrecy vs. receipt-freeness" boundary and is stated rather than
overclaimed.

## Cryptographic parameters

| Primitive | Parameter | Notes |
| --- | --- | --- |
| Password hashing | bcrypt, cost 11 | `bcryptjs` |
| Session tokens | 32 random bytes, SHA-256 at rest | 12-hour TTL by default |
| Merkle tree | Poseidon over BN254, depth 13 | 8,192 leaves |
| Eligibility proof | Groth16, BN254 | ~5 MB of proving artifacts, loaded by the browser |
| Ballot encryption | Paillier, 1024-bit modulus | Prototype strength; production uses ≥2048-bit or an EC scheme |
| Commitments | SHA-256 over canonical ciphertext JSON | Compared server-side before consensus |
| Validator signatures | Ed25519 | tweetnacl, base64 keys |

The 1024-bit Paillier modulus is a deliberate prototype choice for demonstration speed. A 2048-bit modulus is
available by changing the `generateKeypair(1024)` call in `server/routes/admin.ts`; expect slower tallying.

## Audit trail

`AuditLog` records actor, role, action, target, detail and IP for authentication, election lifecycle,
registry changes, CSV imports, ballot submission, proof rejection, ledger verification, proof re-checking and
session revocation. The admin workspace exports it as CSV. Auditors can read the trail but cannot write to
any mutation route.

## What an attacker with database access can and cannot do

**Can:** read identities, election metadata, ciphertexts, audit history; delete rows (though doing so breaks
the ledger and the next verification fails).

**Cannot without the tally key:** recover an individual selection, or produce a tally that verifies against
the committed ciphertexts.

**Cannot at all:** forge a ballot for an existing voter without their credential salt, since the nullifier
and proof are bound to it; or rewrite a block without invalidating every subsequent hash.

## Deployment notes

- Set `SESSION_TTL_HOURS` and `PORT` through the environment; the API reads them at start-up.
- Run behind TLS. The cookie is not marked `Secure` in development so that `http://localhost` works; add
  `Secure` when serving over HTTPS.
- Keep `prisma/cryptora.db` and `.env` out of version control.
- Re-run `npm run setup` if you change the circuit; the wasm, zkey and verification key must stay in sync or
  verification will fail for honest voters.
