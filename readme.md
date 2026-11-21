# cryptora: secure privacy-preserving e-voting platform

welcome to the repository for cryptora, a secure and privacy-preserving e-voting system built on a consortium blockchain and zero-knowledge proofs. instead of a traditional voting portal, cryptora separates voter eligibility, ballot submission, and ledger integrity into distinct cryptographic mechanisms so that no plaintext ballot is ever stored and no api response joins a voter identity to a candidate selection.

# tech stack

- **frontend:** react 18 + typescript + vite + tailwind css
- **backend:** express 4 + typescript
- **database:** sqlite via prisma (deterministic seed)
- **cryptography:** poseidon merkle trees, paillier homomorphic encryption, ed25519 signatures, groth16 zero-knowledge proofs (snarkjs + circom)
- **consortium blockchain:** five validators with 4-of-5 quorum, append-only signed blocks
- **deployment:** node.js production build served from a single process

# key features

- **three-question separation:** who may vote, what was submitted, and whether anything was altered are answered independently
- **browser-side proving:** voters generate groth16 proofs locally and encrypt one-hot ballot vectors with paillier before submission
- **single-use nullifiers:** each voter can cast at most one ballot per election, enforced on-chain
- **validator quorum:** four of five independent validators must sign before a block is appended
- **deterministic seed:** a repeatable demonstration dataset (12,480 voter commitments, 8 elections, 8,526 ballots) is reproducible on every machine
- **audit & reporting:** auditor workspace, ledger explorer, election tallies, and receipt codes for every cast ballot

# local development setup

follow these steps to run cryptora on your local machine.

```bash
1. clone the repository
git clone https://github.com/mohammed-owzzz/cryptora.git
cd cryptora

2. install dependencies
npm install

3. generate the zero-knowledge proof artifacts (optional)
npm run setup

4. initialise the database
npm run db:push

5. seed the demonstration dataset
npm run seed

6. start the development servers
npm run dev
```

open <http://localhost:5173>. the api runs on :4000 and the vite dev server on :5173.

to run the production bundle instead:

```bash
npm run build
npm start
```

then open <http://localhost:4000>.

demo credentials:

| role | identifier | credential |
| --- | --- | --- |
| administrator | admin@cryptora.demo | admin@1234! |
| voter | voter-2026-0042 (alex morgan) | voter@1234! |
| auditor | jordan@cryptora.demo + auditor id aud-2026-001 | auditor@1234! |

other scripts:

- `npm test` — vitest cryptography suite (hashing, merkle membership, paillier tallying, ed25519)
- `npm run seed` — reset the demonstration dataset at any time
