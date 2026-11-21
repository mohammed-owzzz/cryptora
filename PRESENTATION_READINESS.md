# CRYPTORA — Presentation Readiness Report

Final QA pass for the review at Shree L.R. Tiwari College of Engineering.
Everything below was exercised against the running application on this machine, not inferred from source.

**Verdict:** ready to present. No blocker remains for the scripted demonstration. The system is a
single-machine academic prototype: the consortium and its validators are simulated in one Node process,
and no smart contracts are deployed (details in *Known limitations*).

---

## 1. Startup

### Requirements

| Item | Value |
| --- | --- |
| Node.js | 20 or newer (uses ESM, `tsx`, Vite 5) |
| npm | 10+ |
| Ports | `4000` (API) and `5173` (Vite dev server) |
| Database | SQLite file at `prisma/cryptora.db` — no server to install |
| External services | None required. Google Fonts are fetched for the intended typography; without internet the UI falls back to system fonts |
| ZKP artifacts | Committed in `client/public/zkp/` (~5 MB wasm + zkey) and `zkp/build/` (verification key). `npm run setup` only regenerates them |

### Development (the presentation command)

```bash
cd /Users/mohammed.owzzz/Desktop/owaiz/cryptora
npm install          # root + client deps, runs prisma generate
npm run db:push      # applies prisma/schema.prisma (no-op when the DB already matches)
npm run seed         # optional reset to the canonical dataset — see warning below
npm run dev          # API :4000 + Vite :5173 together
```

Open <http://localhost:5173>. `npm run dev` is the recommended way to present: hot reload, readable
errors, no build step between demos.

### Production-mode rehearsal (verified)

```bash
npm run build        # client bundle + compiled server in dist/
npm start            # serves SPA and API from :4000
```

Open <http://localhost:4000>. Deep links (`/docs/zkp`, `/admin/dashboard`) return 200 and the correct
page. This path was broken before the audit (the compiled server looked for `dist/client` instead of
`client/dist`); it is fixed in `server/index.ts`.

### Environment

`.env` is present and only needs the documented, non-secret values (same keys as `.env.example`):

```
DATABASE_URL="file:./prisma/cryptora.db"
PORT=4000
NODE_ENV=development
SESSION_TTL_HOURS=8
CONSENSUS_THRESHOLD=4
```

No API keys, cloud services or credentials are required at runtime.

### Database reset warning

`npm run seed` **deletes and rebuilds the demonstration data** (elections, ballots, proofs, ledger, users).
It is deterministic: 12,480 eligibility commitments, 8 elections, 8,526 ballots and proofs, 428 blocks,
17,080 transactions. Run it before the review, never during it, unless you intend to reset the demo.

---

## 2. Accounts and demonstration data

| Role | Sign in at | Identifier | Password |
| --- | --- | --- | --- |
| Administrator | `/admin/login` | `admin@cryptora.demo` | `Admin@1234!` |
| Voter (Alex Morgan) | `/voter/login` | `VOTER-2026-0042` | `Voter@1234!` |
| Auditor (Jordan Blake) | `/auditor/login` | `jordan@cryptora.demo` + `AUD-2026-001` | `Auditor@1234!` |

Each login page has a **Fill form** button that inserts its own demo credentials; no typing is needed on
stage. Wrong credentials return 401 and a visible error, without revealing which field was wrong.

Canonical figures after `npm run seed`:

| Figure | Value |
| --- | --- |
| Voter commitments | 12,480 (12,478 unique accounts — two voters are eligible in more than one election) |
| Elections | 8 (2 live, 6 completed) |
| Ballots / verified proofs | 8,526 / 8,526 (0 rejected) |
| Ledger blocks / transactions | 428 / 17,080 |
| Validators | 5 with Ed25519 keys, quorum 4 |
| Participation | 68.3% |

Alex Morgan is eligible in `ELEC-2026-001`, `002` and `003`, and has already voted in `002` and `003`.
`ELEC-2026-001` is the live ballot used in the demonstration. Two of Alex's seeded ballots carry real
Groth16 proofs (`LIVE` provenance); the other 8,524 records are marked `SEEDED` and say so in the UI.

**This database has been reseeded at the end of the audit**, so the numbers above are the current state
and the temporary QA election created during testing is gone.

---

## 3. Demonstration sequence (15 minutes)

Full narration is in `docs/DEMO_GUIDE.md` (also in the site at `/docs/demo-guide`). Short version:

1. **Home** (`/`) — problem statement, live aggregate stats, architecture strip. Stats come from
   `/api/public/stats`, the same source as every portal.
2. **How it works** (`/how-it-works`) — eight-stage ballot pipeline diagram; hover/select stages.
3. **Documentation** (`/docs`) — six documents rendered from the repository Markdown. Search
   "nullifier", open a result, show the copy-code button and the mobile documentation menu.
4. **Administrator** (`/admin/login` → Fill form): dashboard (12,480 commitments, 8,526 ballots, ledger
   valid), elections filter, `ELEC-2026-003` detail (Merkle root, tally, ledger activity), block modal on
   `/admin/blockchain` (hash, Merkle root, five signatures), voter search "Alex", reports CSV/PDF.
   On a draft election the lifecycle buttons are **Publish → Open → Close → Tally**; `Tally` is disabled
   until ballots exist.
5. **Voter** (`/voter/login` → Fill form): Overview shows 3 eligible elections, 2 voted, 1 open. Open
   `ELEC-2026-001` → **Cast ballot** → select a candidate → **Review ballot** → **Encrypt & submit
   ballot**. The five stages run live: witness fetch, in-browser Groth16 proof (a few seconds on first
   use), local verification, Paillier encryption, submission. Receipt shows the code, block number,
   5-of-5 approvals, `Groth16 · verified` and server verification time (~100–200 ms).
6. **Duplicate prevention** — reload the election: "View receipt / your ballot for this election is
   recorded"; `/voter/.../vote` refuses with a nullifier message; the witness endpoint returns HTTP 409.
7. **Voting history** — three ballots, **Verify a receipt** returns block, block hash, transaction and
   ciphertext count.
8. **Auditor** (`/auditor/login` with email + ID): **Run ledger verification** (428 blocks, 17,080
   transactions, 2,140 Ed25519 signatures, `VALID`), open the newest block, filter `LIVE` proofs and
   **Verify** the proof cast in step 5 (re-verification ~100 ms), show Ballot Integrity and read-only
   restrictions.
9. **Close** — limitations: simulated consortium, single-key tally custody, no ballot well-formedness
   proof, witness delivered in-browser, SQLite.

If you cast a live ballot, the auditor numbers become 429 blocks / 17,082 transactions. Run `npm run seed`
afterwards to return to the canonical dataset.

---

## 4. Test results

### 4.1 Startup, build, tests

| Check | Status | Evidence |
| --- | --- | --- |
| Dev startup (`npm run dev`) | **PASS** | API `:4000`, Vite `:5173` both listening; public stats and all portals reachable |
| Production build (`npm run build`) | **PASS** | Client built (~569 kB index) and server compiled with 0 errors |
| Production start (`npm start`) | **PASS (fixed)** | Home, `/docs/zkp`, `/admin/dashboard` and hashed assets return 200 with the correct title |
| TypeScript client | **PASS** | `tsc -p client/tsconfig.json --noEmit` → 0 |
| TypeScript server | **PASS** | `tsc -p tsconfig.server.json --noEmit` → 0 |
| Unit tests | **PASS** | `npm test` → 11/11 (hashing, Merkle membership, Paillier tally, Ed25519) |
| Seed / reset | **PASS** | Rebuilt 8 elections, 8,526 ballots, 428 blocks, 17,080 transactions; ledger `VALID` |
| ZKP artifacts present | **PASS** | `/api/public/zkp-status` → `artifactsReady: true`, Groth16 / BN254 / depth 13 |

### 4.2 Route audit

Every route below was opened in a real browser. All rendered content, had correct permissions, no blank
screens, and (after a clean reload) no console errors. Direct-URL reload was verified for public pages and
the documentation; production SPA fallback verified for deep links.

| Area | Routes tested | Status |
| --- | --- | --- |
| Public | `/`, `/platform`, `/security`, `/how-it-works`, `/about`, `/results`, `/access` | **PASS** |
| Auth | `/admin/login`, `/voter/login`, `/auditor/login` | **PASS** (real form submissions for all three roles) |
| Admin | `/admin/dashboard`, `/elections`, `/elections/create`, `/elections/:id`, `/voters`, `/candidates`, `/ballot-management`, `/results`, `/blockchain`, `/validators`, `/ledger`, `/zkp-verification`, `/audit-logs`, `/reports`, `/settings` | **PASS** |
| Voter | `/voter/dashboard`, `/elections`, `/elections/:id`, `/elections/:id/vote`, `/history`, `/results`, `/profile`, `/security`, `/help` | **PASS** |
| Auditor | `/auditor/dashboard`, `/elections`, `/ledger`, `/zkp-verification`, `/validators`, `/ballot-integrity`, `/reports`, `/profile`, `/security`, `/help` | **PASS** |
| Docs | `/docs`, `/docs/getting-started`, `/architecture`, `/blockchain`, `/zkp`, `/security`, `/demo-guide` | **PASS** |
| Error | unknown URL → 404 page; admin URL as auditor → redirected, API returns 403 | **PASS** |

Known-dev-only note: in `vite dev`, React StrictMode issues each GET twice. This is not present in the
production bundle and does not change data (all mutations are POST).

### 4.3 Documentation

Compared rendered pages with the six source files:

| Document | Headings | Code blocks | Tables | Status |
| --- | --- | --- | --- | --- |
| `README.md` | 7 → 8 with page title | 3 → 3 | 3 | **PASS** |
| `docs/ARCHITECTURE.md` | 8 → 9 | 2 → 2 | 2 | **PASS** |
| `docs/BLOCKCHAIN.md` | 9 → 10 | 2 → 2 | 1 | **PASS** |
| `docs/ZKP.md` | 9 → 10 | 4 → 4 | 1 | **PASS** |
| `docs/SECURITY.md` | 8 → 9 | 0 → 0 | 3 | **PASS** |
| `docs/DEMO_GUIDE.md` | 9 → 10 | 1 → 1 | 2 | **PASS** |

Search (cross-document, deep links), TOC, previous/next, copy-code buttons, sanitised rendering and mobile
documentation navigation were checked. No raw Markdown syntax appears. Documents are imported from the
repository with `?raw` and rendered with `marked` + DOMPurify; no rewritten copies.

*Limitation:* smooth scrolling to an anchor could not be observed while the browser tab was in the
background (Chromium throttles smooth scroll); the same-page links execute and update the URL, and the
page scrolls normally with `scroll-behavior: auto`.

### 4.4 Role workflows

| Workflow | Status | Notes |
| --- | --- | --- |
| Admin login → dashboard | **PASS** | Figures match the API and the seed |
| Admin create election (validation, draft creation, 250 commitments) | **PASS** | Empty-form error now scrolls into view; a test election was created and removed by the reseed |
| Publish eligibility root → Open voting → Close election | **PASS** | Statuses DRAFT/SCHEDULED → LIVE → CLOSED; ledger blocks committed with 5 approvals |
| Tally with zero ballots | **PASS (guarded)** | Button disabled with hint "No accepted ballots to tally"; server would reject it |
| Voter registry search ("Alex") | **PASS (fixed)** | Was client-side over only 200 loaded rows and returned nothing; now queries the API and finds Alex Morgan (3 elections, 2 ballots) |
| Reports CSV + PDF | **PASS** | Real files: `text/csv` 728 B, `application/pdf` 2.6 kB with attachment filenames |
| Block detail modal | **PASS** | Header, previous hash, Merkle root, five signatures, quorum label |
| Voter login → eligibility → ballot → proof → submit | **PASS** | Real Groth16 proof, server verification 116 ms, receipt and block #428 |
| Duplicate vote prevention | **PASS** | UI blocks the route; witness endpoint 409; one ballot per credential |
| Receipt verification | **PASS** | Seeded receipt resolved to block, hash, transaction and 3 ciphertexts |
| Auditor login + read-only enforcement | **PASS** | Admin/voter APIs return 403 from an auditor session |
| Auditor ledger verification | **PASS** | 428 blocks, 17,080 transactions, 2,140 signatures, `VALID` |
| Auditor proof re-verification | **PASS** | Live proof re-checked against the verification key (~100 ms) |
| Admin register voter | **PASS** | Created `VOTER-2027-99001` through the modal; found immediately in registry search (total 12,481) |
| Admin CSV roster import | **PASS (fixed)** | The default two-row CSV now imports both voters and the draft roster grows to 2 |
| Admin candidate add/remove | **PASS** | Added “Workflow Gamma”, removed “Workflow Beta” on a draft; audit entries written; controls disabled once ballots exist or the election is not a draft |
| Admin settings page | **PASS (read-only by design)** | Shows environment, consensus and circuit parameters; no runtime editing is offered, matching the page copy |
| Auditor report preview + CSV/PDF export | **PASS** | Inline report renders live data; CSV 728 B `text/csv`, PDF 2.6 kB `application/pdf` |
| Logout (shared account menu/sidebar) | **PASS** | Auditor sign-out redirected to `/auditor/login`; `/api/auth/me` returned 401 afterwards. Same control is used by all roles |

### 4.5 Cryptography, ledger and contracts

| Item | Status | Evidence |
| --- | --- | --- |
| Groth16 proof generation | **PASS** | Real browser proof from the committed wasm/zkey |
| Local + server verification | **PASS** | `Groth16 · verified`, server 116 ms, public signals bound to root/election/nullifier |
| Independent re-verification | **PASS** | Auditor endpoint re-ran verification successfully |
| Duplicate nullifier | **PASS** | Second witness request → 409 `A ballot has already been submitted` |
| Invalid/tampered proof rejection | **PASS** | A forged Groth16 proof sent with valid ciphertexts and commitment was rejected with 400 `Zero-knowledge proof rejected: Groth16 verification failed`; ballot count stayed 8,526 and the witness remained available |
| Ledger hash chain, Merkle roots, Ed25519 signatures | **PASS** | Recomputed from genesis by the auditor: `VALID`, 428 blocks, 2,140 signatures |
| Consensus / QBFT 4-of-5 | **SIMULATED** | Five validator identities and independent validation logic inside one Node process; real signatures, no network/gossip/partitions |
| External chain, RPC, deployed nodes | **NOT IMPLEMENTED** | No Besu/Quorum network is started by this project |
| Smart contracts | **NOT IMPLEMENTED** | No Solidity contracts; election/ballot rules are enforced in server code |

### 4.6 Responsive, browser and network

| Width | Routes checked | Overflow | Status |
| --- | --- | --- | --- |
| 360 px | public, docs, admin dashboard/detail/ballots/ledger, results | 0 px | **PASS** |
| 390 px | same set | 0 px | **PASS** |
| 768 px | public, docs, auditor dashboard/ZKP/ledger | 0 px | **PASS** |
| 1920 px | public, docs, auditor dashboard/ledger/integrity, results | 0 px | **PASS** |

Wide tables scroll inside their own containers rather than the page. Fonts, brand images and bundles all
loaded with 200/304; no missing assets or failed API requests after a clean reload. Console was clear
(the only 4xx entries seen were the deliberate cross-role and duplicate-vote probes).

### 4.7 Animation and interaction

The central motion system is in place: duration tokens (180/220/280 ms), shared easing, `Reveal`/`Stagger`
entrances, page transitions, button lift/press, nav underlines, modal and toast transitions, chart and
diagram animations, and `prefers-reduced-motion` handling in both Framer Motion (`MotionConfig
reducedMotion="user"`) and CSS (all animation/transition durations reduced to 0.01 ms). Modal, toast,
tabs, diagram tabs, copy buttons, dropdown, mobile menu and form validation were exercised during the
flows above. **Not every control on every page was individually animated-checked** — this was a sampled
audit, not an exhaustive motion test.

### 4.8 Security

| Check | Result |
| --- | --- |
| Unauthenticated API | 401 on admin, voter and auditor routes |
| Cross-role access | 403 from an auditor session to admin/voter APIs; UI routes redirect |
| Cross-origin POST | 403 (`Origin` must match `Host`) |
| Session cookie | `HttpOnly`, `SameSite=Lax`, `Path=/`, max-age set; no token in localStorage |
| Security headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` |
| Password errors | 401 without revealing which field failed |
| Secrets in repository | No `.env` secrets committed; only demo credentials, which are intentionally displayed on the login screens |
| Demo credentials in client bundle | **Present by design** (the "Fill form" buttons and demo panel). Acceptable for an offline academic demo; they must not be reused in a real deployment |

---

## 5. Fixes applied during this audit

| File | Change | Why |
| --- | --- | --- |
| `server/index.ts` | Resolve `client/dist` from the source root or working directory | `npm start` served the API hint instead of the SPA; all deep links 404'd |
| `server/routes/admin.ts` | Search includes faculty; response adds accurate registry summary (eligible, voted, faculties) | Registry search found nothing beyond the first 200 rows; stat tiles implied totals from a sample |
| `client/src/pages/admin/Voters.tsx` | Debounced server-side search; accurate stat tiles; "Export view" label | Search for "Alex" returned zero results before the fix |
| `server/routes/admin.ts` | CSV import skips only the literal header row instead of any ID containing "voter" | The shipped `VOTER-…` IDs were all skipped, so roster import created nobody |
| `client/src/pages/admin/Elections.tsx` | Candidate add/remove modals on draft elections | Server endpoints existed but the admin console had no way to use them |
| `client/src/pages/admin/Elections.tsx` | Validation errors scroll into view (`role="alert"`); action-specific buttons Publish/Open/Close/Tally; tally disabled with no ballots; failure closes the modal; Open requires a published root | Empty submits looked like a dead button; "Run" repeated four times; a zero-ballot tally failed confusingly |
| `client/src/pages/Docs.tsx` | Restore the base document title when leaving documentation | Tab title stayed on the last doc after navigating away |
| `client/src/pages/Login.tsx` | Auditor copy no longer claims MFA | The build authenticates with email + ID + password only |
| `client/src/components/Ledger.tsx` | Block modal reads "5 signatures · quorum 4" | Previously "Quorum 5/4", which reads like an error |
| `client/src/pages/admin/Dashboard.tsx`, `auditor/Dashboard.tsx` | Tile renamed "Voter commitments" | The figure counts eligibility commitments (12,480), not unique accounts (12,478) |
| `README.md`, `docs/DEMO_GUIDE.md` | Production startup, commitments wording, registry/search steps, tally guard, button labels | Keep the in-app documentation identical to the tested behaviour |

No cryptographic formula, circuit constraint, consensus rule or permission boundary was changed.

---

## 6. Known limitations (state these honestly)

1. **Simulated consortium.** Five validators with real Ed25519 keys and real signature checks, but all in
   one Node process. No gossip, partitions or Byzantine fault simulation.
2. **Single-process "blockchain".** Append-only SQLite ledger, not a deployed network; no RPC endpoint.
3. **No smart contracts.** Election and ballot rules live in server code.
4. **Single-key tally custody.** Paillier private keys live on the server; production needs threshold
   trustees.
5. **No ballot well-formedness proof.** The circuit proves eligibility and nullifier derivation, not that
   the ciphertext vector is exactly one-hot.
6. **Witness delivery to the browser.** No wallet, HSM or national e-ID.
7. **SQLite + `prisma db push`.** No versioned migrations.
8. **Demo credentials are public** on the login pages and in the client bundle — fine for a local
   demonstration, unacceptable in production.
9. **Registry export** covers the loaded search results (up to 200 rows), labelled "Export view".
10. **Two accounts are eligible in more than one election**, so unique registry accounts (12,478) differ
    slightly from eligibility commitments (12,480). Labels now distinguish the two.

---

## 7. Troubleshooting during the demo

| Symptom | Cause | Fix |
| --- | --- | --- |
| Port 4000/5173 in use | Old dev process | Stop it (`lsof -nP -iTCP:4000`) or change `PORT`; Vite picks 5174 if 5173 is taken — use the printed URL |
| `Cross-origin request rejected` with curl | Origin ≠ Host guard | Call through `http://localhost:5173/api/...` or send a matching `Origin` |
| Proof stage takes several seconds | First load of ~5 MB wasm + zkey | Wait; later proofs are faster. Do one warm-up proof before the review |
| `Eligibility tree failed to reproduce...` | DB edited or partially seeded | `npm run seed` |
| Proof verification fails for everyone | Artifacts/verification key out of sync | `npm run setup`, restart the API |
| Auditor numbers differ from the guide | A live ballot was cast | Expected: 429 blocks / 17,082 transactions; reseed to reset |
| `npm start` shows API JSON at `/` | Client not built | `npm run build` before `npm start` |
| Session behaves oddly after reseeding | Seed recreates users, invalidating old sessions | Sign in again |

---

## 8. Pre-presentation checklist

1. `npm run seed` once (fresh deterministic dataset) — never mid-demo.
2. `npm run dev`; open <http://localhost:5173>; confirm 12,480 / 8,526 / ledger valid.
3. Sign in as the voter and open `ELEC-2026-001` **without** submitting, so the wasm/zkey are cached.
   Then seed again only if you did submit.
4. Open `/docs/zkp` and `/admin/blockchain` once to warm the chunks.
5. Keep a second terminal ready for `npm run seed` if a live ballot changes the numbers.
6. Have this file and `docs/DEMO_GUIDE.md` open as the narration script.

No unresolved blocker or failed test remains. Every item from the previous audit's NOT TESTED list has now
been exercised: voter registration, CSV roster import (after fixing its header filter), candidate
add/remove, auditor report preview and export, logout, and forged-proof rejection. Settings is read-only by
design. The database was reseeded after these workflow tests, so the temporary election and test voter are
gone and the canonical figures above are current.
