import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, fail } from '../lib/http.js';
import { requireAuth, tokenHash, type AuthedRequest } from '../lib/auth.js';
import { authPath, buildTree, deriveSecret, electionFieldId, MERKLE_DEPTH, nullifierFor } from '../lib/merkle.js';
import { verifyProof, verificationKey } from '../lib/zkp.js';
import { commitBlock } from '../lib/chain.js';
import { canonical, randomHex, sha256 } from '../lib/hash.js';
import { logAudit } from '../lib/audit.js';
import { TX_LABELS } from '../lib/stats.js';

export const voterRouter = Router();
voterRouter.use(requireAuth('VOTER'));

const treeCache = new Map<string, ReturnType<typeof buildTree>>();

async function merkleFor(election: { id: string; electionId: string; merkleRoot: string | null }) {
  const key = `${election.id}:${election.merkleRoot}`;
  const cached = treeCache.get(key);
  if (cached) return cached;
  if (!election.merkleRoot) fail('This election has not published its eligibility root yet');
  const leaves = await prisma.eligibleVoter.findMany({
    where: { electionId: election.id },
    orderBy: { leafIndex: 'asc' },
    select: { commitment: true },
  });
  const tree = buildTree(leaves.map((l) => BigInt(l.commitment)), MERKLE_DEPTH);
  if (tree.root.toString() !== election.merkleRoot) {
    fail('Eligibility tree failed to reproduce the published Merkle root');
  }
  treeCache.set(key, tree);
  return tree;
}

async function currentVoter(userId: string) {
  const voter = await prisma.voter.findUnique({ where: { userId }, include: { user: true } });
  if (!voter) fail('Voter profile not found', 404);
  return voter;
}

voterRouter.get(
  '/dashboard',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const memberships = await prisma.eligibleVoter.findMany({
      where: { voterId: voter.id },
      include: { election: { include: { _count: { select: { candidates: true, eligibleVoters: true } } } } },
    });
    const ballots = await prisma.ballot.findMany({ where: { voterId: voter.id }, include: { election: true } });
    const votedElectionIds = new Set(ballots.map((b) => b.electionId));
    const activity = await prisma.auditLog.findMany({
      where: { actorId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const elections = memberships
      .map((m) => ({
        electionId: m.election.electionId,
        name: m.election.name,
        description: m.election.description,
        status: m.election.status,
        startDate: m.election.startDate.toISOString(),
        endDate: m.election.endDate.toISOString(),
        candidateCount: m.election._count.candidates,
        registeredVoters: m.election._count.eligibleVoters,
        hasVoted: votedElectionIds.has(m.election.id),
        endsInMs: m.election.endDate.getTime() - Date.now(),
      }))
      .sort((a, b) => (a.status === 'LIVE' ? -1 : 1) - (b.status === 'LIVE' ? -1 : 1));

    res.json({
      voter: {
        name: voter.user.name,
        voterNumber: voter.voterNumber,
        email: voter.user.email,
        faculty: voter.faculty,
        verified: voter.eligibility === 'ELIGIBLE',
        voterId: voter.user.voterId,
      },
      eligibleElections: elections.length,
      votesSubmitted: ballots.length,
      accountStatus: voter.eligibility,
      elections,
      activity: activity.map((a) => ({
        action: a.action,
        detail: a.detail,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  }),
);

voterRouter.get(
  '/elections',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const memberships = await prisma.eligibleVoter.findMany({
      where: { voterId: voter.id },
      include: { election: { include: { _count: { select: { candidates: true, eligibleVoters: true } } } } },
    });
    const ballots = await prisma.ballot.findMany({ where: { voterId: voter.id }, select: { electionId: true } });
    const voted = new Set(ballots.map((b) => b.electionId));
    res.json(
      memberships.map((m) => ({
        electionId: m.election.electionId,
        name: m.election.name,
        description: m.election.description,
        status: m.election.status,
        startDate: m.election.startDate.toISOString(),
        endDate: m.election.endDate.toISOString(),
        candidateCount: m.election._count.candidates,
        registeredVoters: m.election._count.eligibleVoters,
        hasVoted: voted.has(m.election.id),
        endsInMs: m.election.endDate.getTime() - Date.now(),
      })),
    );
  }),
);

voterRouter.get(
  '/elections/:electionId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const election = await prisma.election.findUnique({
      where: { electionId: req.params.electionId },
      include: { candidates: { orderBy: { index: 'asc' } } },
    });
    if (!election) fail('Election not found', 404);
    const membership = await prisma.eligibleVoter.findUnique({
      where: { electionId_voterId: { electionId: election.id, voterId: voter.id } },
    });
    if (!membership) {
      res.status(403).json({ error: 'You are not registered as an eligible voter for this election' });
      return;
    }
    const ballot = await prisma.ballot.findUnique({
      where: { electionId_voterId: { electionId: election.id, voterId: voter.id } },
    });

    res.json({
      electionId: election.electionId,
      name: election.name,
      description: election.description,
      status: election.status,
      rules: election.rules,
      maxSelections: election.maxSelections,
      startDate: election.startDate.toISOString(),
      endDate: election.endDate.toISOString(),
      merkleRoot: election.merkleRoot,
      leafIndex: membership.leafIndex,
      tallyPublicKey: election.tallyPublicKey ? JSON.parse(election.tallyPublicKey) : null,
      hasVoted: Boolean(ballot),
      isOpen: election.status === 'LIVE' && election.endDate.getTime() > Date.now(),
      candidates: election.candidates.map((c) => ({
        candidateId: c.candidateId,
        name: c.name,
        position: c.position,
        slogan: c.slogan,
        index: c.index,
      })),
    });
  }),
);

/**
 * Returns the voter's own private credential material so the browser can build
 * the witness locally. The secret never appears in a transaction or a log; it is
 * delivered only over the authenticated session to its owner.
 */
voterRouter.get(
  '/elections/:electionId/witness',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const election = await prisma.election.findUnique({ where: { electionId: req.params.electionId } });
    if (!election) fail('Election not found', 404);
    if (!election.merkleRoot) fail('Eligibility root not published for this election');
    if (election.status !== 'LIVE') fail('Voting is not open for this election');
    if (election.endDate.getTime() < Date.now()) fail('The voting period for this election has ended');

    const membership = await prisma.eligibleVoter.findUnique({
      where: { electionId_voterId: { electionId: election.id, voterId: voter.id } },
    });
    if (!membership) fail('You are not eligible for this election', 403);
    if (await prisma.ballot.findUnique({ where: { electionId_voterId: { electionId: election.id, voterId: voter.id } } })) {
      fail('A ballot has already been submitted for this election', 409);
    }

    const tree = await merkleFor(election);
    const secret = deriveSecret(voter.credentialSalt, election.electionId);
    const fieldId = electionFieldId(election.electionId);
    const nullifier = nullifierFor(secret, fieldId);
    const path = authPath(tree, membership.leafIndex);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      electionId: election.electionId,
      fieldId: fieldId.toString(),
      root: election.merkleRoot,
      secret: secret.toString(),
      nullifier: nullifier.toString(),
      pathElements: path.pathElements,
      pathIndices: path.pathIndices,
      depth: MERKLE_DEPTH,
      circuit: 'eligibility',
      candidates: await prisma.candidate.findMany({
        where: { electionId: election.id },
        orderBy: { index: 'asc' },
        select: { candidateId: true, name: true, index: true },
      }),
      tallyPublicKey: election.tallyPublicKey ? JSON.parse(election.tallyPublicKey) : null,
      verificationKey: verificationKey(),
    });
  }),
);

const submitSchema = z.object({
  proof: z.record(z.any()),
  publicSignals: z.array(z.string()).length(3),
  ciphertexts: z.array(z.string().regex(/^\d+$/)).min(2).max(12),
  ballotCommitment: z.string().length(64),
  nullifier: z.string().min(1),
});

/**
 * Ballot acceptance pipeline:
 *  proof -> verify -> nullifier uniqueness -> consensus -> immutable block -> receipt
 */
voterRouter.post(
  '/elections/:electionId/submit',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const election = await prisma.election.findUnique({
      where: { electionId: req.params.electionId },
      include: { candidates: { orderBy: { index: 'asc' } } },
    });
    if (!election) fail('Election not found', 404);
    if (election.status !== 'LIVE') fail('Ballots are only accepted while an election is LIVE', 409);
    if (election.endDate.getTime() < Date.now()) fail('The voting period has closed', 409);
    if (!election.merkleRoot || !election.tallyPublicKey) fail('Election is not correctly configured', 409);

    const membership = await prisma.eligibleVoter.findUnique({
      where: { electionId_voterId: { electionId: election.id, voterId: voter.id } },
    });
    if (!membership) fail('You are not eligible to vote in this election', 403);

    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) fail(parsed.error.issues[0].message);
    const body = parsed.data;

    if (body.ciphertexts.length !== election.candidates.length) {
      fail('Encrypted ballot vector length does not match the candidate list');
    }
    if (body.ballotCommitment !== sha256(canonical(body.ciphertexts))) {
      fail('Encrypted ballot commitment does not match the submitted ciphertexts');
    }

    const existingBallot = await prisma.ballot.findUnique({
      where: { electionId_voterId: { electionId: election.id, voterId: voter.id } },
    });
    if (existingBallot) fail('A ballot has already been submitted for this election', 409);

    const fieldId = electionFieldId(election.electionId).toString();
    const expectedNullifier = nullifierFor(deriveSecret(voter.credentialSalt, election.electionId), BigInt(fieldId)).toString();

    if (body.nullifier !== expectedNullifier) fail('Nullifier does not match this voter credential', 400);
    if (body.nullifier !== body.publicSignals[2]) fail('Proof public signals do not match the nullifier', 400);

    const spent = await prisma.nullifier.findFirst({ where: { electionId: election.id, value: body.nullifier } });
    if (spent) fail('This ballot nullifier has already been used', 409);

    const proofRecord = await prisma.zKPProof.create({
      data: {
        electionId: election.id,
        nullifier: body.nullifier,
        root: body.publicSignals[0],
        proofJson: JSON.stringify({ proof: body.proof, publicSignals: body.publicSignals }),
        publicSignalsJson: JSON.stringify(body.publicSignals),
        provenance: 'LIVE',
        status: 'PENDING',
      },
    });

    const outcome = await verifyProof(
      { proof: body.proof, publicSignals: body.publicSignals },
      { root: election.merkleRoot, fieldId, nullifier: expectedNullifier },
    );

    await prisma.zKPProof.update({
      where: { id: proofRecord.id },
      data: {
        status: outcome.verified ? 'VERIFIED' : 'REJECTED',
        verified: outcome.verified,
        verificationMs: outcome.durationMs,
      },
    });

    if (!outcome.verified) {
      await logAudit({
        req,
        actorId: req.user!.id,
        actorRole: 'VOTER',
        action: 'ZKP_REJECTED',
        target: election.electionId,
        detail: outcome.reason ?? 'proof verification failed',
      });
      res.status(400).json({ error: `Zero-knowledge proof rejected: ${outcome.reason ?? 'invalid proof'}` });
      return;
    }

    const block = await commitBlock([
      {
        type: 'ZKP_VERIFIED',
        electionId: election.id,
        nullifier: body.nullifier,
        payload: {
          electionId: election.electionId,
          circuit: 'eligibility.circom',
          protocol: 'groth16',
          root: body.publicSignals[0],
          nullifier: body.nullifier,
          verified: true,
          verificationMs: outcome.durationMs,
        },
      },
      {
        type: 'BALLOT_ACCEPTED',
        electionId: election.id,
        nullifier: body.nullifier,
        payload: {
          electionId: election.electionId,
          encryptedBallot: body.ciphertexts,
          scheme: 'paillier-additive',
          tallyModulus: JSON.parse(election.tallyPublicKey).n,
          ballotCommitment: body.ballotCommitment,
          proofVerified: true,
          nullifier: body.nullifier,
          merkleRoot: body.publicSignals[0],
        },
      },
    ]);

    const ballotTx = block.transactions.find((t) => t.type === 'BALLOT_ACCEPTED')!;
    const receiptCode = `CRY-${randomHex(6).toUpperCase()}`;

    await prisma.$transaction([
      prisma.ballot.create({
        data: {
          electionId: election.id,
          voterId: voter.id,
          nullifier: body.nullifier,
          receiptCode,
          blockNumber: block.blockNumber,
          encrypted: {
            create: {
              scheme: 'paillier-additive',
              modulus: JSON.parse(election.tallyPublicKey).n,
              generator: JSON.parse(election.tallyPublicKey).g,
              ciphertexts: JSON.stringify(body.ciphertexts),
              commitment: body.ballotCommitment,
            },
          },
        },
      }),
      prisma.nullifier.create({
        data: { electionId: election.id, value: body.nullifier },
      }),
    ]);

    await logAudit({
      req,
      actorId: req.user!.id,
      actorRole: 'VOTER',
      action: 'BALLOT_SUBMITTED',
      target: election.electionId,
      detail: `receipt ${receiptCode} committed in block ${block.blockNumber}`,
    });

    res.status(201).json({
      receipt: {
        receiptCode,
        electionId: election.electionId,
        electionName: election.name,
        blockNumber: block.blockNumber,
        blockHash: block.blockHash,
        txHash: ballotTx.txHash,
        proofVerified: true,
        proofType: 'Groth16',
        circuit: 'eligibility',
        approvals: block.approvals,
        threshold: 4,
        validatorIds: block.validatorIds,
        timestamp: block.timestamp,
        nullifier: body.nullifier,
        merkleRoot: body.publicSignals[0],
        verificationMs: outcome.durationMs,
      },
    });
  }),
);

voterRouter.get(
  '/history',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const ballots = await prisma.ballot.findMany({
      where: { voterId: voter.id },
      include: { election: { include: { candidates: true, results: true } } },
      orderBy: { committedAt: 'desc' },
    });
    res.json({
      note: 'Ballot contents are sealed. Your candidate selection is never linked to your identity in this record.',
      history: ballots.map((b) => ({
        receiptCode: b.receiptCode,
        electionId: b.election.electionId,
        electionName: b.election.name,
        electionStatus: b.election.status,
        blockNumber: b.blockNumber,
        committedAt: b.committedAt.toISOString(),
        nullifierPrefix: b.nullifier.slice(0, 14),
        resultsPublished: b.election.results.length > 0,
      })),
    });
  }),
);

voterRouter.get(
  '/results',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const memberships = await prisma.eligibleVoter.findMany({ where: { voterId: voter.id } });
    const elections = await prisma.election.findMany({
      where: { id: { in: memberships.map((m) => m.electionId) } },
      include: { candidates: { orderBy: { index: 'asc' } }, results: true },
      orderBy: { startDate: 'desc' },
    });
    const eligibleCounts = await prisma.eligibleVoter.groupBy({
      by: ['electionId'],
      _count: { _all: true },
      where: { electionId: { in: elections.map((e) => e.id) } },
    });
    const ballots = await prisma.ballot.groupBy({
      by: ['electionId'],
      _count: { _all: true },
      where: { electionId: { in: elections.map((e) => e.id) } },
    });
    const eligibleBy = new Map(eligibleCounts.map((e) => [e.electionId, e._count._all]));
    const ballotsBy = new Map(ballots.map((b) => [b.electionId, b._count._all]));

    res.json(
      elections.map((e) => {
        const published = ['CLOSED', 'TALLYING', 'COMPLETED'].includes(e.status);
        const total = e.results.reduce((s, r) => s + r.votes, 0);
        return {
          electionId: e.electionId,
          name: e.name,
          status: e.status,
          registeredVoters: eligibleBy.get(e.id) ?? 0,
          votesCast: ballotsBy.get(e.id) ?? 0,
          published,
          results: published
            ? e.candidates
                .map((c) => ({
                  candidateId: c.candidateId,
                  name: c.name,
                  votes: e.results.find((r) => r.candidateId === c.id)?.votes ?? 0,
                  share: total ? Math.round(((e.results.find((r) => r.candidateId === c.id)?.votes ?? 0) / total) * 1000) / 10 : 0,
                }))
                .sort((a, b) => b.votes - a.votes)
            : null,
        };
      }),
    );
  }),
);

voterRouter.get(
  '/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const sessions = await prisma.session.findMany({
      where: { userId: voter.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      name: voter.user.name,
      email: voter.user.email,
      voterNumber: voter.voterNumber,
      voterId: voter.user.voterId,
      faculty: voter.faculty,
      district: voter.district,
      eligibility: voter.eligibility,
      verifiedAt: voter.verifiedAt.toISOString(),
      lastLoginAt: voter.user.lastLoginAt?.toISOString() ?? null,
      membershipCount: await prisma.eligibleVoter.count({ where: { voterId: voter.id } }),
      ballotCount: await prisma.ballot.count({ where: { voterId: voter.id } }),
      sessions: sessions.length,
    });
  }),
);

voterRouter.patch(
  '/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    const schema = z.object({ name: z.string().min(2).max(120).optional(), faculty: z.string().max(120).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) fail(parsed.error.issues[0].message);
    const voter = await currentVoter(req.user!.id);
    if (parsed.data.name) {
      await prisma.user.update({ where: { id: voter.userId }, data: { name: parsed.data.name } });
    }
    if (parsed.data.faculty) {
      await prisma.voter.update({ where: { id: voter.id }, data: { faculty: parsed.data.faculty } });
    }
    await logAudit({
      req,
      actorId: req.user!.id,
      actorRole: 'VOTER',
      action: 'PROFILE_UPDATED',
      detail: 'voter updated profile details',
    });
    res.json({ ok: true });
  }),
);

voterRouter.get(
  '/security',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const sessions = await prisma.session.findMany({ where: { userId: voter.userId }, orderBy: { createdAt: 'desc' } });
    const events = await prisma.auditLog.findMany({ where: { actorId: voter.userId }, orderBy: { createdAt: 'desc' }, take: 15 });
    const currentHash = tokenHash(req.sessionToken ?? '');
    res.json({
      passwordHashAlgorithm: 'bcrypt (cost 11)',
      sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
      cookieFlags: ['HttpOnly', 'SameSite=Lax', 'Path=/'],
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        ip: s.ip,
        current: s.tokenHash === currentHash,
      })),
      events: events.map((e) => ({ action: e.action, detail: e.detail, createdAt: e.createdAt.toISOString() })),
      zkp: {
        circuit: 'eligibility.circom',
        protocol: 'Groth16',
        proofLocation: 'generated in this browser; only the proof and public signals leave the device',
      },
    });
  }),
);

voterRouter.delete(
  '/sessions',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const currentHash = tokenHash(req.sessionToken ?? '');
    const deleted = await prisma.session.deleteMany({
      where: { userId: voter.userId, NOT: { tokenHash: currentHash } },
    });
    await logAudit({
      req,
      actorId: req.user!.id,
      actorRole: 'VOTER',
      action: 'SESSIONS_REVOKED',
      detail: `${deleted.count} other sessions terminated`,
    });
    res.json({ revoked: deleted.count });
  }),
);

voterRouter.get(
  '/receipt/:receiptCode',
  asyncHandler(async (req: AuthedRequest, res) => {
    const voter = await currentVoter(req.user!.id);
    const ballot = await prisma.ballot.findUnique({
      where: { receiptCode: req.params.receiptCode },
      include: { election: true, encrypted: true },
    });
    if (!ballot || ballot.voterId !== voter.id) fail('Receipt not found', 404);
    const tx = await prisma.blockchainTransaction.findFirst({
      where: { nullifier: ballot.nullifier, type: 'BALLOT_ACCEPTED' },
    });
    const block = ballot.blockNumber != null
      ? await prisma.blockchainBlock.findUnique({ where: { blockNumber: ballot.blockNumber } })
      : null;
    res.json({
      receiptCode: ballot.receiptCode,
      electionId: ballot.election.electionId,
      electionName: ballot.election.name,
      blockNumber: ballot.blockNumber,
      blockHash: block?.blockHash ?? null,
      txHash: tx?.txHash ?? null,
      label: tx ? TX_LABELS[tx.type] : null,
      committedAt: ballot.committedAt.toISOString(),
      ciphertextCount: ballot.encrypted ? JSON.parse(ballot.encrypted.ciphertexts).length : 0,
      scheme: ballot.encrypted?.scheme ?? null,
    });
  }),
);
