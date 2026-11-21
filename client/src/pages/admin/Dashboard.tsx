import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  Plus,
  ShieldCheck,
  Users,
  Vote,
} from 'lucide-react';
import { Badge, Button, Card, LoadingBlock, PageHeader, SectionHeading, StatCard, StatusBadge } from '../../components/ui';
import { DonutChart, ParticipationBars, ParticipationChart } from '../../components/Charts';
import { ValidatorNetwork } from '../../components/ValidatorNetwork';
import { useApi } from '../../lib/useApi';
import { formatDate, formatNumber, formatPercent, formatTime, shortHash } from '../../lib/format';

interface AdminDashboardData {
  registeredVoters: number;
  totalElections: number;
  verifiedBallots: number;
  activeValidators: number;
  totalValidators: number;
  participationRate: number;
  remainingEligibleVoters: number;
  ledgerIntegrity: string;
  ledgerBlocks: number;
  dailyParticipation: { date: string; ballots: number; cumulative: number }[];
  validators: { validatorId: string; name: string; active: boolean }[];
  recentTransactions: { txHash: string; type: string; blockNumber: number | null; timestamp: string; status: string }[];
  recentActivity: { action: string; detail: string; actorRole: string; createdAt: string }[];
  elections: {
    id: string;
    electionId: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    registeredVoters: number;
    votesCast: number;
    candidates: number;
  }[];
}

const RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All time', days: 0 },
];

const TX_LABEL: Record<string, string> = {
  BALLOT_ACCEPTED: 'Ballot transaction recorded',
  ZKP_VERIFIED: 'Zero-knowledge proof verified',
  CONSENSUS_ACHIEVED: 'Validator consensus achieved',
  ELECTION_CREATED: 'Election configuration updated',
  VOTER_ROOT_PUBLISHED: 'Voter eligibility root published',
  ELECTION_CLOSED: 'Election state updated',
  AGGREGATE_TALLY_PUBLISHED: 'Aggregate tally published',
};

export default function AdminDashboard() {
  const { data, loading } = useApi<AdminDashboardData>('/api/admin/dashboard');
  const [range, setRange] = useState(1);

  const chart = useMemo(() => {
    const series = data?.dailyParticipation ?? [];
    const days = RANGES[range].days;
    const trimmed = days === 0 ? series : series.slice(-days);
    return trimmed.map((d) => ({
      label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      value: d.ballots,
    }));
  }, [data, range]);

  const activeElections = (data?.elections ?? []).filter((e) => ['LIVE', 'COMPLETED', 'CLOSED', 'TALLYING'].includes(e.status)).slice(0, 4);

  const participationByElection = (data?.elections ?? [])
    .map((e) => ({
      label: e.electionId,
      name: e.name,
      participation: e.registeredVoters ? Math.round((e.votesCast / e.registeredVoters) * 1000) / 10 : 0,
      cast: e.votesCast,
      eligible: e.registeredVoters,
    }))
    .sort((a, b) => b.participation - a.participation);

  const statusData = Object.entries(
    (data?.elections ?? []).reduce<Record<string, number>>((acc, election) => {
      acc[election.status] = (acc[election.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, value]) => ({
    label,
    value,
    color:
      label === 'LIVE' ? '#C6F65A' : label === 'COMPLETED' ? '#2049CC' : label === 'SCHEDULED' ? '#B9BDB4' : '#DDE4D5',
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Election Overview"
        description="Monitor elections, voter participation and blockchain network integrity from one secure workspace."
        actions={
          <>
            <span className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-white px-3 text-[12.5px] text-ink/60 md:inline-flex">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <Button to="/admin/elections/create" variant="lime">
              <Plus className="h-4 w-4" /> Create Election
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Voter commitments"
          value={formatNumber(data?.registeredVoters ?? 0)}
          hint="Eligibility commitments across all election rosters"
          icon={<Users className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Total elections"
          value={String(data?.totalElections ?? 0).padStart(2, '0')}
          hint={`${data?.elections.filter((e) => e.status === 'LIVE').length ?? 0} currently active`}
          icon={<CalendarDays className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Verified ballots"
          value={formatNumber(data?.verifiedBallots ?? 0)}
          hint="100% cryptographically verified"
          icon={<ShieldCheck className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Blockchain validators"
          value={String(data?.activeValidators ?? 0).padStart(2, '0')}
          hint="Consensus identities"
          icon={<Boxes className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeading title="Voter Participation" description="Voting activity across active elections." />
            <div className="flex rounded-lg border border-line bg-surface p-0.5">
              {RANGES.map((r, i) => (
                <button
                  key={r.label}
                  onClick={() => setRange(i)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${
                    range === i ? 'bg-white text-ink shadow-sm' : 'text-ink/50 hover:text-ink'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_150px]">
            <div className="min-w-0">
              {loading ? <LoadingBlock rows={4} /> : <ParticipationChart data={chart.length ? chart : [{ label: '—', value: 0 }]} height={230} />}
            </div>
            <div className="space-y-4 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <div>
                <p className="stat-label">Total votes cast</p>
                <p className="mt-1 font-display text-[24px] font-bold leading-none">{formatNumber(data?.verifiedBallots ?? 0)}</p>
              </div>
              <div>
                <p className="stat-label">Participation rate</p>
                <p className="mt-1 font-display text-[24px] font-bold leading-none">{formatPercent(data?.participationRate ?? 0)}</p>
              </div>
              <div>
                <p className="stat-label">Remaining eligible</p>
                <p className="mt-1 font-display text-[24px] font-bold leading-none">{formatNumber(data?.remainingEligibleVoters ?? 0)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card padded={false} className="min-w-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <SectionHeading title="Active Elections" description="Elections requiring attention." />
            <Link to="/admin/elections" className="link-quiet">
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Election</th>
                  <th className="text-right">Registered</th>
                  <th className="text-right">Votes</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5}>
                      <LoadingBlock rows={3} />
                    </td>
                  </tr>
                )}
                {activeElections.map((e) => (
                  <tr key={e.electionId}>
                    <td>
                      <p className="max-w-[190px] text-[12.5px] font-medium leading-snug">{e.name}</p>
                      <p className="text-[10.5px] text-ink/40">{e.electionId}</p>
                    </td>
                    <td className="text-right tabular-nums text-ink/70">{formatNumber(e.registeredVoters)}</td>
                    <td className="text-right tabular-nums text-ink/70">{formatNumber(e.votesCast)}</td>
                    <td>
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/admin/elections/${e.electionId}`}
                        className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium hover:bg-surface"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="min-w-0">
          <SectionHeading
            title="Participation by election"
            description="Ballots accepted against eligible commitments for every election in the dataset."
          />
          <div className="mt-3">
            {loading ? (
              <LoadingBlock rows={4} />
            ) : participationByElection.length ? (
              <ParticipationBars data={participationByElection} height={272} />
            ) : (
              <p className="py-6 text-[12px] text-ink/45">No elections have been configured yet.</p>
            )}
          </div>
        </Card>
        <Card>
          <SectionHeading title="Election status" description="Lifecycle distribution across the current dataset." />
          <div className="mt-3">
            {loading ? (
              <LoadingBlock rows={3} />
            ) : (
              <DonutChart
                data={statusData}
                centerValue={String(data?.totalElections ?? statusData.reduce((sum, row) => sum + row.value, 0))}
                centerLabel="elections"
              />
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-ink/40">
              Counts are derived from the election records returned by <span className="mono">/api/admin/dashboard</span>.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <SectionHeading title="Consortium Network" description="Five validator identities participate in quorum consensus." />
          <div className="mt-2 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
            <ValidatorNetwork validators={data?.validators ?? []} height={210} />
            <div className="space-y-4 sm:border-l sm:border-line sm:pl-4">
              <div>
                <p className="stat-label">Network status</p>
                <div className="mt-1.5">
                  <Badge tone={data?.ledgerIntegrity === 'VALID' ? 'lime' : 'danger'}>{data?.ledgerIntegrity === 'VALID' ? 'Healthy' : 'Degraded'}</Badge>
                </div>
              </div>
              <div>
                <p className="stat-label">Active validators</p>
                <p className="mt-1 font-display text-[19px] font-bold">
                  {String(data?.activeValidators ?? 0).padStart(2, '0')} / {String(data?.totalValidators ?? 0).padStart(2, '0')}
                </p>
              </div>
              <div>
                <p className="stat-label">Consensus status</p>
                <div className="mt-1.5">
                  <Badge tone="lime">Achieved</Badge>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-ink/45">
                Quorum requires 4 of 5 validator signatures over each block hash.
              </p>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between px-5 pt-5">
            <SectionHeading title="Recent Blockchain Activity" description="Latest committed transactions." />
            <Link to="/admin/ledger" className="link-quiet">
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-line">
            {(data?.recentTransactions ?? []).slice(0, 5).map((tx) => (
              <div key={tx.txHash} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface">
                    <Vote className="h-3 w-3 text-ink/45" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium">{TX_LABEL[tx.type] ?? tx.type.replace(/_/g, ' ').toLowerCase()}</p>
                    <p className="mono text-[10.5px] text-ink/40">
                      Tx: {shortHash(tx.txHash, 6, 4)} · Block #{tx.blockNumber} · {formatTime(tx.timestamp)}
                    </p>
                  </div>
                </div>
                <Badge tone="lime" dot={false}>
                  <ShieldCheck className="h-3 w-3" /> Verified
                </Badge>
              </div>
            ))}
            {!loading && (data?.recentTransactions ?? []).length === 0 && (
              <p className="px-5 py-6 text-[12.5px] text-ink/50">No transactions recorded yet.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading title="Recent administration activity" description="The six most recent auditable events." />
          <Link to="/admin/audit-logs" className="link-quiet inline-flex items-center gap-1">
            Audit logs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(data?.recentActivity ?? []).map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5">
              <div>
                <p className="text-[12px] font-medium">{a.action.replace(/_/g, ' ').toLowerCase()}</p>
                <p className="mt-0.5 text-[11px] text-ink/45">{a.detail}</p>
              </div>
              <div className="shrink-0 text-right">
                <Badge tone="outline" dot={false}>{a.actorRole}</Badge>
                <p className="mt-1 text-[10px] text-ink/35">{formatDate(a.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
