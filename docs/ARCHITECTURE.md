# Architecture

## Components

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Client | React 18, TypeScript, Vite, Tailwind, React Router 6 | Three role workspaces, the ballot flow, in-browser proving |
| API | Express 4, TypeScript (`tsx` in dev, `tsc` for builds) | Authentication, RBAC, election lifecycle, ballot acceptance, audit |
| Data | SQLite via Prisma 6 | Users, voters, auditors, elections, ballots, ledger, audit log |
| Cryptography | circom2 + snarkjs + poseidon-lite + tweetnacl | Eligibility proofs, Merkle commitments, ciphertext encryption, validator signatures |

The client is a single-page application. Vite proxies `/api` to the API on port 4000 during development; in
production `npm run build` emits `client/dist` and Express serves it, so there is one origin and the
same-origin mutation guard is meaningful.

## Directory map

```
client/src
  components/     design system (ui.tsx), shells, charts, validator network, route guard
  lib/            api.ts (fetch wrapper), auth.tsx (session context), zkp.ts (prover + Paillier),
                  useApi.ts, format.ts, types.ts
  pages/          Home, Access, Login, Marketing, Results, NotFound
    admin/        Dashboard, Elections, Voters, Candidates, Ballots, Blockchain, Operations
    voter/        Dashboard, Elections, Ballot, Account
    auditor/      Dashboard, Workspace
server
  index.ts        app wiring, static hosting, security headers
  routes/         auth.ts, public.ts, admin.ts, voter.ts, auditor.ts
  lib/            auth, hash, merkle, paillier, ed25519, chain, zkp, elections, audit,
                  stats, reports, http, prisma
prisma
  schema.prisma   17 models
  seed.ts         deterministic demonstration dataset
circuits
  eligibility.circom
scripts
  setup-zkp.mjs   compile, powers of tau, groth16 setup, artifact copy
  zkp-smoke.mjs   prove + verify outside the app
```

## Data model

| Model | Purpose |
| --- | --- |
| `User` | Account with a role (`ADMIN`, `VOTER`, `AUDITOR`), bcrypt password hash, optional links |
| `Voter` | Voter number, faculty, credential salt, eligibility state |
| `Auditor` | Auditor number, organisation, accreditation |
| `Session` | SHA-256 digest of the session token, expiry, IP |
| `Election` | Metadata, window, rules, Merkle root and depth, Paillier key material |
| `Candidate` | Ordered ballot entries with a stable `candidateId` |
| `EligibleVoter` | (election, voter) → Poseidon commitment and leaf index |
| `MerkleTree` | Published root, level digests, publication time |
| `Ballot` | Receipt code, nullifier, block number — **no candidate reference** |
| `EncryptedBallot` | Paillier ciphertext vector, modulus, generator, SHA-256 commitment |
| `Nullifier` | Spent nullifiers, unique per election |
| `ZKPProof` | Proof payload, public signals, provenance (`LIVE`/`SEEDED`), status, verify time |
| `Validator` | Node identity with an Ed25519 keypair |
| `BlockchainBlock` | Number, hash, previous hash, transaction Merkle root, approvals, header |
| `ValidatorSignature` | One Ed25519 signature per validator per block |
| `ConsensusRound` | Quorum attempt: votes, required, achieved, timings |
| `BlockchainTransaction` | Typed transaction with canonical payload |
| `ElectionResult` | Published aggregate per candidate |
| `AuditLog` | Actor, role, action, target, detail, IP |

Two properties are deliberate: `Ballot` has no candidate column, and `ElectionResult` is the only place a
candidate total exists.

## Election lifecycle

```
DRAFT ──publish root──▶ SCHEDULED ──open──▶ LIVE ──close──▶ CLOSED ──tally──▶ COMPLETED
```

Each transition writes an audit log entry and commits a transaction to the ledger. Metadata and candidates
are frozen the moment the first ballot is accepted (`PATCH /api/admin/elections/:id` refuses afterwards).

## Ballot acceptance pipeline

`POST /api/voter/elections/:electionId/submit`

1. **Configuration** — election must be `LIVE`, inside its window, with a published root and tally key.
2. **Membership** — the voter must have an `EligibleVoter` row for this election.
3. **Shape** — ciphertext count must equal the candidate count; the SHA-256 commitment must match.
4. **Identity binding** — the submitted nullifier must equal the one derived from this voter's salt, and must
   match public signal 2.
5. **Replay protection** — the nullifier must not already exist for this election.
6. **Proof** — a `PENDING` proof record is written, then verified against the circuit key; the record becomes
   `VERIFIED` or `REJECTED`, and a rejected proof aborts with 400.
7. **Consensus** — `ZKP_VERIFIED` and `BALLOT_ACCEPTED` transactions are committed in one block after 4-of-5
   validator signatures.
8. **Persistence** — the ballot row, encrypted vector and spent nullifier are written in one transaction.
9. **Receipt** — receipt code, block hash, transaction hash and validator list are returned.

## Request lifecycle and RBAC

Every router mounts `requireAuth(role)` before its handlers, so a route cannot be added without a role
check. Client-side guards (`RequireRole`) only improve the experience; they are not the security boundary.
A voter session calling an admin endpoint returns **403**, which is verified in the demo script.

## Error handling

`asyncHandler` wraps every handler so a rejected promise becomes a JSON error instead of a hung request.
`fail(message, status)` produces `{ "error": string }`; the client surfaces `error` verbatim in toasts and
inline callouts.
