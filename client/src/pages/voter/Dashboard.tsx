import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Fingerprint,
  History,
  ShieldCheck,
  Vote,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  LoadingBlock,
  SectionHeading,
  StatusBadge,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { useAuth } from '../../lib/auth';
import { formatDate, formatNumber, relativeTime, timeRemaining } from '../../lib/format';

interface VoterDashboardData {
  voter: { name: string; voterNumber: string; email: string; faculty: string; verified: boolean };
  eligibleElections: number;
  votesSubmitted: number;
  accountStatus: string;
  elections: {
    electionId: string;
    name: string;
    description: string;
    status: string;
    startDate: string;
    endDate: string;
    candidateCount: number;
    registeredVoters: number;
    hasVoted: boolean;
    endsInMs: number;
  }[];
  activity: { action: string; detail: string; createdAt: string }[];
}

const ACTION_LABEL: Record<string, string> = {
  BALLOT_SUBMITTED: 'Ballot submitted',
  ZKP_REJECTED: 'Proof rejected',
  PROFILE_UPDATED: 'Profile updated',
  SESSIONS_REVOKED: 'Sessions revoked',
  LOGIN_SUCCESS: 'Signed in',
};

export default function VoterDashboard() {
  const { data, loading } = useApi<VoterDashboardData>('/api/voter/dashboard');
  const { user } = useAuth();
  const firstName = (data?.voter.name ?? user?.name ?? 'Voter').split(' ')[0];

  const live = (data?.elections ?? []).filter((e) => e.status === 'LIVE' && e.endsInMs > 0);
  const pending = live.filter((e) => !e.hasVoted);
  const closed = (data?.elections ?? []).filter((e) => ['COMPLETED', 'CLOSED', 'TALLYING'].includes(e.status));

  return (
    <div className="space-y-6">
      <div className="surface-card relative overflow-hidden p-6 md:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <p className="text-[12px] font-medium text-ink/45">Voter workspace</p>
            <h1 className="mt-4 text-[30px] font-extrabold leading-[1.08] md:text-[34px]">
              Good to see you, {firstName}.
            </h1>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink/60">
              {pending.length > 0
                ? `You have ${pending.length} open ${pending.length === 1 ? 'election' : 'elections'} awaiting your ballot.`
                : 'You are up to date — every open election you are eligible for has a recorded ballot.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button to="/voter/elections" variant="lime">
                <Vote className="h-4 w-4" /> {pending.length > 0 ? 'Cast your ballot' : 'View elections'}
              </Button>
              <Button to="/voter/history" variant="outline">
                <History className="h-4 w-4" /> Voting history
              </Button>
            </div>
          </div>

          <div className="w-full max-w-[260px] rounded-xl border border-line bg-white/80 p-4">
            <div className="flex items-center justify-between">
              <p className="stat-label">Identity status</p>
              <Badge tone={data?.voter.verified ? 'lime' : 'danger'}>{data?.voter.verified ? 'Verified' : 'Pending'}</Badge>
            </div>
            <p className="mt-2 text-[13px] font-semibold">{data?.voter.name ?? '—'}</p>
            <p className="text-[11px] text-ink/45">{data?.voter.voterNumber ?? '—'}</p>
            <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[11.5px] text-ink/55">
              <p className="flex items-center justify-between">
                <span>Faculty</span>
                <span className="font-medium text-ink">{data?.voter.faculty ?? '—'}</span>
              </p>
              <p className="flex items-center justify-between">
                <span>Budgets cast</span>
                <span className="font-medium text-ink">{formatNumber(data?.votesSubmitted ?? 0)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Eligible elections', String(data?.eligibleElections ?? 0), <CalendarDays key="c" className="h-4 w-4" />],
          ['Ballots submitted', String(data?.votesSubmitted ?? 0), <CheckCircle2 key="v" className="h-4 w-4" />],
          ['Awaiting your vote', String(pending.length), <Clock key="p" className="h-4 w-4" />],
          ['Account status', data?.accountStatus === 'ELIGIBLE' ? 'Eligible' : 'Under review', <BadgeCheck key="s" className="h-4 w-4" />],
        ].map(([label, value, icon]) => (
          <div key={label as string} className="surface-card flex items-start justify-between gap-3 p-4">
            <div>
              <p className="stat-label">{label as string}</p>
              <p className="mt-1.5 font-display text-[22px] font-bold leading-none">{value as string}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-ink/50">
              {icon as any}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 pt-5">
            <SectionHeading title="Open elections" description="Elections you are eligible to vote in right now." />
            <Link to="/voter/elections" className="link-quiet">
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-line">
            {loading && (
              <div className="p-5">
                <LoadingBlock rows={3} />
              </div>
            )}
            {!loading && live.length === 0 && (
              <div className="p-5">
                <EmptyState
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="No elections are open"
                  description="New elections will appear here as soon as the administrator opens voting."
                />
              </div>
            )}
            {live.map((e) => (
              <div key={e.electionId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{e.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink/45">
                    {e.candidateCount} candidates · {formatNumber(e.registeredVoters)} registered · closes in{' '}
                    {timeRemaining(e.endsInMs)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.hasVoted ? 'VERIFIED' : 'LIVE'} />
                  {e.hasVoted ? (
                    <span className="text-[11.5px] text-ink/45">Ballot recorded</span>
                  ) : (
                    <Button to={`/voter/elections/${e.electionId}`} size="sm" variant="lime">
                      Vote <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading title="Recent activity" description="Security-relevant events on your account." />
          <div className="mt-4 space-y-2">
            {(data?.activity ?? []).map((a, i) => (
              <div key={i} className="rounded-lg border border-line px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-medium">{ACTION_LABEL[a.action] ?? a.action.replace(/_/g, ' ').toLowerCase()}</p>
                  <span className="text-[10px] text-ink/35">{relativeTime(a.createdAt)}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-ink/45">{a.detail}</p>
              </div>
            ))}
            {!loading && (data?.activity ?? []).length === 0 && (
              <p className="text-[12px] text-ink/50">No activity recorded yet.</p>
            )}
          </div>
        </Card>
      </div>

      {closed.length > 0 && (
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 pt-5">
            <SectionHeading title="Recently closed" description="Results become visible once the tally is published." />
            <Link to="/voter/results" className="link-quiet">
              Results
            </Link>
          </div>
          <div className="mt-3 divide-y divide-line">
            {closed.slice(0, 3).map((e) => (
              <div key={e.electionId} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-[12.5px] font-medium">{e.name}</p>
                  <p className="text-[10.5px] text-ink/40">
                    {formatDate(e.startDate)} – {formatDate(e.endDate)}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Callout tone="blue" icon={<Fingerprint className="h-4 w-4" />} title="Your ballot is private by construction">
        The proof you submit demonstrates that you are an eligible voter without revealing which one. Your encrypted
        selection is never stored next to your identity, and it is only decrypted as part of the aggregate tally.
      </Callout>

      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink/45">
        <ShieldCheck className="h-3.5 w-3.5 text-[#4c6b10]" />
        Session protected by an HttpOnly cookie · proofs generated locally in your browser
      </div>
    </div>
  );
}
