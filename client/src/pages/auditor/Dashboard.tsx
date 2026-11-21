import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Layers,
  Network,
  ShieldCheck,
  ShieldX,
  Vote,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  StatCard,
  StatusBadge,
  useToast,
} from '../../components/ui';
import { DonutChart, ParticipationChart } from '../../components/Charts';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { formatDateTime, formatNumber, formatPercent, relativeTime } from '../../lib/format';

interface AuditorDashboardData {
  registeredVoters: number;
  verifiedBallots: number;
  verifiedProofs: number;
  rejectedProofs: number;
  totalValidators: number;
  activeValidators: number;
  participationRate: number;
  ledgerIntegrity: string;
  ledgerBlocks: number;
  dailyParticipation: { date: string; ballots: number; cumulative: number }[];
  ledger: { valid: boolean; blocks: number; transactions: number; signaturesChecked: number; errors: string[]; checkedAt: string };
  proofBreakdown: Record<string, number>;
  electionSummaries: {
    electionId: string;
    name: string;
    status: string;
    registeredVoters: number;
    ballots: number;
    proofs: number;
    tallyPublished: boolean;
  }[];
  recentActivity: { action: string; detail: string; createdAt: string }[];
  circuit: { name: string; depth: number; protocol: string; curve: string; artifactsReady: boolean };
}

export default function AuditorDashboard() {
  const { data, loading, refetch } = useApi<AuditorDashboardData>('/api/auditor/dashboard');
  const { push } = useToast();
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const result = await api.post<{ valid: boolean; blocks: number; transactions: number; signaturesChecked: number }>(
        '/api/auditor/ledger/verify',
      );
      push({
        title: result.valid ? 'Independent verification passed' : 'Integrity failure',
        description: `${formatNumber(result.blocks)} blocks · ${formatNumber(result.transactions)} transactions · ${formatNumber(
          result.signaturesChecked,
        )} signatures`,
        tone: result.valid ? 'success' : 'error',
      });
      await refetch();
    } catch (err: any) {
      push({ title: 'Verification failed', description: err?.message, tone: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const chart = (data?.dailyParticipation ?? []).slice(-14).map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    value: d.ballots,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Overview"
        description="Independent, read-only verification of ballots, proofs, consensus and the append-only ledger."
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline" dot={false}>
              Auditor ID AUD-2026-001
            </Badge>
            <Badge tone="lime">Read-only access</Badge>
          </div>
        }
        actions={
          <Button variant="lime" loading={verifying} onClick={verify}>
            <ShieldCheck className="h-4 w-4" /> Run ledger verification
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Voter commitments"
          value={formatNumber(data?.registeredVoters ?? 0)}
          hint="Eligibility commitments across all election rosters"
          icon={<Network className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Verified ballots"
          value={formatNumber(data?.verifiedBallots ?? 0)}
          hint={`${formatPercent(data?.participationRate ?? 0)} turnout`}
          icon={<Vote className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Verified proofs"
          value={formatNumber(data?.verifiedProofs ?? 0)}
          hint={`${formatNumber(data?.rejectedProofs ?? 0)} rejected`}
          icon={<Fingerprint className="h-4 w-4" />}
          tone="lime"
          loading={loading}
        />
        <StatCard
          label="Ledger blocks"
          value={formatNumber(data?.ledgerBlocks ?? 0)}
          hint={data?.ledgerIntegrity === 'VALID' ? 'Chain integrity: valid' : 'Chain integrity: failed'}
          icon={<Layers className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            title="Ledger integrity report"
            description="Recomputed on the server from genesis: every hash link, Merkle root and validator signature."
          />
          <Badge tone={data?.ledger.valid ? 'lime' : 'danger'}>
            {data?.ledger.valid ? 'VALID' : 'FAILED'}
          </Badge>
        </div>

        {loading || !data ? (
          <div className="mt-4">
            <LoadingBlock rows={2} />
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ['Blocks verified', formatNumber(data.ledger.blocks)],
                ['Transactions', formatNumber(data.ledger.transactions)],
                ['Signatures checked', formatNumber(data.ledger.signaturesChecked)],
                ['Checked at', formatDateTime(data.ledger.checkedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line px-3.5 py-3">
                  <p className="stat-label">{label}</p>
                  <p className="mt-1 text-[13px] font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Callout
                tone={data.ledger.valid ? 'lime' : 'danger'}
                icon={data.ledger.valid ? <CheckCircle2 className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
              >
                {data.ledger.valid
                  ? 'Every block hash matched its canonical header, every signature was valid Ed25519 over that hash, and each previous-hash link was intact.'
                  : data.ledger.errors.join(' · ')}
              </Callout>
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <SectionHeading title="Ballot volume" description="Daily accepted ballots over the last 14 days." />
          <div className="mt-4">
            {loading ? <LoadingBlock rows={3} /> : <ParticipationChart data={chart.length ? chart : [{ label: '—', value: 0 }]} height={220} />}
          </div>
        </Card>

        <Card>
          <SectionHeading title="Zero-knowledge proofs" description="Verification outcome distribution." />
          <div className="mt-4">
            <DonutChart
              data={Object.entries(data?.proofBreakdown ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => ({
                  label: status,
                  value: count,
                  color: status === 'VERIFIED' ? '#C6F65A' : status === 'REJECTED' ? '#B42318' : '#DDE4D5',
                }))}
              centerValue={formatNumber(
                Object.values(data?.proofBreakdown ?? {}).reduce((sum, count) => sum + count, 0),
              )}
              centerLabel="proof records"
            />
          </div>
          <div className="mt-4 rounded-xl border border-line bg-canvas p-3.5">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-ink/40" />
              <p className="text-[11.5px] font-semibold">
                {data?.circuit.name}.circom · {data?.circuit.protocol.toUpperCase()} · {data?.circuit.curve}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-ink/45">
              Depth {data?.circuit.depth} Poseidon tree · {data?.circuit.artifactsReady ? 'artifacts present' : 'artifacts missing'}
            </p>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex items-center justify-between px-5 pt-5">
          <SectionHeading title="Election audit status" description="Ballot, proof and tally coverage per election." />
          <Link to="/auditor/elections" className="link-quiet">
            Open audits
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Election</th>
                <th>Status</th>
                <th className="text-right">Registered</th>
                <th className="text-right">Ballots</th>
                <th className="text-right">Proofs</th>
                <th>Tally</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6}>
                    <LoadingBlock rows={4} />
                  </td>
                </tr>
              )}
              {(data?.electionSummaries ?? []).map((e) => (
                <tr key={e.electionId}>
                  <td>
                    <p className="text-[12.5px] font-medium">{e.name}</p>
                    <p className="text-[10.5px] text-ink/40">{e.electionId}</p>
                  </td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(e.registeredVoters)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(e.ballots)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(e.proofs)}</td>
                  <td>
                    <Badge tone={e.tallyPublished ? 'lime' : 'neutral'}>{e.tallyPublished ? 'Published' : 'Pending'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeading title="Audit trail" description="Most recent system events." />
          <div className="mt-4 space-y-2">
            {(data?.recentActivity ?? []).map((a, i) => (
              <div key={i} className="rounded-lg border border-line px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="mono text-[10.5px] font-medium text-ink/65">{a.action}</p>
                  <span className="text-[10px] text-ink/35">{relativeTime(a.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink/50">{a.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading title="Auditor capabilities" description="What this role can and cannot do." />
          <div className="mt-4 space-y-2">
            {[
              ['Inspect', 'Election metadata, eligibility roots and published tallies'],
              ['Verify', 'Groth16 proofs, block signatures and full-chain integrity'],
              ['Export', 'CSV and PDF audit reports generated from live data'],
              ['Restricted', 'No election changes, no ballot access, no voter identity disclosure'],
            ].map(([label, detail]) => (
              <div key={label} className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
                {label === 'Restricted' ? (
                  <ShieldX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                ) : (
                  <BookOpenCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c6b10]" />
                )}
                <div>
                  <p className="text-[12px] font-semibold">{label}</p>
                  <p className="text-[11px] leading-relaxed text-ink/55">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-ink/45">
            <Activity className="h-3.5 w-3.5" /> Every verification you run is written to the audit log.
          </div>
        </Card>
      </div>
    </div>
  );
}
