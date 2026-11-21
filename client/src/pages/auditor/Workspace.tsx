import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  FileText,
  Fingerprint,
  KeyRound,
  Layers,
  Network,
  Search,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  Select,
  StatusBadge,
  useToast,
} from '../../components/ui';
import { BlockDetailModal, BlockTable } from '../../components/Ledger';
import { useApi } from '../../lib/useApi';
import { api, downloadFile } from '../../lib/api';
import { formatDate, formatDateTime, formatNumber, formatPercent, relativeTime, shortHash } from '../../lib/format';
import type { BlockSummary } from '../../lib/types';

/* ------------------------------- Elections -------------------------------- */

interface AuditElection {
  electionId: string;
  name: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  registeredVoters: number;
  ballots: number;
  proofs: number;
  participation: number;
  merkleRoot: string | null;
  tallyPublished: boolean;
  results: { name: string; votes: number; share: number }[];
}

export function AuditorElections() {
  const { data, loading } = useApi<AuditElection[]>('/api/auditor/elections');
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Election Audits"
        description="Registry size, ballot count, proof coverage and the published tally for every election in the system."
      />

      {loading && <LoadingBlock rows={5} />}

      <div className="space-y-3">
        {(data ?? []).map((e) => {
          const open = expanded === e.electionId;
          return (
            <Card key={e.electionId} padded={false}>
              <button
                onClick={() => setExpanded(open ? null : e.electionId)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink/45">
                    <Layers className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold">{e.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink/45">
                      {e.electionId} · {formatDate(e.startDate)} – {formatDate(e.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="outline" dot={false}>
                    {formatNumber(e.ballots)} ballots
                  </Badge>
                  <Badge tone="lime">
                    {formatPercent(e.participation)} turnout
                  </Badge>
                  <Badge tone={e.tallyPublished ? 'lime' : 'neutral'}>{e.tallyPublished ? 'Tally published' : 'No tally'}</Badge>
                  <StatusBadge status={e.status} />
                  <ChevronDown className={`h-4 w-4 text-ink/35 transition ${open ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {open && (
                <div className="border-t border-line px-5 py-4">
                  <p className="text-[12px] leading-relaxed text-ink/55">{e.description}</p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {[
                      ['Registered voters', formatNumber(e.registeredVoters)],
                      ['Ballots accepted', formatNumber(e.ballots)],
                      ['Proof records', formatNumber(e.proofs)],
                      ['Participation', formatPercent(e.participation)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-line px-3 py-2">
                        <p className="stat-label">{label}</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2.5">
                    <p className="stat-label">Published eligibility root</p>
                    <p className="mono mt-1 break-all text-[11px] text-ink/60">{e.merkleRoot ?? 'Not published'}</p>
                  </div>

                  {e.tallyPublished ? (
                    <div className="mt-4 space-y-2">
                      <p className="stat-label">Published tally</p>
                      {e.results.map((r) => (
                        <div key={r.name} className="flex items-center gap-3">
                          <span className="w-[190px] shrink-0 truncate text-[12px] text-ink/70">{r.name}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                            <div className="h-full rounded-full bg-lime" style={{ width: `${Math.max(r.share, 1.5)}%` }} />
                          </div>
                          <span className="w-[110px] shrink-0 text-right text-[11.5px] tabular-nums text-ink/60">
                            {formatNumber(r.votes)} · {formatPercent(r.share)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-[12px] text-ink/45">No aggregate tally has been published for this election yet.</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------- Ledger --------------------------------- */

interface LedgerTx {
  txHash: string;
  blockNumber: number | null;
  type: string;
  label: string;
  timestamp: string;
  status: string;
  electionId: string | null;
}

export function AuditorLedger() {
  const { data, loading } = useApi<{ height: number; blocks: BlockSummary[]; transactions: LedgerTx[] }>('/api/auditor/ledger');
  const { push } = useToast();
  const [tab, setTab] = useState<'blocks' | 'transactions'>('blocks');
  const [query, setQuery] = useState('');
  const [openBlock, setOpenBlock] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState<{ valid: boolean; blocks: number; transactions: number; signaturesChecked: number; errors: string[] } | null>(null);

  const blocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data?.blocks ?? [];
    return (data?.blocks ?? []).filter(
      (b) => b.blockHash.toLowerCase().includes(q) || String(b.blockNumber) === q || b.merkleRoot.toLowerCase().includes(q),
    );
  }, [data, query]);

  const transactions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data?.transactions ?? [];
    return (data?.transactions ?? []).filter(
      (t) => t.txHash.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) || (t.electionId ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  const verify = async () => {
    setBusy(true);
    try {
      const outcome = await api.post<typeof verification>('/api/auditor/ledger/verify');
      setVerification(outcome);
      push({
        title: outcome?.valid ? 'Ledger verified independently' : 'Integrity failure',
        description: outcome?.valid ? 'All hash links and signatures recomputed successfully.' : outcome?.errors.join(' · '),
        tone: outcome?.valid ? 'success' : 'error',
      });
    } catch (err: any) {
      push({ title: 'Verification failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blockchain Ledger"
        description="Traverse the chain block by block. Each header hash covers the previous hash, the Merkle root and the transaction count."
        actions={
          <Button variant="lime" loading={busy} onClick={verify}>
            <ShieldCheck className="h-4 w-4" /> Verify chain
          </Button>
        }
      />

      {verification && (
        <Callout
          tone={verification.valid ? 'lime' : 'danger'}
          icon={verification.valid ? <CheckCircle2 className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
          title={verification.valid ? 'Chain integrity valid' : 'Chain integrity failure'}
        >
          {verification.valid
            ? `${formatNumber(verification.blocks)} blocks and ${formatNumber(verification.transactions)} transactions verified with ${formatNumber(
                verification.signaturesChecked,
              )} signatures.`
            : verification.errors.join(' · ')}
        </Callout>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Chain height', `#${data?.height ?? 0}`],
          ['Blocks in window', formatNumber(data?.blocks.length ?? 0)],
          ['Transactions in window', formatNumber(data?.transactions.length ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[20px] font-bold leading-none">{value}</p>
          </div>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {(['blocks', 'transactions'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-[11.5px] font-medium capitalize transition ${
                  tab === t ? 'bg-white text-ink shadow-sm' : 'text-ink/50 hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hash, block or type"
              className="h-9 w-[280px] rounded-lg border border-line bg-white pl-9 pr-3 font-mono text-[11.5px] focus:outline-none"
            />
          </div>
        </div>

        {tab === 'blocks' ? (
          <BlockTable blocks={blocks} loading={loading} onOpen={setOpenBlock} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Type</th>
                  <th>Election</th>
                  <th>Block</th>
                  <th>Timestamp</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6}>
                      <LoadingBlock rows={6} />
                    </td>
                  </tr>
                )}
                {transactions.map((t) => (
                  <tr key={t.txHash}>
                    <td className="mono text-[11px] text-ink/55">{shortHash(t.txHash, 12, 8)}</td>
                    <td className="text-[12px]">{t.label}</td>
                    <td className="text-[11.5px] text-ink/50">{t.electionId ?? '—'}</td>
                    <td className="text-[12px] tabular-nums text-ink/60">#{t.blockNumber}</td>
                    <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDateTime(t.timestamp)}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && transactions.length === 0 && (
              <div className="p-6">
                <EmptyState icon={<Layers className="h-5 w-5" />} title="No transactions match" description="Clear the search to see the full window." />
              </div>
            )}
          </div>
        )}
      </Card>

      <BlockDetailModal blockNumber={openBlock} onClose={() => setOpenBlock(null)} path="/api/auditor/ledger" />
    </div>
  );
}

/* ---------------------------------- ZKP ----------------------------------- */

interface AuditorProof {
  id: string;
  electionId: string;
  electionName: string;
  nullifierPrefix: string;
  rootPrefix: string;
  status: string;
  provenance: string;
  verificationMs: number | null;
  createdAt: string;
}

interface VerifyOutcome {
  status: string;
  verified: boolean | null;
  durationMs?: number;
  publicSignals?: string[];
  message: string;
}

export function AuditorZkp() {
  const { data, loading } = useApi<{
    circuit: { name: string; depth: number; protocol: string; curve: string; artifactsReady: boolean };
    stats: { total: number; verified: number; rejected: number; pending: number };
    proofs: AuditorProof[];
  }>('/api/auditor/zkp');
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ proof: AuditorProof; result: VerifyOutcome } | null>(null);
  const [filter, setFilter] = useState('ALL');

  const rows = useMemo(
    () => (data?.proofs ?? []).filter((p) => filter === 'ALL' || p.provenance === filter),
    [data, filter],
  );

  const verify = async (p: AuditorProof) => {
    setBusy(p.id);
    try {
      const result = await api.post<VerifyOutcome>(`/api/auditor/zkp/${p.id}/verify`);
      setOutcome({ proof: p, result });
      push({
        title: result.verified === null ? 'Seeded record' : result.verified ? 'Proof re-verified' : 'Proof rejected',
        description: result.verified === null ? 'No proof payload exists for seeded records.' : result.message,
        tone: result.verified === false ? 'error' : 'success',
      });
    } catch (err: any) {
      push({ title: 'Verification failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="ZKP Verification"
        description="Re-run Groth16 verification independently of the submission path. Live proofs carry their full payload and can be checked here."
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Total proofs', formatNumber(data?.stats.total ?? 0)],
          ['Verified', formatNumber(data?.stats.verified ?? 0)],
          ['Rejected', formatNumber(data?.stats.rejected ?? 0)],
          ['Pending', formatNumber(data?.stats.pending ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[21px] font-bold leading-none">{value}</p>
          </div>
        ))}
      </div>

      {outcome && (
        <Callout
          tone={outcome.result.verified === false ? 'danger' : outcome.result.verified === null ? 'neutral' : 'lime'}
          icon={outcome.result.verified === false ? <ShieldX className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          title={
            outcome.result.verified === null
              ? `Seeded record · ${outcome.proof.electionId}`
              : outcome.result.verified
                ? `Proof ${outcome.proof.id.slice(0, 10)} verified`
                : `Proof ${outcome.proof.id.slice(0, 10)} failed verification`
          }
        >
          <p>{outcome.result.message}</p>
          {outcome.result.publicSignals && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
              {['root', 'electionId', 'nullifier'].map((label, i) => (
                <div key={label} className="rounded-lg border border-line bg-white px-2.5 py-2">
                  <p className="stat-label">{label}</p>
                  <p className="mono mt-0.5 break-all text-[10px]">{shortHash(outcome.result.publicSignals?.[i], 10, 6)}</p>
                </div>
              ))}
            </div>
          )}
          {outcome.result.durationMs != null && (
            <p className="mt-2 text-[11px] text-ink/50">Verification completed in {outcome.result.durationMs} ms.</p>
          )}
        </Callout>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SectionHeading title="Proof records" description="Select any live record to re-verify it against the verification key." />
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 w-[170px] text-[12.5px]">
            <option value="ALL">All provenance</option>
            <option value="LIVE">Live proofs</option>
            <option value="SEEDED">Seeded records</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Proof</th>
                <th>Election</th>
                <th>Root</th>
                <th>Provenance</th>
                <th className="text-right">Ms</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7}>
                    <LoadingBlock rows={5} />
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="mono text-[11px] text-ink/55">{p.id.slice(0, 10)}</td>
                  <td>
                    <p className="text-[12px]">{p.electionName}</p>
                    <p className="text-[10px] text-ink/40">{p.electionId}</p>
                  </td>
                  <td className="mono text-[11px] text-ink/45">{p.rootPrefix}…</td>
                  <td>
                    <Badge tone={p.provenance === 'LIVE' ? 'lime' : 'outline'} dot={false}>
                      {p.provenance}
                    </Badge>
                  </td>
                  <td className="text-right tabular-nums text-ink/60">{p.verificationMs ?? '—'}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-right">
                    <Button variant="outline" size="sm" loading={busy === p.id} onClick={() => verify(p)}>
                      <Fingerprint className="h-3 w-3" /> Verify
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout tone="neutral" icon={<Cpu className="h-4 w-4" />} title={`Circuit ${data?.circuit.name ?? 'eligibility'}.circom`}>
        {data?.circuit.protocol?.toUpperCase() ?? 'GROTH16'} over {data?.circuit.curve ?? 'bn128'} · depth{' '}
        {data?.circuit.depth ?? 13} Poseidon Merkle tree · public signals: root, electionId, nullifier.
      </Callout>
    </div>
  );
}

/* ------------------------------- Validators ------------------------------- */

export function AuditorValidators() {
  const { data, loading } = useApi<{
    threshold: number;
    blockHeight: number;
    networkStatus: string;
    validators: { validatorId: string; name: string; active: boolean; publicKey: string; signatures: number }[];
    recentRounds: { votes: number; required: number; achieved: boolean; finishedAt: string | null }[];
  }>('/api/auditor/validators');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Validator Network"
        description="Signature participation per validator, plus the most recent consensus rounds."
        actions={<Badge tone={data?.networkStatus === 'HEALTHY' ? 'lime' : 'danger'}>{data?.networkStatus ?? '—'}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Block height', `#${data?.blockHeight ?? 0}`],
          ['Quorum threshold', `${data?.threshold ?? 4} of 5`],
          ['Active validators', `${data?.validators.filter((v) => v.active).length ?? 0}`],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[21px] font-bold leading-none">{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.validators ?? []).map((v) => (
            <Card key={v.validatorId}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink/45">
                    <Network className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">{v.validatorId}</p>
                    <p className="text-[11px] text-ink/45">{v.name}</p>
                  </div>
                </div>
                <Badge tone={v.active ? 'lime' : 'danger'}>{v.active ? 'Active' : 'Offline'}</Badge>
              </div>
              <div className="mt-3 rounded-lg border border-line bg-canvas px-2.5 py-2">
                <p className="stat-label">Ed25519 public key</p>
                <p className="mono mt-0.5 break-all text-[10px] text-ink/55">{v.publicKey}</p>
              </div>
              <p className="mt-2 text-[11.5px] text-ink/50">
                <span className="font-semibold text-ink">{formatNumber(v.signatures)}</span> block signatures recorded
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card padded={false}>
        <div className="px-5 pt-5">
          <SectionHeading title="Recent consensus rounds" description="Each round collects signatures until quorum is reached." />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Round</th>
                <th className="text-right">Votes</th>
                <th className="text-right">Required</th>
                <th>Outcome</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentRounds ?? []).map((r, i) => (
                <tr key={i}>
                  <td className="text-[12px] tabular-nums">#{i + 1}</td>
                  <td className="text-right tabular-nums text-ink/70">{r.votes}</td>
                  <td className="text-right tabular-nums text-ink/70">{r.required}</td>
                  <td>
                    <Badge tone={r.achieved ? 'lime' : 'danger'}>{r.achieved ? 'Quorum' : 'Failed'}</Badge>
                  </td>
                  <td className="text-[11.5px] text-ink/45">{r.finishedAt ? formatDateTime(r.finishedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------- Ballot integrity ---------------------------- */

interface IntegrityCheck {
  electionId: string;
  name: string;
  status: string;
  ballots: number;
  nullifiers: number;
  eligibleVoters: number;
  candidateCount: number;
  commitmentFailures: number;
  vectorFailures: number;
  nullifierConsistent: boolean;
  detail: string;
}

export function AuditorBallotIntegrity() {
  const { data, loading, refetch } = useApi<{ checks: IntegrityCheck[] }>('/api/auditor/ballot-integrity');
  const checks = data?.checks ?? [];
  const totalFailures = checks.reduce((s, c) => s + c.commitmentFailures + c.vectorFailures, 0);
  const allConsistent = checks.every((c) => c.nullifierConsistent);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ballot Integrity"
        description="Structural checks over stored ciphertexts: commitment binding, vector length and nullifier parity."
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            Re-run checks
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Elections checked', String(checks.length)],
          ['Commitment / vector failures', String(totalFailures)],
          ['Nullifier parity', allConsistent ? 'Consistent' : 'Mismatch'],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[20px] font-bold leading-none">{value}</p>
          </div>
        ))}
      </div>

      {!loading && totalFailures === 0 && (
        <Callout tone="lime" icon={<CheckCircle2 className="h-4 w-4" />} title="No structural anomalies detected">
          Every stored ciphertext vector matches its candidate count, every commitment recomputes from its ciphertexts, and
          each accepted ballot has exactly one nullifier.
        </Callout>
      )}

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Election</th>
                <th className="text-right">Ballots</th>
                <th className="text-right">Nullifiers</th>
                <th className="text-right">Candidates</th>
                <th className="text-right">Commitment fails</th>
                <th className="text-right">Vector fails</th>
                <th>Parity</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7}>
                    <LoadingBlock rows={5} />
                  </td>
                </tr>
              )}
              {checks.map((c) => (
                <tr key={c.electionId}>
                  <td>
                    <p className="text-[12.5px] font-medium">{c.name}</p>
                    <p className="text-[10.5px] text-ink/40">{c.electionId}</p>
                  </td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(c.ballots)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(c.nullifiers)}</td>
                  <td className="text-right tabular-nums text-ink/70">{c.candidateCount}</td>
                  <td className="text-right tabular-nums">
                    <span className={c.commitmentFailures ? 'font-semibold text-red-600' : 'text-ink/60'}>{c.commitmentFailures}</span>
                  </td>
                  <td className="text-right tabular-nums">
                    <span className={c.vectorFailures ? 'font-semibold text-red-600' : 'text-ink/60'}>{c.vectorFailures}</span>
                  </td>
                  <td>
                    <Badge tone={c.nullifierConsistent ? 'lime' : 'danger'}>{c.nullifierConsistent ? 'OK' : 'Mismatch'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout tone="neutral" icon={<AlertTriangle className="h-4 w-4" />} title="What cannot be checked">
        {checks[0]?.detail ??
          'Individual ballot contents remain encrypted; only ciphertext structure and commitments are checked.'}{' '}
        Well-formedness (that each vector is exactly one-hot) is not proven in-circuit in this build.
      </Callout>
    </div>
  );
}

/* --------------------------------- Reports -------------------------------- */

interface ReportSummary {
  electionId: string;
  name: string;
  status: string;
  registeredVoters: number;
  ballots: number;
  proofs: number;
  reportStatus: string;
  resultsPublished: boolean;
}

interface ReportDetail {
  generatedAt: string;
  election: { electionId: string; name: string; merkleRoot: string | null };
  registry: { eligibleVoters: number };
  ballots: { accepted: number; participation: number };
  zkp: { total: number; verified: number; rejected: number };
  consensus: { blocks: number; approvals: number; validatorParticipation: { validatorId: string; signatures: number }[] };
  ledger: { valid: boolean };
  results: { candidateId: string; name: string; votes: number; share: number }[];
  rejectedTransactions: number;
}

export function AuditorReports() {
  const { data, loading } = useApi<ReportSummary[]>('/api/auditor/reports');
  const { push } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const preview = async (electionId: string) => {
    setSelected(electionId);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await api.get<ReportDetail>(`/api/auditor/reports/${electionId}`));
    } catch (err: any) {
      push({ title: 'Could not load report', description: err?.message, tone: 'error' });
    } finally {
      setDetailLoading(false);
    }
  };

  const download = async (electionId: string, format: 'csv' | 'pdf') => {
    setBusy(`${electionId}-${format}`);
    try {
      await downloadFile(`/api/auditor/reports/${electionId}/${format}`, `cryptora-audit-${electionId}.${format}`);
      push({ title: 'Report exported', description: `${electionId}.${format} downloaded.` });
    } catch (err: any) {
      push({ title: 'Export failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Reports"
        description="Every report is generated from live data at request time, including a fresh full-chain verification."
      />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Election</th>
                <th>Status</th>
                <th className="text-right">Registered</th>
                <th className="text-right">Ballots</th>
                <th className="text-right">Proofs</th>
                <th>Report</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7}>
                    <LoadingBlock rows={5} />
                  </td>
                </tr>
              )}
              {(data ?? []).map((r) => (
                <tr key={r.electionId}>
                  <td>
                    <p className="text-[12.5px] font-medium">{r.name}</p>
                    <p className="text-[10.5px] text-ink/40">{r.electionId}</p>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(r.registeredVoters)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(r.ballots)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(r.proofs)}</td>
                  <td>
                    <Badge tone={r.reportStatus === 'READY' ? 'lime' : 'neutral'}>{r.reportStatus}</Badge>
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => preview(r.electionId)}>
                        Preview
                      </Button>
                      <Button variant="outline" size="sm" loading={busy === `${r.electionId}-csv`} onClick={() => download(r.electionId, 'csv')}>
                        <Download className="h-3 w-3" /> CSV
                      </Button>
                      <Button variant="outline" size="sm" loading={busy === `${r.electionId}-pdf`} onClick={() => download(r.electionId, 'pdf')}>
                        <FileText className="h-3 w-3" /> PDF
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {(detailLoading || detail) && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeading
              title={detail ? `${detail.election.name} — audit report` : 'Loading report'}
              description={detail ? `${detail.election.electionId} · generated ${formatDateTime(detail.generatedAt)}` : undefined}
            />
            <Badge tone={detail?.ledger.valid ? 'lime' : 'danger'}>{detail?.ledger.valid ? 'Ledger valid' : 'Ledger failed'}</Badge>
          </div>

          {detailLoading && (
            <div className="mt-4">
              <LoadingBlock rows={3} />
            </div>
          )}

          {detail && (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Eligible voters', formatNumber(detail.registry.eligibleVoters)],
                  ['Ballots accepted', formatNumber(detail.ballots.accepted)],
                  ['Participation', formatPercent(detail.ballots.participation)],
                  ['Proofs verified', `${formatNumber(detail.zkp.verified)} / ${formatNumber(detail.zkp.total)}`],
                  ['Rejected proofs', formatNumber(detail.zkp.rejected)],
                  ['Blocks touched', formatNumber(detail.consensus.blocks)],
                  ['Signatures', formatNumber(detail.consensus.approvals)],
                  ['Rejected transactions', formatNumber(detail.rejectedTransactions)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-line px-3 py-2">
                    <p className="stat-label">{label}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="stat-label">Published tally</p>
                  <div className="mt-2 space-y-1.5">
                    {detail.results.length === 0 && <p className="text-[12px] text-ink/45">No tally published for this election.</p>}
                    {detail.results.map((r) => (
                      <div key={r.candidateId} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                        <span className="text-[12px] text-ink/70">{r.name}</span>
                        <span className="text-[12px] font-semibold tabular-nums">
                          {formatNumber(r.votes)} · {formatPercent(r.share)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="stat-label">Validator signature participation</p>
                  <div className="mt-2 space-y-1.5">
                    {detail.consensus.validatorParticipation.map((v) => (
                      <div key={v.validatorId} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                        <span className="mono text-[11px] text-ink/60">{v.validatorId}</span>
                        <span className="text-[11.5px] tabular-nums">{formatNumber(v.signatures)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-canvas px-3 py-2.5">
                <p className="stat-label">Eligibility root</p>
                <p className="mono mt-1 break-all text-[11px] text-ink/60">{detail.election.merkleRoot ?? 'Not published'}</p>
              </div>
            </>
          )}
        </Card>
      )}

      {selected && !detailLoading && !detail && (
        <p className="text-[12px] text-ink/45">Select an election to preview its audit report.</p>
      )}
    </div>
  );
}

/* --------------------------------- Profile -------------------------------- */

export function AuditorProfile() {
  const { data, loading } = useApi<{
    name: string;
    email: string;
    auditorNumber: string | null;
    organisation: string | null;
    accreditation: string | null;
    lastLoginAt: string | null;
    accessLevel: string;
    permissions: string[];
    restrictions: string[];
  }>('/api/auditor/profile');

  if (loading || !data) return <LoadingBlock rows={5} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Auditor Profile"
        description="Accreditation details and the exact scope of this read-only role."
        actions={<Badge tone="lime">{data.accessLevel.replace('_', ' ')}</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar role="AUDITOR" size="lg" />
            <div>
              <p className="text-[16px] font-semibold">{data.name}</p>
              <p className="text-[12px] text-ink/50">{data.email}</p>
              <p className="mt-1 text-[11px] text-ink/40">{data.auditorNumber}</p>
            </div>
          </div>
          <dl className="mt-5 space-y-2 text-[12px]">
            {[
              ['Organisation', data.organisation ?? '—'],
              ['Accreditation', data.accreditation ?? '—'],
              ['Access level', data.accessLevel],
              ['Last sign-in', data.lastLoginAt ? formatDateTime(data.lastLoginAt) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="text-ink/50">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Authorised actions" description="Enforced on every auditor API route." />
            <ul className="mt-3 space-y-1.5">
              {data.permissions.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[12px] text-ink/60">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c6b10]" /> {p}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionHeading title="Restrictions" description="No mutation endpoint is authorised for this role." />
            <ul className="mt-3 space-y-1.5">
              {data.restrictions.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[12px] text-ink/60">
                  <ShieldX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" /> {p}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Security -------------------------------- */

export function AuditorSecurity() {
  const { data, loading } = useApi<{
    sessions: { createdAt: string; expiresAt: string; ip: string | null }[];
    events: { action: string; detail: string; createdAt: string }[];
    controls: string[];
  }>('/api/auditor/security');

  if (loading || !data) return <LoadingBlock rows={5} />;

  return (
    <div className="space-y-5">
      <PageHeader title="Security Settings" description="Session history, audit events and the controls applied to this role." />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <SectionHeading title="Sessions" description="Each sign-in is a separate server-side session." />
          </div>
          <div className="mt-4 divide-y divide-line">
            {data.sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-[12px] font-medium">Session {i + 1}</p>
                  <p className="text-[10.5px] text-ink/40">
                    {s.ip ?? 'unknown IP'} · {relativeTime(s.createdAt)}
                  </p>
                </div>
                <span className="text-[10.5px] text-ink/40">expires {formatDateTime(s.expiresAt)}</span>
              </div>
            ))}
            {data.sessions.length === 0 && <p className="px-5 py-4 text-[12px] text-ink/50">No active sessions.</p>}
          </div>
        </Card>

        <Card>
          <SectionHeading title="Controls in force" description="Applied by the backend, not by the interface." />
          <ul className="mt-3 space-y-1.5">
            {data.controls.map((c) => (
              <li key={c} className="flex items-start gap-2 text-[12px] text-ink/60">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" /> {c}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <SectionHeading title="Audit events" description="Actions recorded against your auditor account." />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e, i) => (
                <tr key={`${e.action}-${i}`}>
                  <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDateTime(e.createdAt)}</td>
                  <td>
                    <span className="mono rounded bg-surface px-1.5 py-0.5 text-[10.5px] font-medium text-ink/65">{e.action}</span>
                  </td>
                  <td className="text-[11.5px] text-ink/60">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------- Help ---------------------------------- */

const AUDITOR_FAQ = [
  {
    q: 'How do I verify that no ballot was altered?',
    a: 'Open Ballot Integrity to re-check every stored ciphertext commitment and vector length, then run Verify chain in the ledger view. Any mutation produces a different commitment or breaks a block hash link.',
  },
  {
    q: 'Why do some proofs say SEEDED?',
    a: 'The demonstration dataset ships with historical ballots that carry genuine ciphertexts and commitments but no Groth16 proof payload. Those records are labelled SEEDED so they can never be mistaken for live cryptographic proofs.',
  },
  {
    q: 'Can I see how an individual voted?',
    a: 'No. Ballots are stored as Paillier ciphertexts and the tally key is only ever applied to the aggregate. The audit role deliberately has no route that could join a voter to a selection.',
  },
  {
    q: 'What does the report include?',
    a: 'Registry size, accepted ballots, participation, proof outcomes, consensus participation, chain height, a fresh ledger verification result and the published tally with shares.',
  },
];

export function AuditorHelp() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-5">
      <PageHeader title="Help Centre" description="How to run an independent audit of this deployment." />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <SectionHeading title="Auditor questions" description="Four answers that cover the review workflow." />
          <div className="mt-4 divide-y divide-line">
            {AUDITOR_FAQ.map((item, i) => (
              <div key={item.q}>
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                  <span className="text-[12.5px] font-medium">{item.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-ink/35 transition ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && <p className="pb-3 text-[12px] leading-relaxed text-ink/60">{item.a}</p>}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Suggested audit sequence" description="A defensible order for a review." />
            <ol className="mt-3 space-y-2.5">
              {[
                'Confirm the eligibility root for the election under review.',
                'Check ballot integrity: commitments, vector lengths and nullifier parity.',
                'Re-verify a sample of live proofs against the circuit verification key.',
                'Verify the full chain, then inspect validator signatures on recent blocks.',
                'Export the CSV and PDF report and archive them with your findings.',
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5 text-[12px] leading-relaxed text-ink/60">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-ink/50">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>

          <Callout tone="blue" icon={<BookOpen className="h-4 w-4" />} title="Scope of this deployment">
            The consortium runs as five simulated nodes in one process, and the tally key is held server-side. Both
            limitations are documented in the project report and should be stated in any review of this prototype.
          </Callout>
        </div>
      </div>
    </div>
  );
}
