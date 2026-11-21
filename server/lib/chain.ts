import { prisma } from './prisma.js';
import { sha256, sha256Canonical, ZERO_HASH } from './hash.js';
import { newValidatorKeypair, signMessage, verifySignature } from './ed25519.js';

/**
 * CRYPTORA consortium ledger.
 *
 * Five logical validator identities run inside this backend process. They hold
 * independent Ed25519 keypairs and each one re-validates a proposed block before
 * signing it. A block commits only when at least 4 of 5 signatures are valid.
 * This is a *local consortium simulation* — see docs/BLOCKCHAIN.md.
 */

export const VALIDATOR_COUNT = 5;
export const REQUIRED_APPROVALS = 4;

export interface PendingTransaction {
  type: string;
  payload: Record<string, unknown>;
  electionId?: string | null;
  nullifier?: string | null;
  timestamp?: Date;
}

export interface CommitResult {
  blockNumber: number;
  blockHash: string;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  approvals: number;
  validatorIds: string[];
  transactions: { txHash: string; type: string }[];
}

export async function ensureValidators() {
  let validators = await prisma.validator.findMany({ orderBy: { validatorId: 'asc' } });
  if (validators.length === 0) {
    for (let i = 1; i <= VALIDATOR_COUNT; i++) {
      const kp = newValidatorKeypair();
      await prisma.validator.create({
        data: {
          validatorId: `VAL-0${i}`,
          name: `Validator 0${i}`,
          publicKey: kp.publicKey,
          secretKey: kp.secretKey,
          active: true,
        },
      });
    }
    validators = await prisma.validator.findMany({ orderBy: { validatorId: 'asc' } });
  }
  return validators;
}

export function blockHeader(input: {
  blockNumber: number;
  previousHash: string;
  merkleRoot: string;
  timestamp: Date;
  txCount: number;
  validatorSet: string;
}) {
  return {
    protocol: 'cryptora-consortium/1',
    blockNumber: input.blockNumber,
    previousHash: input.previousHash,
    merkleRoot: input.merkleRoot,
    timestamp: input.timestamp.toISOString(),
    txCount: input.txCount,
    validatorSet: input.validatorSet,
  };
}

export function computeBlockHash(header: Record<string, unknown>): string {
  return sha256Canonical(header);
}

export function txHashFor(tx: { type: string; payload: unknown; electionId?: string | null; nullifier?: string | null; timestamp: Date }) {
  return sha256Canonical({
    type: tx.type,
    payload: tx.payload,
    electionId: tx.electionId ?? null,
    nullifier: tx.nullifier ?? null,
    timestamp: tx.timestamp.toISOString(),
  });
}

export function transactionMerkleRoot(txHashes: string[]): string {
  if (txHashes.length === 0) return sha256('cryptora:empty');
  let level = [...txHashes].sort();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(sha256(left + right));
    }
    level = next;
  }
  return level[0];
}

/** Structural + semantic validation performed independently by every validator. */
async function validateTransaction(tx: PendingTransaction & { timestamp: Date; txHash: string }) {
  const problems: string[] = [];
  if (!tx.type) problems.push('missing transaction type');
  if (typeof tx.payload !== 'object' || tx.payload === null) problems.push('missing payload');
  if (txHashFor(tx) !== tx.txHash) problems.push('transaction hash mismatch');

  if (tx.type === 'BALLOT_ACCEPTED') {
    const nullifier = tx.nullifier ?? (tx.payload.nullifier as string | undefined);
    if (!nullifier) problems.push('ballot transaction missing nullifier');
    if (tx.payload && 'candidateId' in (tx.payload as any)) problems.push('ballot transaction must not carry a candidate id');
    const ciphertexts = (tx.payload as any).encryptedBallot ?? (tx.payload as any).ciphertexts;
    if (!Array.isArray(ciphertexts) || ciphertexts.length === 0) problems.push('ballot transaction missing ciphertexts');
    if (nullifier) {
      const existing = await prisma.nullifier.findFirst({
        where: { value: nullifier, electionId: tx.electionId ?? '' },
      });
      if (existing) problems.push('nullifier already spent');
    }
    const proofVerified = (tx.payload as any).proofVerified;
    if (proofVerified !== true) problems.push('eligibility proof not verified');
  }

  if (tx.type === 'ZKP_VERIFIED' && (tx.payload as any).verified !== true) {
    problems.push('proof verification transaction must be verified');
  }

  return problems;
}

export async function createGenesisBlock() {
  const validators = await ensureValidators();
  const existing = await prisma.blockchainBlock.findUnique({ where: { blockNumber: 0 } });
  if (existing) return existing;

  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  const validatorSet = validators.map((v) => v.validatorId).join(',');
  const header = blockHeader({
    blockNumber: 0,
    previousHash: ZERO_HASH,
    merkleRoot: sha256('cryptora:genesis'),
    timestamp,
    txCount: 0,
    validatorSet,
  });
  const blockHash = computeBlockHash(header);
  const block = await prisma.blockchainBlock.create({
    data: {
      blockNumber: 0,
      previousHash: ZERO_HASH,
      merkleRoot: header.merkleRoot,
      timestamp,
      txCount: 0,
      consensus: 'ACHIEVED',
      approvals: validators.length,
      validatorSet: JSON.stringify(header),
      blockHash,
    },
  });
  for (const v of validators) {
    await prisma.validatorSignature.create({
      data: {
        blockId: block.id,
        validatorId: v.id,
        signature: signMessage(v.secretKey, blockHash),
        message: blockHash,
      },
    });
  }
  return block;
}

export async function getChainHead() {
  const head = await prisma.blockchainBlock.findFirst({ orderBy: { blockNumber: 'desc' } });
  if (head) return head;
  return createGenesisBlock();
}

/**
 * Proposes a block containing the given transactions and runs quorum consensus.
 * Throws when quorum is not reached — nothing is committed in that case.
 */
export async function commitBlock(txs: PendingTransaction[], opts: { timestamp?: Date } = {}): Promise<CommitResult> {
  if (txs.length === 0) throw new Error('Cannot commit an empty block');
  const validators = await ensureValidators();
  const active = validators.filter((v) => v.active);
  if (active.length < REQUIRED_APPROVALS) throw new Error('Insufficient active validators for quorum');

  const head = await getChainHead();
  const timestamp = opts.timestamp ?? new Date();

  const prepared = txs.map((t) => {
    const ts = t.timestamp ?? timestamp;
    const hash = txHashFor({ ...t, timestamp: ts });
    return { ...t, timestamp: ts, txHash: hash };
  });

  // Every validator independently validates the proposed block.
  const validationFailures: string[][] = [];
  for (const v of active) {
    const problems: string[] = [];
    for (const tx of prepared) problems.push(...(await validateTransaction(tx)));
    validationFailures.push(problems.map((p) => `${v.validatorId}: ${p}`));
  }
  const hardFailures = validationFailures.flat().filter((p) => !p.includes('nullifier already spent'));
  const duplicateNullifier = validationFailures.flat().some((p) => p.includes('nullifier already spent'));
  if (duplicateNullifier) throw new Error('Consensus rejected: nullifier already spent');
  if (hardFailures.length > 0) throw new Error(`Consensus rejected: ${hardFailures[0]}`);

  const merkleRoot = transactionMerkleRoot(prepared.map((p) => p.txHash));
  const validatorSet = active.map((v) => v.validatorId).join(',');
  const blockNumber = head.blockNumber + 1;
  const header = blockHeader({
    blockNumber,
    previousHash: head.blockHash,
    merkleRoot,
    timestamp,
    txCount: prepared.length,
    validatorSet,
  });
  const blockHash = computeBlockHash(header);

  // Validators verify the assembled header, then sign the block hash.
  const approvals: { validator: (typeof active)[number]; signature: string }[] = [];
  for (const validator of active) {
    const recomputed = computeBlockHash({
      protocol: 'cryptora-consortium/1',
      blockNumber,
      previousHash: head.blockHash,
      merkleRoot,
      timestamp: timestamp.toISOString(),
      txCount: prepared.length,
      validatorSet,
    });
    if (recomputed !== blockHash) throw new Error(`${validator.validatorId} rejected the block header`);

    const signature = signMessage(validator.secretKey, blockHash);
    if (!verifySignature(validator.publicKey, blockHash, signature)) {
      throw new Error(`${validator.validatorId} produced an invalid signature`);
    }
    approvals.push({ validator, signature });
  }

  if (approvals.length < REQUIRED_APPROVALS) {
    throw new Error(`Consensus not reached: ${approvals.length}/${REQUIRED_APPROVALS} approvals`);
  }

  const block = await prisma.blockchainBlock.create({
    data: {
      blockNumber,
      previousHash: head.blockHash,
      merkleRoot,
      timestamp,
      txCount: prepared.length,
      consensus: 'ACHIEVED',
      approvals: approvals.length,
      validatorSet: JSON.stringify(header),
      blockHash,
    },
  });

  for (const a of approvals) {
    await prisma.validatorSignature.create({
      data: {
        blockId: block.id,
        validatorId: a.validator.id,
        signature: a.signature,
        message: blockHash,
      },
    });
  }

  await prisma.consensusRound.create({
    data: {
      blockId: block.id,
      required: REQUIRED_APPROVALS,
      votes: approvals.length,
      achieved: true,
      startedAt: timestamp,
      finishedAt: new Date(),
    },
  });

  for (const tx of prepared) {
    await prisma.blockchainTransaction.create({
      data: {
        txHash: tx.txHash,
        type: tx.type,
        blockNumber,
        blockId: block.id,
        electionId: tx.electionId ?? null,
        payload: JSON.stringify(tx.payload),
        nullifier: tx.nullifier ?? null,
        timestamp: tx.timestamp,
        status: 'CONFIRMED',
      },
    });
  }

  return {
    blockNumber,
    blockHash,
    previousHash: head.blockHash,
    merkleRoot,
    timestamp: timestamp.toISOString(),
    approvals: approvals.length,
    validatorIds: approvals.map((a) => a.validator.validatorId),
    transactions: prepared.map((p) => ({ txHash: p.txHash, type: p.type })),
  };
}

export interface LedgerVerification {
  valid: boolean;
  blocks: number;
  transactions: number;
  signaturesChecked: number;
  errors: string[];
  checkedAt: string;
}

/** Full traversal: numbering, hash chain, block hashes, signatures, transactions. */
export async function verifyLedger(): Promise<LedgerVerification> {
  const blocks = await prisma.blockchainBlock.findMany({
    orderBy: { blockNumber: 'asc' },
    include: { transactions: true, signatures: true },
  });
  const validators = await prisma.validator.findMany();
  const byId = new Map(validators.map((v) => [v.id, v]));
  const errors: string[] = [];
  let signaturesChecked = 0;
  let txCount = 0;

  if (blocks.length === 0) {
    return {
      valid: false,
      blocks: 0,
      transactions: 0,
      signaturesChecked: 0,
      errors: ['ledger is empty'],
      checkedAt: new Date().toISOString(),
    };
  }

  blocks.forEach((block, idx) => {
    if (block.blockNumber !== idx) errors.push(`block numbering gap at block ${block.blockNumber}`);

    let header: any;
    try {
      header = JSON.parse(block.validatorSet);
    } catch {
      errors.push(`block ${block.blockNumber}: unreadable header`);
      return;
    }

    const recomputed = computeBlockHash({
      protocol: header.protocol,
      blockNumber: block.blockNumber,
      previousHash: block.previousHash,
      merkleRoot: block.merkleRoot,
      timestamp: new Date(block.timestamp).toISOString(),
      txCount: block.txCount,
      validatorSet: header.validatorSet,
    });
    if (recomputed !== block.blockHash) errors.push(`block ${block.blockNumber}: block hash mismatch`);

    if (idx === 0) {
      if (block.previousHash !== ZERO_HASH) errors.push('genesis block previous hash is not zero');
    } else if (block.previousHash !== blocks[idx - 1].blockHash) {
      errors.push(`block ${block.blockNumber}: previous hash does not match block ${block.blockNumber - 1}`);
    }

    const expectedRoot = transactionMerkleRoot(block.transactions.map((t) => t.txHash));
    if (block.transactions.length > 0 && expectedRoot !== block.merkleRoot) {
      errors.push(`block ${block.blockNumber}: transaction merkle root mismatch`);
    }

    for (const tx of block.transactions) {
      txCount += 1;
      let payload: any;
      try {
        payload = JSON.parse(tx.payload);
      } catch {
        errors.push(`tx ${tx.txHash.slice(0, 10)}: unreadable payload`);
        continue;
      }
      const recomputedTx = txHashFor({
        type: tx.type,
        payload,
        electionId: tx.electionId,
        nullifier: tx.nullifier,
        timestamp: new Date(tx.timestamp),
      });
      if (recomputedTx !== tx.txHash) errors.push(`tx ${tx.txHash.slice(0, 10)}: transaction hash mismatch`);
    }

    if (block.txCount !== block.transactions.length) {
      errors.push(`block ${block.blockNumber}: transaction count mismatch`);
    }

    let validSignatures = 0;
    for (const sig of block.signatures) {
      const validator = byId.get(sig.validatorId);
      if (!validator) {
        errors.push(`block ${block.blockNumber}: unknown validator`);
        continue;
      }
      signaturesChecked += 1;
      if (verifySignature(validator.publicKey, block.blockHash, sig.signature)) validSignatures += 1;
      else errors.push(`block ${block.blockNumber}: invalid signature from ${validator.validatorId}`);
    }
    if (validSignatures < REQUIRED_APPROVALS) {
      errors.push(`block ${block.blockNumber}: quorum not met (${validSignatures}/${REQUIRED_APPROVALS})`);
    }
  });

  return {
    valid: errors.length === 0,
    blocks: blocks.length,
    transactions: txCount,
    signaturesChecked,
    errors: errors.slice(0, 25),
    checkedAt: new Date().toISOString(),
  };
}
