import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, fail } from '../lib/http.js';
import { requireAuth, hashPassword, lockedPasswordHash, type AuthedRequest } from '../lib/auth.js';
import { buildStats, TX_LABELS } from '../lib/stats.js';
import { verifyLedger } from '../lib/chain.js';
import { deriveSecret, leafCommitment } from '../lib/merkle.js';
import { generateKeypair } from '../lib/paillier.js';
import { commitBlock } from '../lib/chain.js';
import { closeElection, openElection, publishVoterRoot, tallyElection } from '../lib/elections.js';
import { logAudit } from '../lib/audit.js';
import { CIRCUIT_INFO, artifactsReady } from '../lib/zkp.js';
import { buildAuditReport, reportToCsv, reportToPdf } from '../lib/reports.js';
import { randomHex } from '../lib/hash.js';

export const adminRouter = Router();
adminRouter.use(requireAuth('ADMIN'));

async function registerEligible(electionId: string, voterIds: string[]) {
  const election = await prisma.election.findUnique({ where: { electionId } });
  if (!election) fail('Election not found', 404);
  const existing = await prisma.eligibleVoter.findMany({ where: { electionId: election.id } });
  const used = new Set(existing.map((e) => e.voterId));
  let nextIndex = existing.length ? Math.max(...existing.map((e) => e.leafIndex)) + 1 : 0;
  const ids = voterIds.filter((id) => !used.has(id));
  if (ids.length === 0) return { added: 0 };

  const voters = await prisma.voter.findMany({ where: { id: { in: ids } } });
  const rows = voters.map((v) => {
    const secret = deriveSecret(v.credentialSalt, election.electionId);
    return {
      electionId: election.id,
      voterId: v.id,
      commitment: leafCommitment(secret).toString(),
      leafIndex: nextIndex++,
    };
  });
  await prisma.eligibleVoter.createMany({ data: rows });
  if (election.status === 'DRAFT') {
    await prisma.election.update({ where: { id: election.id }, data: { merkleRoot: null, leafCount: 0 } });
  }
  return { added: rows.length };
}

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await buildStats();
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 });
    const elections = await prisma.election.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { ballots: true, eligibleVoters: true } }, candidates: true },
    });
    res.json({
      ...stats,
      recentActivity: logs.map((l) => ({
        action: l.action,
        detail: l.detail,
        actorRole: l.actorRole,
        createdAt: l.createdAt.toISOString(),
      })),
      elections: elections.map((e) => ({
        id: e.id,
        electionId: e.electionId,
        name: e.name,
        status: e.status,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        registeredVoters: e._count.eligibleVoters,
        votesCast: e._count.ballots,
        candidates: e.candidates.length,
        merkleRoot: e.merkleRoot,
      })),
    });
  }),
);

adminRouter.get(
  '/elections',
  asyncHandler(async (_req, res) => {
    const elections = await prisma.election.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { ballots: true, eligibleVoters: true, candidates: true } } },
    });
    res.json(
      elections.map((e) => ({
        id: e.id,
        electionId: e.electionId,
        name: e.name,
        description: e.description,
        status: e.status,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate.toISOString(),
        registeredVoters: e._count.eligibleVoters,
        votesCast: e._count.ballots,
        candidateCount: e._count.candidates,
        merkleRoot: e.merkleRoot,
        leafCount: e.leafCount,
      })),
    );
  }),
);

const candidateSchema = z.object({
  name: z.string().min(2).max(80),
  position: z.string().min(2).max(120),
  slogan: z.string().max(240).optional().default(''),
});

const createElectionSchema = z.object({
  name: z.string().min(4).max(120),
  description: z.string().min(4).max(600),
  electionId: z.string().max(60).optional(),
  startDate: z.string(),
  endDate: z.string(),
  rules: z.string().max(120).optional().default('Plurality'),
  voterGroup: z.string().max(120).optional().default('All registered voters'),
  maxSelections: z.number().int().min(1).max(1).optional().default(1),
  candidates: z.array(candidateSchema).max(12).optional().default([]),
});

adminRouter.post(
  '/elections',
  asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createElectionSchema.safeParse(req.body);
    if (!parsed.success) fail(parsed.error.issues[0].message);
    const data = parsed.data;
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) fail('Provide valid start and end dates');
    if (end <= start) fail('The closing date must be after the opening date');

    const count = await prisma.election.count();
    const year = new Date().getFullYear();
    let electionId = data.electionId?.trim();
    if (!electionId) {
      let n = count + 1;
      while (await prisma.election.findUnique({ where: { electionId: `ELEC-${year}-${String(n).padStart(3, '0')}` } })) n++;
      electionId = `ELEC-${year}-${String(n).padStart(3, '0')}`;
    } else if (await prisma.election.findUnique({ where: { electionId } })) {
      fail('That election identifier is already in use');
    }

    const { publicKey, privateKey } = generateKeypair(1024);
    const election = await prisma.election.create({
      data: {
        electionId,
        name: data.name,
        description: data.description,
        startDate: start,
        endDate: end,
        rules: data.rules,
        voterGroup: data.voterGroup,
        maxSelections: 1,
        status: 'DRAFT',
        tallyPublicKey: JSON.stringify(publicKey),
        tallyPrivateKey: JSON.stringify(privateKey),
        keyBits: publicKey.bits,
        createdBy: req.user?.id ?? null,
        candidates: {
          create: data.candidates.map((c, i) => ({
            candidateId: `${electionId}-C${String(i + 1).padStart(2, '0')}`,
            name: c.name,
            position: c.position,
            slogan: c.slogan ?? '',
            index: i,
          })),
        },
      },
      include: { candidates: true },
    });

    const block = await commitBlock([
      {
        type: 'ELECTION_CREATED',
        electionId: election.id,
        payload: {
          electionId: election.electionId,
          name: election.name,
          opensAt: start.toISOString(),
          closesAt: end.toISOString(),
          candidateCount: election.candidates.length,
          tallyKeyBits: publicKey.bits,
          tallyPublicKey: publicKey,
        },
      },
    ]);

    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'ELECTION_CREATED',
      target: election.electionId,
      detail: `${election.name} created with ${election.candidates.length} candidates`,
    });

    res.status(201).json({ election: { id: election.id, electionId: election.electionId }, block });
  }),
);

adminRouter.get(
  '/elections/:id',
  asyncHandler(async (req, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
      include: {
        candidates: { orderBy: { index: 'asc' } },
        results: true,
        merkleTrees: { orderBy: { publishedAt: 'desc' }, take: 1 },
      },
    });
    if (!election) fail('Election not found', 404);

    const [eligible, ballots, proofs, txs] = await Promise.all([
      prisma.eligibleVoter.count({ where: { electionId: election.id } }),
      prisma.ballot.count({ where: { electionId: election.id } }),
      prisma.zKPProof.count({ where: { electionId: election.id } }),
      prisma.blockchainTransaction.findMany({
        where: { electionId: election.id },
        orderBy: { timestamp: 'desc' },
        take: 12,
      }),
    ]);

    res.json({
      id: election.id,
      electionId: election.electionId,
      name: election.name,
      description: election.description,
      status: election.status,
      rules: election.rules,
      voterGroup: election.voterGroup,
      maxSelections: election.maxSelections,
      startDate: election.startDate.toISOString(),
      endDate: election.endDate.toISOString(),
      merkleRoot: election.merkleRoot,
      merkleDepth: election.merkleDepth,
      leafCount: election.leafCount,
      keyBits: election.keyBits,
      tallyPublicKey: election.tallyPublicKey ? JSON.parse(election.tallyPublicKey) : null,
      registeredVoters: eligible,
      votesCast: ballots,
      proofCount: proofs,
      candidates: election.candidates.map((c) => ({
        id: c.id,
        candidateId: c.candidateId,
        name: c.name,
        position: c.position,
        slogan: c.slogan,
        index: c.index,
      })),
      results: election.results.map((r) => ({
        candidateId: r.candidateId,
        votes: r.votes,
      })),
      merkleAudit: election.merkleTrees[0]?.levels ?? null,
      transactions: txs.map((t) => ({
        txHash: t.txHash,
        type: t.type,
        blockNumber: t.blockNumber,
        timestamp: t.timestamp.toISOString(),
        status: t.status,
        label: TX_LABELS[t.type] ?? t.type,
      })),
    });
  }),
);

adminRouter.patch(
  '/elections/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
      include: { _count: { select: { ballots: true } } },
    });
    if (!election) fail('Election not found', 404);
    if (election._count.ballots > 0) fail('Election metadata cannot be changed after voting has commenced');

    const schema = z.object({
      name: z.string().min(4).max(120).optional(),
      description: z.string().min(4).max(600).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      rules: z.string().max(120).optional(),
      voterGroup: z.string().max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) fail(parsed.error.issues[0].message);
    const d = parsed.data;
    const updated = await prisma.election.update({
      where: { id: election.id },
      data: {
        ...(d.name ? { name: d.name } : {}),
        ...(d.description ? { description: d.description } : {}),
        ...(d.startDate ? { startDate: new Date(d.startDate) } : {}),
        ...(d.endDate ? { endDate: new Date(d.endDate) } : {}),
        ...(d.rules ? { rules: d.rules } : {}),
        ...(d.voterGroup ? { voterGroup: d.voterGroup } : {}),
      },
    });
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'ELECTION_UPDATED',
      target: election.electionId,
      detail: `metadata updated: ${Object.keys(d).join(', ') || 'no fields'}`,
    });
    res.json({ election: { electionId: updated.electionId, name: updated.name } });
  }),
);

adminRouter.post(
  '/elections/:id/candidates',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
      include: { candidates: true, _count: { select: { ballots: true } } },
    });
    if (!election) fail('Election not found', 404);
    if (election._count.ballots > 0) fail('Candidates cannot be modified once voting has commenced');
    const parsed = candidateSchema.safeParse(req.body);
    if (!parsed.success) fail(parsed.error.issues[0].message);
    const index = election.candidates.length;
    const candidate = await prisma.candidate.create({
      data: {
        candidateId: `${election.electionId}-C${String(index + 1).padStart(2, '0')}`,
        electionId: election.id,
        name: parsed.data.name,
        position: parsed.data.position,
        slogan: parsed.data.slogan ?? '',
        index,
      },
    });
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'CANDIDATE_ADDED',
      target: election.electionId,
      detail: `${candidate.name} added`,
    });
    res.status(201).json({ candidate: { id: candidate.id, candidateId: candidate.candidateId, name: candidate.name } });
  }),
);

adminRouter.delete(
  '/candidates/:candidateId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const candidate = await prisma.candidate.findUnique({
      where: { candidateId: req.params.candidateId },
      include: { election: { include: { _count: { select: { ballots: true } } } } },
    });
    if (!candidate) fail('Candidate not found', 404);
    if (candidate.election._count.ballots > 0) fail('Candidates cannot be removed once voting has commenced');
    if (candidate.election.status !== 'DRAFT') fail('Candidates can only be removed from a draft election');
    await prisma.candidate.delete({ where: { id: candidate.id } });
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'CANDIDATE_REMOVED',
      target: candidate.election.electionId,
      detail: `${candidate.name} removed`,
    });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/elections/:id/publish',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
      include: { candidates: true },
    });
    if (!election) fail('Election not found', 404);
    if (['LIVE', 'CLOSED', 'COMPLETED'].includes(election.status)) fail('This election has already been opened');
    if (election.candidates.length < 2) fail('Add at least two candidates before publishing');
    const result = await publishVoterRoot(election.electionId);
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'VOTER_ROOT_PUBLISHED',
      target: election.electionId,
      detail: `Merkle root ${result.root.slice(0, 16)}... for ${result.leafCount} voters`,
    });
    res.json(result);
  }),
);

adminRouter.post(
  '/elections/:id/open',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
    });
    if (!election) fail('Election not found', 404);
    const result = await openElection(election.electionId);
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'ELECTION_OPENED',
      target: election.electionId,
      detail: 'voting opened',
    });
    res.json({ status: result.election.status, block: result.block });
  }),
);

adminRouter.post(
  '/elections/:id/close',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
    });
    if (!election) fail('Election not found', 404);
    const result = await closeElection(election.electionId);
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'ELECTION_CLOSED',
      target: election.electionId,
      detail: 'voting closed; ballots sealed',
    });
    res.json({ status: result.election.status, block: result.block });
  }),
);

adminRouter.post(
  '/elections/:id/tally',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
    });
    if (!election) fail('Election not found', 404);
    const result = await tallyElection(election.electionId);
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'TALLY_PUBLISHED',
      target: election.electionId,
      detail: `${result.acceptedBallots} encrypted ballots aggregated`,
    });
    res.json(result);
  }),
);

adminRouter.post(
  '/elections/:id/eligible',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
    });
    if (!election) fail('Election not found', 404);
    const schema = z.object({
      mode: z.enum(['all', 'faculty', 'ids']),
      faculty: z.string().optional(),
      voterIds: z.array(z.string()).optional(),
      limit: z.number().int().min(1).max(8192).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) fail(parsed.error.issues[0].message);
    const { mode, faculty, voterIds, limit } = parsed.data;

    let ids: string[] = [];
    if (mode === 'ids') ids = voterIds ?? [];
    else {
      const voters = await prisma.voter.findMany({
        where: mode === 'faculty' && faculty ? { faculty } : {},
        select: { id: true },
        take: limit ?? 8192,
      });
      ids = voters.map((v) => v.id);
    }
    const result = await registerEligible(election.electionId, ids);
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'VOTER_REGISTRY_UPDATED',
      target: election.electionId,
      detail: `${result.added} voter commitments generated`,
    });
    res.json(result);
  }),
);

adminRouter.post(
  '/elections/:id/import-voters',
  asyncHandler(async (req: AuthedRequest, res) => {
    const election = await prisma.election.findFirst({
      where: { OR: [{ id: req.params.id }, { electionId: req.params.id }] },
    });
    if (!election) fail('Election not found', 404);
    const csv = String(req.body?.csv ?? '');
    if (!csv.trim()) fail('Provide CSV content (voterNumber,name,faculty)');
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    let created = 0;
    const ids: string[] = [];
    for (const line of lines.slice(0, 500)) {
      const [voterNumber, name, faculty] = line.split(',').map((s) => s?.trim());
      const isHeader = /^voter(number|id|_number|_id)?$/i.test(voterNumber ?? '');
      if (!voterNumber || !name || isHeader) continue;
      const existing = await prisma.voter.findUnique({ where: { voterNumber } });
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const user = await prisma.user.create({
        data: {
          name,
          email: `${voterNumber.toLowerCase()}@cryptora.demo`,
          passwordHash: lockedPasswordHash,
          role: 'VOTER',
          voterId: voterNumber,
          voter: {
            create: {
              voterNumber,
              faculty: faculty || 'General',
              credentialSalt: randomHex(32),
            },
          },
        },
        include: { voter: true },
      });
      ids.push(user.voter!.id);
      created += 1;
    }
    const result = await registerEligible(election.electionId, ids);
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'VOTER_CSV_IMPORT',
      target: election.electionId,
      detail: `${created} new voters, ${result.added} registered`,
    });
    res.json({ created, registered: result.added, total: ids.length });
  }),
);

adminRouter.get(
  '/voters',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? '').trim();
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const where = search
      ? {
          OR: [
            { voterNumber: { contains: search } },
            { faculty: { contains: search } },
            { user: { name: { contains: search } } },
            { user: { email: { contains: search } } },
          ],
        }
      : {};
    const [voters, total, eligible, voted, faculties] = await Promise.all([
      prisma.voter.findMany({
        where,
        include: { user: true, _count: { select: { memberships: true, ballots: true } } },
        orderBy: { user: { name: 'asc' } },
        take: limit,
      }),
      prisma.voter.count(),
      prisma.voter.count({ where: { eligibility: 'ELIGIBLE' } }),
      prisma.voter.count({ where: { ballots: { some: {} } } }),
      prisma.voter.findMany({ distinct: ['faculty'], select: { faculty: true } }),
    ]);
    res.json({
      total,
      summary: { eligible, voted, faculties: faculties.length },
      voters: voters.map((v) => ({
        id: v.id,
        voterNumber: v.voterNumber,
        name: v.user.name,
        email: v.user.email,
        faculty: v.faculty,
        district: v.district,
        eligibility: v.eligibility,
        registeredElections: v._count.memberships,
        ballotsCast: v._count.ballots,
        verifiedAt: v.verifiedAt.toISOString(),
      })),
    });
  }),
);

adminRouter.post(
  '/voters',
  asyncHandler(async (req: AuthedRequest, res) => {
    const schema = z.object({
      name: z.string().min(2).max(120),
      email: z.string().email(),
      voterNumber: z.string().min(3).max(40),
      faculty: z.string().max(120).optional(),
      district: z.string().max(120).optional(),
      password: z.string().min(8).max(200).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) fail(parsed.error.issues[0].message);
    const d = parsed.data;
    if (await prisma.voter.findUnique({ where: { voterNumber: d.voterNumber } })) fail('That voter number already exists');
    if (await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } })) fail('That email is already registered');

    const user = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email.toLowerCase(),
        passwordHash: await hashPassword(d.password ?? `Voter@${randomHex(4)}!`),
        role: 'VOTER',
        voterId: d.voterNumber,
        voter: {
          create: {
            voterNumber: d.voterNumber,
            faculty: d.faculty ?? 'General',
            district: d.district ?? null,
            credentialSalt: randomHex(32),
          },
        },
      },
      include: { voter: true },
    });

    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'VOTER_REGISTERED',
      target: d.voterNumber,
      detail: `${d.name} added to the registry`,
    });
    res.status(201).json({ id: user.voter!.id, voterNumber: user.voter!.voterNumber });
  }),
);

adminRouter.get(
  '/candidates',
  asyncHandler(async (_req, res) => {
    const candidates = await prisma.candidate.findMany({
      include: { election: true, _count: { select: { results: true } } },
      orderBy: [{ election: { startDate: 'desc' } }, { index: 'asc' }],
    });
    res.json(
      candidates.map((c) => ({
        id: c.id,
        candidateId: c.candidateId,
        name: c.name,
        position: c.position,
        slogan: c.slogan,
        electionId: c.election.electionId,
        electionName: c.election.name,
        electionStatus: c.election.status,
      })),
    );
  }),
);

adminRouter.get(
  '/ballots',
  asyncHandler(async (req, res) => {
    const electionId = String(req.query.electionId ?? '');
    const ballots = await prisma.ballot.findMany({
      where: electionId ? { election: { electionId } } : {},
      include: { election: true, encrypted: true },
      orderBy: { committedAt: 'desc' },
      take: 100,
    });
    const total = await prisma.ballot.count();
    res.json({
      total,
      note: 'Individual ballot contents are never exposed — only ciphertext metadata is listed.',
      ballots: ballots.map((b) => ({
        receiptCode: b.receiptCode,
        electionId: b.election.electionId,
        electionName: b.election.name,
        blockNumber: b.blockNumber,
        committedAt: b.committedAt.toISOString(),
        nullifierPrefix: b.nullifier.slice(0, 12),
        scheme: b.encrypted?.scheme ?? 'paillier',
        ciphertextCount: b.encrypted ? JSON.parse(b.encrypted.ciphertexts).length : 0,
        commitment: b.encrypted?.commitment ?? null,
      })),
    });
  }),
);

adminRouter.get(
  '/blockchain/blocks',
  asyncHandler(async (_req, res) => {
    const blocks = await prisma.blockchainBlock.findMany({
      orderBy: { blockNumber: 'desc' },
      take: 60,
      include: { _count: { select: { transactions: true, signatures: true } } },
    });
    const height = await prisma.blockchainBlock.count();
    res.json({
      height: height - 1,
      blocks: blocks.map((b) => ({
        blockNumber: b.blockNumber,
        blockHash: b.blockHash,
        previousHash: b.previousHash,
        merkleRoot: b.merkleRoot,
        timestamp: b.timestamp.toISOString(),
        txCount: b.txCount,
        approvals: b.approvals,
        consensus: b.consensus,
        signatures: b._count.signatures,
        validatorSet: b.validatorSet,
      })),
    });
  }),
);

adminRouter.get(
  '/blockchain/blocks/:blockNumber',
  asyncHandler(async (req, res) => {
    const block = await prisma.blockchainBlock.findUnique({
      where: { blockNumber: Number(req.params.blockNumber) },
      include: { transactions: true, signatures: { include: { validator: true } }, consensusRound: true },
    });
    if (!block) fail('Block not found', 404);
    res.json({
      blockNumber: block.blockNumber,
      blockHash: block.blockHash,
      previousHash: block.previousHash,
      merkleRoot: block.merkleRoot,
      timestamp: block.timestamp.toISOString(),
      txCount: block.txCount,
      approvals: block.approvals,
      consensus: block.consensus,
      header: JSON.parse(block.validatorSet),
      consensusRound: block.consensusRound
        ? {
            required: block.consensusRound.required,
            votes: block.consensusRound.votes,
            achieved: block.consensusRound.achieved,
            finishedAt: block.consensusRound.finishedAt?.toISOString() ?? null,
          }
        : null,
      signatures: block.signatures.map((s) => ({
        validatorId: s.validator.validatorId,
        name: s.validator.name,
        publicKey: s.validator.publicKey,
        signature: s.signature,
      })),
      transactions: block.transactions.map((t) => ({
        txHash: t.txHash,
        type: t.type,
        label: TX_LABELS[t.type] ?? t.type,
        timestamp: t.timestamp.toISOString(),
        status: t.status,
        payload: JSON.parse(t.payload),
      })),
    });
  }),
);

adminRouter.post(
  '/blockchain/verify',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await verifyLedger();
    await logAudit({
      req,
      actorId: req.user?.id,
      actorRole: 'ADMIN',
      action: 'LEDGER_VERIFIED',
      detail: result.valid ? 'ledger integrity valid' : `integrity failure: ${result.errors[0]}`,
    });
    res.json(result);
  }),
);

adminRouter.get(
  '/validators',
  asyncHandler(async (_req, res) => {
    const validators = await prisma.validator.findMany({ orderBy: { validatorId: 'asc' } });
    const sigs = await prisma.validatorSignature.groupBy({ by: ['validatorId'], _count: { _all: true } });
    const sigBy = new Map(sigs.map((s) => [s.validatorId, s._count._all]));
    const blocks = await prisma.blockchainBlock.count();
    res.json({
      blockHeight: blocks - 1,
      threshold: 4,
      validators: validators.map((v) => ({
        id: v.id,
        validatorId: v.validatorId,
        name: v.name,
        publicKey: v.publicKey,
        active: v.active,
        signatures: sigBy.get(v.id) ?? 0,
        uptime: 100,
      })),
    });
  }),
);

adminRouter.get(
  '/zkp',
  asyncHandler(async (_req, res) => {
    const proofs = await prisma.zKPProof.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { election: true },
    });
    const [verified, rejected, seeded, live] = await Promise.all([
      prisma.zKPProof.count({ where: { status: 'VERIFIED' } }),
      prisma.zKPProof.count({ where: { status: 'REJECTED' } }),
      prisma.zKPProof.count({ where: { provenance: 'SEEDED' } }),
      prisma.zKPProof.count({ where: { provenance: 'LIVE' } }),
    ]);
    res.json({
      circuit: CIRCUIT_INFO,
      artifactsReady: artifactsReady(),
      stats: { verified, rejected, seeded, live },
      proofs: proofs.map((p) => ({
        id: p.id,
        electionId: p.election.electionId,
        nullifierPrefix: p.nullifier.slice(0, 14),
        status: p.status,
        provenance: p.provenance,
        verificationMs: p.verificationMs,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }),
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const action = String(req.query.action ?? '');
    const logs = await prisma.auditLog.findMany({
      where: action ? { action: { contains: action } } : {},
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: { actor: { select: { name: true, role: true } } },
    });
    res.json(
      logs.map((l) => ({
        id: l.id,
        action: l.action,
        actor: l.actor?.name ?? 'System',
        actorRole: l.actorRole,
        target: l.target,
        detail: l.detail,
        ip: l.ip,
        createdAt: l.createdAt.toISOString(),
      })),
    );
  }),
);

adminRouter.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const elections = await prisma.election.findMany({
      include: {
        _count: { select: { ballots: true, eligibleVoters: true, proofs: true } },
        results: { include: { candidate: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json({
      reports: elections.map((e) => ({
        electionId: e.electionId,
        name: e.name,
        status: e.status,
        registeredVoters: e._count.eligibleVoters,
        ballots: e._count.ballots,
        proofs: e._count.proofs,
        tallyPublished: e.results.length > 0,
        results: e.results.map((r) => ({ name: r.candidate.name, votes: r.votes })),
      })),
    });
  }),
);

async function loadAdminReport(electionId: string) {
  try {
    return await buildAuditReport(electionId);
  } catch {
    fail('Election not found', 404);
  }
}

adminRouter.get(
  '/reports/:electionId/csv',
  asyncHandler(async (req: AuthedRequest, res) => {
    const report = await loadAdminReport(req.params.electionId);
    await logAudit({
      req,
      actorId: req.user!.id,
      actorRole: 'ADMIN',
      action: 'REPORT_EXPORTED',
      target: report.election.electionId,
      detail: `CSV audit report exported for ${report.election.electionId}`,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cryptora-audit-${report.election.electionId}.csv"`);
    res.send(reportToCsv(report));
  }),
);

adminRouter.get(
  '/reports/:electionId/pdf',
  asyncHandler(async (req: AuthedRequest, res) => {
    const report = await loadAdminReport(req.params.electionId);
    await logAudit({
      req,
      actorId: req.user!.id,
      actorRole: 'ADMIN',
      action: 'REPORT_EXPORTED',
      target: report.election.electionId,
      detail: `PDF audit report exported for ${report.election.electionId}`,
    });
    const pdf = await reportToPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cryptora-audit-${report.election.electionId}.pdf"`);
    res.send(pdf);
  }),
);

adminRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const [users, sessions] = await Promise.all([prisma.user.count(), prisma.session.count()]);
    res.json({
      environment: process.env.NODE_ENV ?? 'development',
      consensusThreshold: 4,
      validators: await prisma.validator.count(),
      sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
      database: 'SQLite (Prisma)',
      zkp: { ...CIRCUIT_INFO, artifactsReady: artifactsReady(), prover: 'browser-side Groth16' },
      accounts: users,
      activeSessions: sessions,
      demoMode: true,
    });
  }),
);

adminRouter.get(
  '/network-health',
  asyncHandler(async (_req, res) => {
    const ledger = await verifyLedger();
    const validators = await prisma.validator.count();
    res.json({
      ledger,
      validators,
      status: ledger.valid ? 'HEALTHY' : 'DEGRADED',
    });
  }),
);
