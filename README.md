# CRYPTORA

**A secure, privacy-preserving e-voting platform built on a consortium blockchain and zero-knowledge proofs.**

CRYPTORA separates three questions that conventional e-voting systems conflate:

| Question | Mechanism |
| --- | --- |
| *Who is allowed to vote?* | Poseidon Merkle tree of voter commitments, published as a root on the ledger |
| *What was submitted?* | A Paillier ciphertext vector, encrypted in the voter's browser |
| *Has anything been altered?* | An append-only block chain signed by five validators with a 4-of-5 quorum |

Nothing in the system stores a plaintext ballot, and no API response joins a voter identity to a candidate
selection.

---

## Quick start

```bash
npm install                 # installs root + client dependencies and generates the Prisma client
npm run setup               # compiles the Circom circuit and produces the Groth16 keys (optional: artifacts are committed)
npm run db:push             # creates prisma/cryptora.db from the schema
npm run seed                # builds the demonstration dataset
npm run dev                 # API on :4000, Vite on :5173
```

Open <http://localhost:5173>. To run the production bundle instead: `npm run build && npm start`, then open
<http://localhost:4000> (the compiled server serves the SPA, including deep links such as `/docs/zkp`).

| Role | Identifier | Credential |
| --- | --- | --- |
| Administrator | `admin@cryptora.demo` | `Admin@1234!` |
| Voter | `VOTER-2026-0042` (Alex Morgan) | `Voter@1234!` |
| Auditor | `jordan@cryptora.demo` + Auditor ID `AUD-2026-001` | `Auditor@1234!` |

Other scripts:

```bash
npm run build        # type-check and bundle the client, then compile the server to dist/
npm start            # serve the built client and API from :4000
npm test             # Vitest — hashing, Merkle membership, Paillier tallying, Ed25519
npm run seed         # reset the demonstration dataset at any time
```

---

## Demonstration dataset

The seed is deterministic, so every figure below is identical on every machine:

| Figure | Value |
| --- | --- |
| Voter commitments | 12,480 (12,478 unique accounts) |
| Elections | 8 (3 current + 5 historical) |
| Ballots | 8,526 |
| Verified proofs | 8,526 (0 rejected) |
| Validator nodes | 5, quorum 4 |
| Ledger blocks | 428 |
| Participation | 68.3% |

`ELEC-2026-001` and `ELEC-2026-002` are **LIVE**, `ELEC-2026-003` and the five historical elections are
**COMPLETED** with published tallies. Alex Morgan is eligible in 001/002/003 and has already voted in 002
and 003 — **ELEC-2026-001 is the live voting demonstration**.

Historical ballots carry genuine Paillier ciphertexts and genuine Merkle commitments, but their proof
records are marked `provenance: SEEDED` because the seed does not run a Groth16 prover for 8,500 ballots.
Two of Alex's ballots carry real, browser-generated Groth16 proofs (`provenance: LIVE`), and every ballot
cast through the UI is `LIVE`.

---

## Architecture at a glance

```
client/            React 18 + TypeScript + Vite + Tailwind
  src/pages        public site, three role workspaces, the ballot flow
  src/lib          API client, auth context, browser-side prover + Paillier
  public/zkp       eligibility.wasm + eligibility_final.zkey (Groth16)
server/            Express 4 + TypeScript
  routes           auth, public, admin, voter, auditor
  lib              merkle, paillier, ed25519, chain, zkp, reports, audit, stats
prisma/            schema + deterministic seed (SQLite)
circuits/          eligibility.circom (depth-13 Poseidon membership + nullifier)
docs/              architecture, blockchain, ZKP, security, demo guide
tests/             Vitest cryptography suite
```

### Ballot pipeline

1. The voter authenticates; the session cookie is `HttpOnly` and `SameSite=Lax`.
2. `GET /api/voter/elections/:id/witness` returns **only that voter's** Merkle path, secret and nullifier.
3. The browser generates a Groth16 proof with `snarkjs.groth16.fullProve` and verifies it locally.
4. The browser encrypts a one-hot vector with the election's Paillier public key and commits to it with SHA-256.
5. The server verifies the proof against the circuit verification key, checks the commitment, enforces the
   single-use nullifier, collects 4-of-5 validator signatures and appends a block.
6. The voter receives a receipt code, the block number and the transaction hash.

### Reading further

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, data model, request lifecycle
- [`docs/BLOCKCHAIN.md`](docs/BLOCKCHAIN.md) — block format, consensus, verification
- [`docs/ZKP.md`](docs/ZKP.md) — circuit, witness, proving and verification
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model and controls
- [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) — a review script with expected outputs

---

## Honest limitations

These are properties of this build, stated plainly rather than hidden:

1. **The consortium is simulated.** Five validators are independent database identities with genuine
   Ed25519 keypairs and independent validation routines, but they run inside one Node process rather than
   on five institutional machines. There is no network partition, gossip or Byzantine fault simulation.
2. **Tally key custody is single-key.** Each election's Paillier private key is stored on the server. A
   production system would split it across independent trustees with threshold decryption.
3. **No ballot well-formedness circuit.** The circuit proves eligibility and nullifier derivation, not that
   the encrypted vector is exactly one-hot. That property is approximated by server-side length checks and
   the ciphertext commitment, not by a range proof.
4. **Witness delivery.** The credential secret is derived server-side and delivered to the voter's own
   browser over the authenticated session. There is no hardware token, wallet or national e-ID integration.
5. **SQLite + `prisma db push`.** The schema is applied by push rather than versioned migrations, which is
   appropriate for a single-machine demonstration.
6. **Proof artifacts are ~5 MB.** The first ballot generates a proof in a few seconds while `snarkjs` loads
   the wasm and zkey; server-side verification takes roughly 100–200 ms.
