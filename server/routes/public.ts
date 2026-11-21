import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, fail } from '../lib/http.js';
import { buildStats } from '../lib/stats.js';
import { verifyLedger } from '../lib/chain.js';
import { artifactsReady, CIRCUIT_INFO } from '../lib/zkp.js';

export const publicRouter = Router();

publicRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(await buildStats());
  }),
);

publicRouter.get(
  '/elections',
  asyncHandler(async (_req, res) => {
    const elections = await prisma.election.findMany({
      where: { status: { in: ['LIVE', 'CLOSED', 'TALLYING', 'COMPLETED', 'SCHEDULED'] } },
      orderBy: { startDate: 'desc' },
      include: { candidates: { orderBy: { index: 'asc' } }, results: true },
    });
    const counts = await prisma.ballot.groupBy({ by: ['electionId'], _count: { _all: true } });
    const eligibleCounts = await prisma.eligibleVoter.groupBy({ by: ['electionId'], _count: { _all: true } });
    const ballotsBy = new Map(counts.map((c) => [c.electionId, c._count._all]));
    const eligibleBy = new Map(eligibleCounts.map((c) => [c.electionId, c._count._all]));

    res.json(
      elections.map((e) => {
        const eligible = eligibleBy.get(e.id) ?? 0;
        const cast = ballotsBy.get(e.id) ?? 0;
        const published = ['CLOSED', 'TALLYING', 'COMPLETED'].includes(e.status);
        return {
          electionId: e.electionId,
          name: e.name,
          description: e.description,
          status: e.status,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate.toISOString(),
          registeredVoters: eligible,
          votesCast: cast,
          participation: eligible ? Math.round((cast / eligible) * 1000) / 10 : 0,
          candidates: e.candidates.map((c) => ({ candidateId: c.candidateId, name: c.name, position: c.position })),
          results: published
            ? e.candidates
                .map((c) => ({
                  candidateId: c.candidateId,
                  name: c.name,
                  votes: e.results.find((r) => r.candidateId === c.id)?.votes ?? 0,
                }))
                .sort((a, b) => b.votes - a.votes)
            : null,
          merkleRoot: e.merkleRoot,
        };
      }),
    );
  }),
);

publicRouter.get(
  '/elections/:electionId/results',
  asyncHandler(async (req, res) => {
    const election = await prisma.election.findUnique({
      where: { electionId: req.params.electionId },
      include: { candidates: { orderBy: { index: 'asc' } }, results: true },
    });
    if (!election) fail('Election not found', 404);
    const eligible = await prisma.eligibleVoter.count({ where: { electionId: election.id } });
    const cast = await prisma.ballot.count({ where: { electionId: election.id } });

    if (!['CLOSED', 'TALLYING', 'COMPLETED'].includes(election.status)) {
      res.json({
        electionId: election.electionId,
        name: election.name,
        status: election.status,
        published: false,
        registeredVoters: eligible,
        validBallots: cast,
        participation: eligible ? Math.round((cast / eligible) * 1000) / 10 : 0,
        candidates: [],
      });
      return;
    }

    const totalVotes = election.results.reduce((s, r) => s + r.votes, 0);
    res.json({
      electionId: election.electionId,
      name: election.name,
      description: election.description,
      status: election.status,
      published: election.status === 'COMPLETED' && election.results.length > 0,
      registeredVoters: eligible,
      validBallots: cast,
      participation: eligible ? Math.round((cast / eligible) * 1000) / 10 : 0,
      merkleRoot: election.merkleRoot,
      candidates: election.candidates
        .map((c) => ({
          candidateId: c.candidateId,
          name: c.name,
          position: c.position,
          votes: election.results.find((r) => r.candidateId === c.id)?.votes ?? 0,
          share: totalVotes ? Math.round(((election.results.find((r) => r.candidateId === c.id)?.votes ?? 0) / totalVotes) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.votes - a.votes),
    });
  }),
);

publicRouter.get(
  '/network',
  asyncHandler(async (_req, res) => {
    const validators = await prisma.validator.findMany({ orderBy: { validatorId: 'asc' } });
    const ledger = await verifyLedger();
    res.json({
      validators: validators.map((v) => ({ validatorId: v.validatorId, name: v.name, active: v.active })),
      ledger: { valid: ledger.valid, blocks: ledger.blocks, transactions: ledger.transactions },
    });
  }),
);

publicRouter.get(
  '/zkp-status',
  asyncHandler(async (_req, res) => {
    res.json({ artifactsReady: artifactsReady(), circuit: CIRCUIT_INFO });
  }),
);
