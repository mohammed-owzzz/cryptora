# Consortium Blockchain

## Why a consortium chain

An election needs an append-only record that no single administrator can rewrite, without the cost and
latency of a public proof-of-work chain. CRYPTORA therefore models a permissioned consortium: five
independent validator identities, each with its own Ed25519 keypair, each independently validating a block
before signing it. A block is final only after **four of five** signatures.

## Block format

```jsonc
{
  "blockNumber": 428,
  "blockHash": "9cb6…4877",
  "previousHash": "…",
  "merkleRoot": "…",          // root over the block's transaction hashes
  "timestamp": "2026-11-20T…",
  "txCount": 2,
  "approvals": 5,
  "consensus": "ACHIEVED",
  "validatorSet": "{…}"        // canonical header stored for audit
}
```

The header is serialised canonically (sorted keys, no whitespace) and hashed with SHA-256. Because the
header includes `previousHash`, changing any historical field invalidates every hash after it.

`blockHash = sha256(canonical({ blockNumber, previousHash, merkleRoot, timestamp, txCount, electionId? }))`

The transaction Merkle root commits to the ordered transaction hashes, so a transaction cannot be added,
removed or reordered without changing the header.

## Transaction types

| Type | Emitted when |
| --- | --- |
| `ELECTION_CREATED` | An election is created (includes candidate count and tally key) |
| `VOTER_ROOT_PUBLISHED` | The eligibility Merkle root is published |
| `ZKP_VERIFIED` | A proof passed verification (root, nullifier, duration) |
| `BALLOT_ACCEPTED` | A ballot is accepted (ciphertext vector, commitment, nullifier) |
| `CONSENSUS_ACHIEVED` | Reserved for explicit quorum records |
| `ELECTION_CLOSED` / `ELECTION_OPENED` | Lifecycle transitions |
| `AGGREGATE_TALLY_PUBLISHED` | Aggregate ciphertexts are decrypted and published |
| `CORRECTION` | Compensating entry; history is never edited in place |

`BALLOT_ACCEPTED` payloads contain the ciphertext vector under `encryptedBallot`, the scheme, the tally
modulus, the ballot commitment, the nullifier and the eligibility root. They never contain a candidate id —
the validator rejects any ballot transaction that carries one.

## Validator behaviour

Each validator, in order:

1. Rejects an unknown transaction type or a missing payload.
2. Recomputes the transaction hash from `canonical({ type, electionId, payload, nullifier, timestamp })`
   and compares it with the declared hash.
3. For ballot transactions: requires a nullifier, requires a non-empty ciphertext array, forbids a candidate
   id, and checks that the nullifier has not already been spent in the database.
4. For ballot and proof transactions: requires the referenced election to exist, and for ballots that the
   election is `LIVE`.
5. Rebuilds the header, compares `previousHash` with the current chain tip and recomputes the transaction
   Merkle root.

Only when the validator's problem list is empty does it sign the header. A block with fewer than four valid
signatures is rejected and never appended.

## Consensus

```
collect signatures → 4 reached? → yes: append block, write ConsensusRound(achieved)
                                → no:  discard, write ConsensusRound(achieved=false)
```

`ConsensusRound` stores `votes`, `required` and `achieved` with timings, which is what the auditor's
"recent consensus rounds" table reads. In the seeded dataset every block was signed by all five validators;
the UI displays `5/5` accordingly.

## Verification

`verifyLedger()` walks the chain from genesis:

- block numbers are contiguous from 0,
- each `previousHash` equals the preceding block hash,
- each header recomputes to `blockHash`,
- each transaction Merkle root recomputes from the stored transactions,
- each `ValidatorSignature` is a valid Ed25519 signature over the header by the key registered for that
  `validatorId`.

The admin and auditor workspaces both expose this as a button that re-runs the check and writes an
`LEDGER_VERIFIED` audit entry. The public stats endpoint reports the resulting `ledgerIntegrity` value, which
is `VALID` in the seeded state (428 blocks, 17,080 transactions, 2,140 signatures).

## Inspecting a block

`GET /api/admin/blockchain/blocks/:n` and `GET /api/auditor/ledger/:n` return the header, consensus round,
all five signatures with public keys, and every transaction with its parsed payload. The ledger explorer in
both workspaces opens this in a modal, so a reviewer can walk from a ballot receipt to the exact block that
committed it.

## Limitations of this implementation

- The five validators run in one Node process; there is no peer-to-peer transport, no gossip and no network
  partition behaviour. Their keypairs, validation routines and signatures are real; their distribution is not.
- No fork resolution is required because there is no competing proposer; the first quorum wins.
- Throughput is bounded by SQLite writes and, for live ballots, by proof verification (~100–200 ms).
