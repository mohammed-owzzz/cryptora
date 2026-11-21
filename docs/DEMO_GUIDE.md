# Demonstration & Review Guide

A 15-minute script for a final-year project review. Every expected value is from the deterministic seed, so
the walkthrough will match on a fresh database.

## 0. Before the review

```bash
npm install
npm run db:push
npm run seed        # prints the dataset summary and demo credentials
npm run dev         # API :4000, client :5173
```

Open <http://localhost:5173>. If you have already cast a demo ballot, run `npm run seed` again to return to
the canonical 8,526 ballots.

To rehearse the production bundle instead: `npm run build && npm start` serves the same SPA and API from
<http://localhost:4000> (deep links such as `/docs/zkp` are supported).

**Credentials**

| Role | Identifier | Password |
| --- | --- | --- |
| Admin | `admin@cryptora.demo` | `Admin@1234!` |
| Voter | `VOTER-2026-0042` | `Voter@1234!` |
| Auditor | `jordan@cryptora.demo` + `AUD-2026-001` | `Auditor@1234!` |

---

## 1. Public site (2 minutes)

1. Home page: hero, live statistics, featured elections, how-it-works.
2. `/security`: the three mechanisms — eligibility proofs, Merkle roots, consortium consensus.
3. `/results`: published tallies for completed elections.
4. `/docs`: the documentation portal rendering the six repository Markdown files, with search, table of
   contents and copy-code buttons.

**What to say:** the public pages read from `GET /api/public/stats`, the same aggregate source as the
portals, so the numbers cannot drift between pages.

---

## 2. Administrator workspace (4 minutes)

Sign in at `/admin/login`.

1. **Dashboard** — 12,480 voter commitments (12,478 unique accounts), 8 elections, 8,526 verified ballots,
   5 validators, 68.3% participation, ledger `VALID`.
2. **Elections** — filter by status; open `ELEC-2026-003` (completed) and show the lifecycle actions, the
   published Merkle root, the tally and the election's ledger activity. On a draft election the action buttons
   are **Publish**, **Open**, **Close** and **Tally**; `Tally` stays disabled until at least one ballot exists.
3. **Voter Registry** — search `Alex`: the row shows 3 eligible elections and 2 ballots cast. **Export view**
   downloads the currently loaded rows (up to 200). **Register voter** creates an account from the form.
   On a draft election, **Add** and the remove icon manage candidates, and **Import voter CSV** accepts
   `voterNumber,name,faculty` rows.
4. **Candidates** — grouped by election, locked once ballots exist.
5. **Ballot Management** — pick `ELEC-2026-003`: receipt codes, ciphertext counts, commitments, blocks.
   *Point out that no candidate column exists.*
6. **Consortium Network** — validator topology, transactions-per-block chart, recent blocks. Click a block:
   header, transaction Merkle root, all five signatures, transactions.
7. **Validator Nodes** — five Ed25519 keys, signature counts, quorum policy.
8. **ZKP Verification** — 8,526 verified, 0 rejected; 8,524 seeded records and the live proofs; circuit
   parameters and the honest limitation about ballot well-formedness.

Optional: **Reports** — download the CSV and PDF audit report for an election.

---

## 3. The live ballot (5 minutes)

Sign out, then sign in at `/voter/login` as `VOTER-2026-0042`.

1. **Overview** — three eligible elections, two already voted, one open: `ELEC-2026-001`.
2. **Available Elections** → `National Student Council Election 2026` → **Cast ballot**.
3. Select a candidate → **Review ballot**.
4. **Encrypt & submit ballot**. Watch the five stages:
   - *Fetch eligibility witness* — depth-13 Poseidon path
   - *Generate Groth16 proof* — a few seconds, in the browser
   - *Verify proof locally* — before anything is transmitted
   - *Encrypt ballot* — 4 Paillier ciphertexts plus a SHA-256 commitment
   - *Submit to consortium* — nullifier check, five validator signatures against a 4-of-5 quorum, block appended
5. The receipt shows a code such as `CRY-8DC75843353E`, the block number, `5 of 5` approvals, `Groth16 ·
   verified` and the server verification time (~100–200 ms).

**What to say:** the witness is delivered only to this session, the proof and encryption happen in this tab,
and the ledger receives ciphertext only. Reload the page: the election now shows "Ballot recorded", and a
second submission is refused by the single-use nullifier.

6. **My Voting History** — three ballots with receipt codes. Use **Verify a receipt**, paste the code from
   step 5, and see the block, block hash, transaction and ciphertext count.

---

## 4. Auditor workspace (3 minutes)

Sign in at `/auditor/login` with both the email and the auditor ID.

1. **Overview** — independent verification panel, proof distribution, election audit status.
2. **Run ledger verification** — 428 blocks and 17,080 transactions on the seeded dataset; after you cast a
   ballot it reads 429 blocks and 17,082 transactions. Every run reports `VALID`.
3. **Blockchain Ledger** — switch between blocks and transactions, open the newest block, inspect the
   signatures. Verify chain again from here.
4. **ZKP Verification** — filter `LIVE`, pick the proof from your ballot, **Verify**: re-verification against
   the circuit key, public signals shown, duration ~100 ms. Filter `SEEDED` and verify one: the response
   states that no proof payload exists rather than pretending.
5. **Ballot Integrity** — commitment, vector-length and nullifier-parity checks per election: zero failures.
6. **Audit Reports** — preview an election, then export CSV and PDF.

---

## 5. Security demonstration (1 minute)

1. With a **voter** session, request `/api/admin/dashboard` (for example via the browser devtools console):
   `403`. The role check is on the router, not the UI.
2. Show the audit log in the admin workspace: every action above is recorded with actor, target and IP.
3. If time allows, attempt a second ballot with the same credential and show the nullifier rejection.

---

## 6. Questions to expect

**"Is the blockchain real?"**
Hashes, Merkle roots, Ed25519 signatures and the 4-of-5 quorum are real and re-verified from genesis. The
five validators are simulated in one process — stated in the report and in the Validator Nodes page.

**"Can you see who I voted for?"**
No endpoint exposes a ballot's plaintext. The ballot row has no candidate column; the selection exists only
as Paillier ciphertext and is decrypted only in aggregate.

**"How is double voting prevented?"**
An election-scoped nullifier derived from the credential secret; recorded on acceptance and re-checked by
validators before signing.

**"What are the limitations?"**
Single-process consortium, single-key tally custody, no ballot well-formedness circuit, witness delivered to
the browser rather than held in a wallet or HSM, SQLite with `db push`, 1024-bit Paillier, local ceremony.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Cross-origin request rejected` when using curl | The guard compares `Origin` to the `Host` header | Call the API through the Vite proxy (`http://localhost:5173/api/...`) or send a matching `Origin` |
| Ballot submission hangs on "Generate proof" | First load of the ~5 MB artifacts | Wait; subsequent proofs are faster |
| `Eligibility tree failed to reproduce the published Merkle root` | Database edited or partially seeded | `npm run seed` |
| Proof verification fails for every voter | Circuit artifacts out of sync with the verification key | `npm run setup` |
| Port 4000 already in use | A previous API process | Stop it, or set `PORT` in `.env` |
