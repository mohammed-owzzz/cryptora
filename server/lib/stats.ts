import { prisma } from './prisma.js';
import { verifyLedger } from './chain.js';

export interface FeaturedElection {
  electionId: string;
  name: string;
  status: string;
  registeredVoters: number;
  votesCast: number;
  participation: number;
  startDate: string;
  endDate: string;
}

/**
 * Canonical aggregate statistics. Every dashboard (public, admin, auditor,
 * results) reads from this single source so the figures never diverge.
 */
export async function buildStats() {
  const [
    registeredVoters,
    totalElections,
    verifiedBallots,
    validators,
    verifiedProofs,
    rejectedProofs,
    liveCount,
    ballots,
    proofsAll,
  ] = await Promise.all([
    prisma.eligibleVoter.count(),
    prisma.election.count(),
    prisma.ballot.count(),
    prisma.validator.findMany({ select: { validatorId: true, active: true, name: true, publicKey: true } }),
    prisma.zKPProof.count({ where: { status: 'VERIFIED' } }),
    prisma.zKPProof.count({ where: { status: 'REJECTED' } }),
    prisma.election.count({ where: { status: 'LIVE' } }),
    prisma.ballot.findMany({ select: { electionId: true, committedAt: true } }),
    prisma.zKPProof.findMany({ select: { createdAt: true, provenance: true, status: true } }),
  ]);

  const perElection = new Map<string, number>();
  for (const b of ballots) perElection.set(b.electionId, (perElection.get(b.electionId) ?? 0) + 1);

  const elections = await prisma.election.findMany({ orderBy: { createdAt: 'asc' } });
  const eligibleCounts = await prisma.eligibleVoter.groupBy({ by: ['electionId'], _count: { _all: true } });
  const eligibleByElection = new Map(eligibleCounts.map((e) => [e.electionId, e._count._all]));

  const featured: FeaturedElection[] = elections.map((e) => {
    const eligible = eligibleByElection.get(e.id) ?? 0;
    const cast = perElection.get(e.id) ?? 0;
    return {
      electionId: e.electionId,
      name: e.name,
      status: e.status,
      registeredVoters: eligible,
      votesCast: cast,
      participation: eligible === 0 ? 0 : Math.round((cast / eligible) * 1000) / 10,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
    };
  });

  // Daily ballot series (aggregated in application code — portable across engines)
  const byDay = new Map<string, number>();
  for (const b of ballots) {
    const day = b.committedAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const allDays = [...byDay.keys()].sort();
  const firstDay = allDays[0] ? new Date(allDays[0]) : new Date();
  const lastDay = allDays.length ? new Date(allDays[allDays.length - 1]) : new Date();
  const dailyParticipation: { date: string; ballots: number; cumulative: number }[] = [];
  let running = 0;
  for (let d = new Date(firstDay); d <= lastDay; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const count = byDay.get(key) ?? 0;
    running += count;
    dailyParticipation.push({ date: key, ballots: count, cumulative: running });
  }
  // Trim to the last 45 days of activity for display purposes
  const recentDaily = dailyParticipation.slice(-45);

  const recentTransactions = await prisma.blockchainTransaction.findMany({
    orderBy: { timestamp: 'desc' },
    take: 8,
    select: { txHash: true, type: true, blockNumber: true, timestamp: true, status: true, electionId: true },
  });

  let ledgerIntegrity = { valid: true, blocks: 0, errors: [] as string[] };
  try {
    const result = await verifyLedger();
    ledgerIntegrity = { valid: result.valid, blocks: result.blocks, errors: result.errors };
  } catch {
    ledgerIntegrity = { valid: false, blocks: 0, errors: ['ledger unavailable'] };
  }

  const activeValidators = validators.filter((v) => v.active).length;
  const participationRate =
    registeredVoters === 0 ? 0 : Math.round((verifiedBallots / registeredVoters) * 1000) / 10;

  return {
    registeredVoters,
    totalElections,
    liveElections: liveCount,
    verifiedBallots,
    totalValidators: validators.length,
    activeValidators,
    verifiedProofs,
    rejectedProofs,
    proofSuccessRate: verifiedProofs + rejectedProofs === 0 ? 0 : Math.round((verifiedProofs / (verifiedProofs + rejectedProofs)) * 1000) / 10,
    seededProofs: proofsAll.filter((p) => p.provenance === 'SEEDED').length,
    liveProofs: proofsAll.filter((p) => p.provenance === 'LIVE').length,
    ledgerIntegrity: ledgerIntegrity.valid ? 'VALID' : 'INTEGRITY FAILURE',
    ledgerBlocks: ledgerIntegrity.blocks,
    participationRate,
    remainingEligibleVoters: Math.max(registeredVoters - verifiedBallots, 0),
    featuredElections: featured,
    dailyParticipation: recentDaily,
    recentTransactions: recentTransactions.map((t) => ({
      txHash: t.txHash,
      type: t.type,
      blockNumber: t.blockNumber,
      timestamp: t.timestamp.toISOString(),
      status: t.status,
      electionId: t.electionId,
    })),
    validators: validators.map((v) => ({
      validatorId: v.validatorId,
      name: v.name,
      active: v.active,
      publicKey: v.publicKey,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export const TX_LABELS: Record<string, string> = {
  ELECTION_CREATED: 'Election Configuration',
  VOTER_ROOT_PUBLISHED: 'Voter Root Published',
  ZKP_VERIFIED: 'ZKP Verification',
  BALLOT_ACCEPTED: 'Encrypted Ballot Record',
  CONSENSUS_ACHIEVED: 'Validator Consensus',
  ELECTION_CLOSED: 'Election State Update',
  AGGREGATE_TALLY_PUBLISHED: 'Aggregate Tally Published',
  CORRECTION: 'Correction Transaction',
};
