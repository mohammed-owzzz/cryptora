import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, fail } from '../lib/http.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { buildStats, TX_LABELS } from '../lib/stats.js';
import { verifyLedger } from '../lib/chain.js';
import { verifyProof, verificationKey, CIRCUIT_INFO, artifactsReady } from '../lib/zkp.js';
import { buildAuditReport, reportToCsv, reportToPdf } from '../lib/reports.js';
import { logAudit } from '../lib/audit.js';
import { canonical, sha256 } from '../lib/hash.js';

export const auditorRouter = Router();
auditorRouter.use(requireAuth('AUDITOR'));

auditorRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const stats = await buildStats();
    const elections = await prisma.election.findMany({
      include: {
        _count: { select: { ballots: true, eligibleVoters: true, proofs: true } },
        results: { include: { candidate: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 });
    const ledger = await verifyLedger();
    const proofStats = await prisma.zKPProof.groupBy({ by: ['status'], _count: { _all: true } });

    res.json({
      ...stats,
      ledger: {
        valid: ledger.valid,
        blocks: ledger.blocks,
        transactions: ledger.transactions,
        signaturesChecked: ledger.signaturesChecked,
        errors: ledger.errors,
        checkedAt: ledger.checkedAt,
      },
      proofBreakdown: Object.fromEntries(proofStats.map((p) => [p.status, p._count._all])),
      electionSummaries: elections.map((e) => ({
        electionId: e.electionId,
        name: e.name,
        status: e.status,
        registeredVoters: e._count.eligibleVoters,
        ballots: e._count.ballots,
        proofs: e._count.proofs,
        tallyPublished: e.results.length > 0,
      })),
      recentActivity: logs.map((l) => ({
        action: l.action,
        detail: l.detail,
        createdAt: l.createdAt.toISOString(),
      })),
      circuit: { ...CIRCUIT_INFO, artifactsReady: artifactsReady() },
    });
  }),
);

auditorRouter.get(
  '/elections',
  asyncHandler(async (_req, res) => {
    const elections = await prisma.election.findMany({
      include: {
        _count: { select: { ballots: true, eligibleVoters: true, proofs: true } },
        candidates: { orderBy: { index: 'asc' } },
        results: true,
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(
      elections.map((e) => {
        const total = e.results.reduce((s, r) => s + r.votes, 0);
        return {
          electionId: e.electionId,
          name: e.name,
          description: e.description,
          status: e.status,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate.toISOString(),
          registeredVoters: e._count.eligibleVoters,
          ballots: e._count.ballots,
          proofs: e._count.proofs,
          participation: e._count.eligibleVoters
            ? Math.round((e._count.ballots / e._count.eligibleVoters) * 1000) / 10
            : 0,
          merkleRoot: e.merkleRoot,
          tallyPublished: e.results.length > 0,
          results: e.candidates
            .map((c) => ({
              name: c.name,
              votes: e.results.find((r) => r.candidateId === c.id)?.votes ?? 0,
              share: total ? Math.round(((e.results.find((r) => r.candidateId === c.id)?.votes ?? 0) / total) * 1000) / 10 : 0,
            }))
            .sort((a, b) => b.votes - a.votes),
        };
      }),
    );
  }),
);

auditorRouter.get(
  '/ledger',
  asyncHandler(async (_req, res) => {
    const blocks = await prisma.blockchainBlock.findMany({
      orderBy: { blockNumber: 'desc' },
      take: 80,
      include: {
        _count: { select: { transactions: true, signatures: true } },
        transactions: { select: { type: true }, take: 1 },
      },
    });
    const txs = await prisma.blockchainTransaction.findMany({
      orderBy: { timestamp: 'desc' },
      take: 80,
      include: { election: { select: { electionId: true } } },
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
      })),
      transactions: txs.map((t) => ({
        txHash: t.txHash,
        blockNumber: t.blockNumber,
        type: t.type,
        label: TX_LABELS[t.type] ?? t.type,
        timestamp: t.timestamp.toISOString(),
        status: t.status,
        electionId: t.election?.electionId ?? null,
      })),
    });
  }),
);

auditorRouter.get(
  '/ledger/:blockNumber',
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
        ? { required: block.consensusRound.required, votes: block.consensusRound.votes, achieved: block.consensusRound.achieved }
        : null,
      signatures: block.signatures.map((s) => ({
        validatorId: s.validator.validatorId,
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

auditorRouter.post(
  '/ledger/verify',
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await verifyLedger();
    await logAudit({
      req,
      actorId: req.user!.id,
      actorRole: 'AUDITOR',
      action: 'LEDGER_VERIFIED',
      detail: result.valid ? 'independent ledger verification: VALID' : `integrity failure: ${result.errors[0]}`,
    });
    res.json(result);
  }),
);

auditorRouter.get(
  '/zkp',
  asyncHandler(async (req, res) => {
    const electionId = String(req.query.electionId ?? '');
    const proofs = await prisma.zKPProof.findMany({
      where: electionId ? { election: { electionId } } : {},
      include: { election: { select: { electionId: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    const grouped = await prisma.zKPProof.groupBy({ by: ['status'], _count: { _all: true } });
    res.json({
      circuit: { ...CIRCUIT_INFO, artifactsReady: artifactsReady() },
      verificationKey: verificationKey(),
      stats: {
        total: grouped.reduce((s, g) => s + g._count._all, 0),
        verified: grouped.find((g) => g.status === 'VERIFIED')?._count._all ?? 0,
        rejected: grouped.find((g) => g.status === 'REJECTED')?._count._all ?? 0,
        pending: grouped.find((g) => g.status === 'PENDING')?._count._all ?? 0,
      },
      proofs: proofs.map((p) => ({
        id: p.id,
        electionId: p.election.electionId,
        electionName: p.election.name,
        nullifierPrefix: p.nullifier.slice(0, 16),
        rootPrefix: p.root.slice(0, 16),
        status: p.status,
        provenance: p.provenance,
        verificationMs: p.verificationMs,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  }),
);

auditorRouter.post(
  '/zkp/:id/verify',
  asyncHandler(async (req: AuthedRequest, res) => {
    const record = await prisma.zKPProof.findUnique({
      where: { id: req.params.id },
      include: { election: true },
    });
    if (!record) fail('Proof record not found', 404);

    if (record.provenance === 'SEEDED') {
      res.json({
        status: 'SEEDED_RECORD',
        verified: null,
        message:
          'This is a historical seeded record created with the demonstration dataset. It carries verification metadata but no Groth16 proof payload. Live ballots cast in this build are fully verified.',
      });
      return;
    }

    const parsed = JSON.parse(record.proofJson);
    const started = Date.now();
    const outcome = await verifyProof(
      { proof: parsed.proof, publicSignals: parsed.publicSignals },
      {
        root: record.root,
        fieldId: (parsed.publicSignals?.[1] ?? '').toString(),
        nullifier: record.nullifier,
      },
    );

    await logAudit({
      req,
      actorId: req.user!.id,
      actorRole: 'AUDITOR',
      action: 'ZKP_RECHECKED',
      target: record.election.electionId,
      detail: `proof ${record.id.slice(0, 8)} re-verified: ${outcome.verified ? 'valid' : 'invalid'}`,
    });

    res.json({
      status: outcome.verified ? 'VERIFIED' : 'REJECTED',
      verified: outcome.verified,
      durationMs: Date.now() - started,
      publicSignals: parsed.publicSignals,
      electionId: record.election.electionId,
      message: outcome.reason ?? 'Groth16 proof re-verified against the circuit verification key',
    });
  }),
);

auditorRouter.get(
  '/validators',
  asyncHandler(async (_req, res) => {
    const validators = await prisma.validator.findMany({ orderBy: { validatorId: 'asc' } });
    const sigs = await prisma.validatorSignature.groupBy({ by: ['validatorId'], _count: { _all: true } });
    const blockCount = await prisma.blockchainBlock.count();
    const rounds = await prisma.consensusRound.findMany({ orderBy: { startedAt: 'desc' }, take: 10 });
    res.json({
      threshold: 4,
      blockHeight: blockCount - 1,
      networkStatus: validators.every((v) => v.active) ? 'HEALTHY' : 'DEGRADED',
      validators: validators.map((v) => ({
        validatorId: v.validatorId,
        name: v.name,
        active: v.active,
        publicKey: v.publicKey,
        signatures: sigs.find((s) => s.validatorId === v.id)?._count._all ?? 0,
      })),
      recentRounds: rounds.map((r) => ({
        votes: r.votes,
        required: r.required,
        achieved: r.achieved,
        finishedAt: r.finishedAt?.toISOString() ?? null,
      })),
    });
  }),
);

auditorRouter.get(
  '/ballot-integrity',
  asyncHandler(async (_req, res) => {
    const elections = await prisma.election.findMany({
      include: {
        candidates: true,
        _count: { select: { ballots: true, nullifiers: true, eligibleVoters: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    const checks = [] as any[];
    for (const election of elections) {
      const encrypted = await prisma.encryptedBallot.findMany({
        where: { ballot: { electionId: election.id } },
        select: { ciphertexts: true, commitment: true },
      });
      let commitmentFailures = 0;
      let vectorFailures = 0;
      for (const e of encrypted) {
        const cts: string[] = JSON.parse(e.ciphertexts);
        if (sha256(canonical(cts)) !== e.commitment) commitmentFailures += 1;
        if (cts.length !== election.candidates.length) vectorFailures += 1;
      }
      checks.push({
        electionId: election.electionId,
        name: election.name,
        status: election.status,
        ballots: election._count.ballots,
        nullifiers: election._count.nullifiers,
        eligibleVoters: election._count.eligibleVoters,
        candidateCount: election.candidates.length,
        commitmentFailures,
        vectorFailures,
        nullifierConsistent: election._count.ballots === election._count.nullifiers,
        detail: 'Individual ballot contents remain encrypted; only ciphertext structure and commitments are checked.',
      });
    }
    res.json({ checks });
  }),
);

auditorRouter.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const elections = await prisma.election.findMany({
      include: {
        _count: { select: { ballots: true, eligibleVoters: true, proofs: true } },
        results: true,
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(
      elections.map((e) => ({
        electionId: e.electionId,
        name: e.name,
        status: e.status,
        registeredVoters: e._count.eligibleVoters,
        ballots: e._count.ballots,
        proofs: e._count.proofs,
        reportStatus: ['COMPLETED', 'CLOSED', 'TALLYING'].includes(e.status) ? 'READY' : 'PENDING',
        resultsPublished: e.results.length > 0,
      })),
    );
  }),
);

auditorRouter.get(
  '/reports/:electionId',
  asyncHandler(async (req, res) => {
    res.json(await buildAuditReport(req.params.electionId));
  }),
);

auditorRouter.get(
  '/reports/:electionId/csv',
  asyncHandler(async (req, res) => {
    const report = await buildAuditReport(req.params.electionId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cryptora-audit-${report.election.electionId}.csv"`);
    res.send(reportToCsv(report));
  }),
);

auditorRouter.get(
  '/reports/:electionId/pdf',
  asyncHandler(async (req, res) => {
    const report = await buildAuditReport(req.params.electionId);
    const pdf = await reportToPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cryptora-audit-${report.election.electionId}.pdf"`);
    res.send(pdf);
  }),
);

auditorRouter.get(
  '/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { auditor: true },
    });
    if (!user) fail('Auditor not found', 404);
    res.json({
      name: user.name,
      email: user.email,
      auditorNumber: user.auditor?.auditorNumber ?? user.auditorId,
      organisation: user.auditor?.organisation,
      accreditation: user.auditor?.accreditation,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      accessLevel: 'READ_ONLY',
      permissions: [
        'Inspect election metadata',
        'Verify ZK proofs',
        'Inspect and verify blockchain ledger',
        'Export audit reports',
      ],
      restrictions: ['Cannot modify elections', 'Cannot alter ballots', 'Cannot view individual candidate selections'],
    });
  }),
);

auditorRouter.get(
  '/security',
  asyncHandler(async (req: AuthedRequest, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    const events = await prisma.auditLog.findMany({
      where: { actorId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    res.json({
      sessions: sessions.map((s) => ({
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        ip: s.ip,
      })),
      events: events.map((e) => ({ action: e.action, detail: e.detail, createdAt: e.createdAt.toISOString() })),
      controls: [
        'Backend-enforced AUDITOR role checks on every audit endpoint',
        'Read-only access: no mutation routes are authorised for auditors',
        'Session cookies are HttpOnly and expire automatically',
        'All audit verifications are written to the immutable audit log',
      ],
    });
  }),
);
