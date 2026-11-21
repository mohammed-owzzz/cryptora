pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";

/*
  CRYPTORA — Voter eligibility membership circuit.

  Proves, in zero knowledge:
    1. leaf = Poseidon(secret) is a member of the Merkle tree whose root is `root`.
    2. nullifier = Poseidon(secret, electionId) — a deterministic, election-scoped
       pseudonym that lets the ledger reject double voting without linking the
       nullifier to the voter's identity.

  Private: secret, pathElements[], pathIndices[]
  Public : root, electionId, nullifier
*/
template Eligibility(depth) {
    signal input secret;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal input root;
    signal input electionId;
    signal input nullifier;

    // ---- leaf commitment -------------------------------------------------
    component leaf = Poseidon(1);
    leaf.inputs[0] <== secret;

    // ---- Merkle authentication path --------------------------------------
    component hashers[depth];
    signal cur[depth + 1];
    cur[0] <== leaf.out;

    for (var i = 0; i < depth; i++) {
        // direction bits must be strictly boolean
        pathIndices[i] * (pathIndices[i] - 1) === 0;

        hashers[i] = Poseidon(2);
        // left  = bit ? pathElement : cur
        // right = bit ? cur : pathElement
        hashers[i].inputs[0] <== cur[i] + pathIndices[i] * (pathElements[i] - cur[i]);
        hashers[i].inputs[1] <== pathElements[i] + pathIndices[i] * (cur[i] - pathElements[i]);
        cur[i + 1] <== hashers[i].out;
    }

    cur[depth] === root;

    // ---- election-scoped nullifier ---------------------------------------
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== secret;
    nullifierHash.inputs[1] <== electionId;

    nullifier === nullifierHash.out;
}

component main { public [root, electionId, nullifier] } = Eligibility(13);
