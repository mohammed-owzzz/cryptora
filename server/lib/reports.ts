import PDFDocument from 'pdfkit';
import { prisma } from './prisma.js';
import { verifyLedger } from './chain.js';
import { canonical, sha256 } from './hash.js';

export interface AuditReport {
  generatedAt: string;
  election: {
    electionId: string;
    name: string;
    description: string;
    status: string;
    startDate: string;
    endDate: string;
    rules: string;
    merkleRoot: string | null;
  };
  registry: { eligibleVoters: number; commitments: number };
  ballots: { accepted: number; claimed: number; participation: number };
  zkp: { total: number; verified: number; rejected: number; pending: number };
  consensus: { blocks: number; approvals: number; required: number; validatorParticipation: { validatorId: string; signatures: number }[] };
  ledger: { valid: boolean; blocks: number; transactions: number; errors: string[] };
  results: { candidateId: string; name: string; votes: number; share: number }[];
  rejectedTransactions: number;
}

export async function buildAuditReport(electionId: string): Promise<AuditReport> {
  const election = await prisma.election.findUnique({
    where: { electionId },
    include: { candidates: { orderBy: { index: 'asc' } }, results: true },
  });
  if (!election) throw new Error('Election not found');

  const [eligible, ballots, proofs, blocks, txs, validators, ledger] = await Promise.all([
    prisma.eligibleVoter.count({ where: { electionId: election.id } }),
    prisma.ballot.count({ where: { electionId: election.id } }),
    prisma.zKPProof.findMany({ where: { electionId: election.id }, select: { status: true } }),
    prisma.blockchainBlock.findMany({ where: { transactions: { some: { electionId: election.id } } } }),
    prisma.blockchainTransaction.findMany({ where: { electionId: election.id } }),
    prisma.validator.findMany({ orderBy: { validatorId: 'asc' } }),
    verifyLedger(),
  ]);

  const sigCounts = await prisma.validatorSignature.groupBy({ by: ['validatorId'], _count: { _all: true } });
  const totals = election.results.reduce((s, r) => s + r.votes, 0);

  return {
    generatedAt: new Date().toISOString(),
    election: {
      electionId: election.electionId,
      name: election.name,
      description: election.description,
      status: election.status,
      startDate: election.startDate.toISOString(),
      endDate: election.endDate.toISOString(),
      rules: election.rules,
      merkleRoot: election.merkleRoot,
    },
    registry: { eligibleVoters: eligible, commitments: eligible },
    ballots: {
      accepted: ballots,
      claimed: ballots,
      participation: eligible ? Math.round((ballots / eligible) * 1000) / 10 : 0,
    },
    zkp: {
      total: proofs.length,
      verified: proofs.filter((p) => p.status === 'VERIFIED').length,
      rejected: proofs.filter((p) => p.status === 'REJECTED').length,
      pending: proofs.filter((p) => p.status === 'PENDING').length,
    },
    consensus: {
      blocks: blocks.length,
      approvals: blocks.reduce((s, b) => s + b.approvals, 0),
      required: 4,
      validatorParticipation: validators.map((v) => ({
        validatorId: v.validatorId,
        signatures: sigCounts.find((s) => s.validatorId === v.id)?._count._all ?? 0,
      })),
    },
    ledger: { valid: ledger.valid, blocks: ledger.blocks, transactions: ledger.transactions, errors: ledger.errors },
    results: election.candidates
      .map((c) => {
        const votes = election.results.find((r) => r.candidateId === c.id)?.votes ?? 0;
        return {
          candidateId: c.candidateId,
          name: c.name,
          votes,
          share: totals ? Math.round((votes / totals) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.votes - a.votes),
    rejectedTransactions: txs.filter((t) => t.status !== 'CONFIRMED').length,
  };
}

export function reportToCsv(report: AuditReport): string {
  const lines: string[] = [];
  lines.push('CRYPTORA AUDIT REPORT');
  lines.push(`Generated,${report.generatedAt}`);
  lines.push(`Election,${report.election.name}`);
  lines.push(`Election ID,${report.election.electionId}`);
  lines.push(`Status,${report.election.status}`);
  lines.push(`Voting period,${report.election.startDate} - ${report.election.endDate}`);
  lines.push(`Merkle root,${report.election.merkleRoot ?? 'not published'}`);
  lines.push('');
  lines.push('METRIC,VALUE');
  lines.push(`Registered voters,${report.registry.eligibleVoters}`);
  lines.push(`Accepted ballots,${report.ballots.accepted}`);
  lines.push(`Participation %,${report.ballots.participation}`);
  lines.push(`ZKP verified,${report.zkp.verified}`);
  lines.push(`ZKP rejected,${report.zkp.rejected}`);
  lines.push(`Consensus blocks,${report.consensus.blocks}`);
  lines.push(`Rejected transactions,${report.rejectedTransactions}`);
  lines.push(`Ledger integrity,${report.ledger.valid ? 'VALID' : 'INTEGRITY FAILURE'}`);
  lines.push(`Ledger blocks,${report.ledger.blocks}`);
  lines.push(`Report digest,${sha256(canonical(report))}`);
  lines.push('');
  lines.push('CANDIDATE,VOTES,SHARE %');
  for (const r of report.results) lines.push(`${r.name},${r.votes},${r.share}`);
  lines.push('');
  lines.push('VALIDATOR,SIGNATURES');
  for (const v of report.consensus.validatorParticipation) lines.push(`${v.validatorId},${v.signatures}`);
  return lines.join('\n');
}

export function reportToPdf(report: AuditReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const lime = '#5C7A12';
    doc.fillColor('#111210').fontSize(22).font('Helvetica-Bold').text('CRYPTORA');
    doc.fontSize(10).font('Helvetica').fillColor('#555').text('Private by design. Verifiable by consensus.');
    doc.moveDown(1.2);
    doc.fillColor('#111210').fontSize(16).font('Helvetica-Bold').text('Independent Audit Report');
    doc.moveDown(0.6);

    const line = (label: string, value: string) => {
      doc.fontSize(9).font('Helvetica').fillColor('#666').text(label.toUpperCase());
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111210').text(value);
      doc.moveDown(0.5);
    };

    line('Election', report.election.name);
    line('Election ID', report.election.electionId);
    line('Status', report.election.status);
    line('Voting period', `${report.election.startDate.slice(0, 10)} - ${report.election.endDate.slice(0, 10)}`);
    line('Eligibility Merkle root', report.election.merkleRoot ?? 'not published');

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(lime).text('Verification summary');
    doc.moveDown(0.4);
    line('Registered voters', String(report.registry.eligibleVoters));
    line('Accepted ballots', String(report.ballots.accepted));
    line('Participation', `${report.ballots.participation}%`);
    line('ZKP proofs verified', `${report.zkp.verified} (rejected ${report.zkp.rejected})`);
    line('Consensus blocks', `${report.consensus.blocks} at ${report.consensus.required}-of-5 quorum`);
    line('Ledger integrity', report.ledger.valid ? 'VALID' : `INTEGRITY FAILURE (${report.ledger.errors[0] ?? ''})`);

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(lime).text('Aggregate results');
    doc.moveDown(0.4);
    if (report.results.length === 0 || report.results.every((r) => r.votes === 0)) {
      doc.fontSize(10).font('Helvetica').fillColor('#666').text('Results have not been published for this election.');
    } else {
      for (const r of report.results) {
        doc.fontSize(10).font('Helvetica').fillColor('#111210').text(`${r.name} — ${r.votes} votes (${r.share}%)`);
      }
    }

    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(lime).text('Validator participation');
    doc.moveDown(0.4);
    for (const v of report.consensus.validatorParticipation) {
      doc.fontSize(10).font('Helvetica').fillColor('#111210').text(`${v.validatorId} — ${v.signatures} signatures`);
    }

    doc.moveDown(1.4);
    doc.fontSize(8).fillColor('#888').text(`Report digest: ${sha256(canonical(report))}`);
    doc.text(`Generated: ${report.generatedAt}`);
    doc.text('CRYPTORA is an academic prototype. It is not certified for legally binding public elections.');
    doc.end();
  });
}
