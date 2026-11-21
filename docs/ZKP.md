# Zero-Knowledge Eligibility Proofs

## The claim being proven

> *"I know a credential secret whose commitment is a leaf of the Merkle tree with this published root, for this
> election, and this nullifier follows from that secret."*

The verifier learns three public values and nothing else:

| Public signal | Meaning |
| --- | --- |
| `root` | The election's published eligibility root |
| `electionId` | The election identifier reduced into the BN254 scalar field |
| `nullifier` | `Poseidon(secret, electionId)` — single-use, election-scoped |

The witness (secret, path elements, path indices) never leaves the voter's browser.

## Circuit

`circuits/eligibility.circom`

```circom
pragma circom 2.1.6;
include "circomlib/poseidon.circom";

template Eligibility(depth) {
    signal input secret;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal input root;
    signal input electionId;
    signal input nullifier;

    // 1. leaf commitment
    component leaf = Poseidon(1);
    leaf.inputs[0] <== secret;

    // 2. Merkle membership at fixed depth
    component hashers[depth];
    component selectors[depth];
    signal level[depth + 1];
    level[0] <== leaf.out;

    for (var i = 0; i < depth; i++) {
        selectors[i].s[0] <== level[i];
        selectors[i].s[1] <== pathElements[i];
        selectors[i].sel <== pathIndices[i];
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== selectors[i].out[0];
        hashers[i].inputs[1] <== selectors[i].out[1];
        level[i + 1] <== hashers[i].out;
    }

    level[depth] === root;

    // 3. nullifier binding
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== secret;
    nullifierHash.inputs[1] <== electionId;
    nullifierHash.out === nullifier;
}

component main { public [root, electionId, nullifier] } = Eligibility(13);
```

- **Depth 13** → 8,192 leaves per election. Unused leaves are `0`, so the root commits to exactly the
  registered set while keeping the depth constant.
- **Poseidon** over BN254 is used for both the leaf and the internal nodes, matching `poseidon-lite` on the
  server and in the browser witness builder.
- The nullifier is domain-separated by `electionId`, so the same voter produces different nullifiers in
  different elections and cannot be correlated across them.

## Toolchain

`npm run setup` (`scripts/setup-zkp.mjs`):

1. `circom2` (the WASM compiler, no Rust toolchain required) compiles the circuit to `eligibility.wasm` plus
   R1CS.
2. A local powers-of-tau ceremony at 2^13 constraints produces `pot13_final.ptau`.
3. `snarkjs.groth16.setup` produces `eligibility_final.zkey` and `verification_key.json`.
4. Artifacts are copied to `client/public/zkp/` (wasm, zkey) and `zkp/build/` (r1cs, vkey).

Solvency of the ceremony is not a security claim here: the parameters are generated locally for a
demonstration. A production deployment would use a public, multi-party ceremony.

## Witness construction

`GET /api/voter/elections/:electionId/witness` (voter-authenticated, `Cache-Control: no-store`) returns:

```jsonc
{
  "root": "…", "fieldId": "…", "secret": "…", "nullifier": "…",
  "pathElements": ["…", "…"],   // 13 entries
  "pathIndices":  ["0", "1"],   // 13 entries
  "depth": 13,
  "tallyPublicKey": { "n": "…", "g": "…", "bits": 1024 },
  "verificationKey": { … }
}
```

The secret is `sha256(credentialSalt:electionId) mod p`, derived on the server from the voter's stored
credential salt. The server refuses to issue a witness if the election is not `LIVE`, if its window has
closed, if the voter is not eligible, or if a ballot already exists.

## Proving and verification

Client (`client/src/lib/zkp.ts`):

```ts
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  { secret, pathElements, pathIndices, root, electionId: fieldId, nullifier },
  '/zkp/eligibility.wasm',
  '/zkp/eligibility_final.zkey',
);
const ok = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
```

Verifying locally before transmitting means an invalid ballot is never sent. The browser then encrypts the
ballot vector, and only `{ proof, publicSignals, ciphertexts, ballotCommitment, nullifier }` is posted.

Server (`server/lib/zkp.ts`):

```ts
verifyProof(
  { proof, publicSignals },
  { root: election.merkleRoot, fieldId, nullifier: expectedNullifier },
);
```

The server checks that the proof's `root` matches the election's stored root, that public signal 1 equals
the expected election field id and public signal 2 equals the expected nullifier, then runs
`snarkjs.groth16.verify` with the verification key. Only after `verified === true` does the ballot enter
consensus. Verification takes roughly 100–200 ms in this environment; proof generation takes a few seconds in
the browser, dominated by loading the wasm and zkey.

## Nullifiers

The nullifier is the anti-double-vote mechanism, not an identity:

- derived from a secret only the voter's browser sees,
- scoped to one election,
- recorded in `Nullifier` the moment a ballot is committed,
- checked again by validators before they sign,
- therefore a second ballot from the same credential is rejected with 409 even if its proof is valid.

## Proof provenance

`ZKPProof.provenance` distinguishes:

- `LIVE` — generated by a browser in this deployment and verified server-side. Every ballot cast through the
  UI is `LIVE`, and two of the seeded historical ballots for Alex Morgan carry real proofs.
- `SEEDED` — a historical dataset record. The ballot and ciphertexts are real, the proof payload is not
  present, and the auditor's re-verify action returns `SEEDED_RECORD` rather than claiming a verification.

This distinction is visible in the admin ZKP table, the auditor proof table and the audit report.

## What the circuit does not prove

- **Ballot well-formedness.** It does not prove the encrypted vector is exactly one-hot. A malicious client
  could submit a vector with two ones or a value of 5. The server enforces vector length and commitment
  binding, but not the one-hot property. A production design adds a range proof or a Chaum–Pedersen
  disjunctive proof per candidate, or folds the ballot into the same circuit.
- **Credential freshness or revocation.** Eligibility is a snapshot captured in the Merkle root.
- **Tally correctness.** Correct decryption of the aggregate is not proven; it relies on the tally key holder
  publishing results honestly, which the report and the ledger records make auditable but not trustless.
