import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  Search,
  ShieldCheck,
  Users,
  Vote,
} from 'lucide-react';
import {
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
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { formatDate, formatDateTime, formatNumber, timeRemaining } from '../../lib/format';

interface VoterElection {
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
}

export function VoterElections() {
  const { data, loading } = useApi<VoterElection[]>('/api/voter/elections');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('OPEN');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      const matchesQuery = !q || e.name.toLowerCase().includes(q) || e.electionId.toLowerCase().includes(q);
      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'OPEN' && e.status === 'LIVE' && e.endsInMs > 0) ||
        (filter === 'VOTED' && e.hasVoted) ||
        (filter === 'CLOSED' && ['COMPLETED', 'CLOSED', 'TALLYING'].includes(e.status));
      return matchesQuery && matchesFilter;
    });
  }, [data, query, filter]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Available Elections"
        description="Only elections where your commitment is present in the published Merkle root appear here."
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search elections"
                className="h-10 w-[240px] rounded-xl border border-line bg-white pl-9 pr-3 text-[12.5px] focus:outline-none"
              />
            </div>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 w-[160px] text-[12.5px]">
              <option value="OPEN">Open now</option>
              <option value="VOTED">Voted</option>
              <option value="CLOSED">Closed</option>
              <option value="ALL">All elections</option>
            </Select>
          </>
        }
      />

      {loading && <LoadingBlock rows={4} />}

      {!loading && rows.length === 0 && (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nothing to show here"
          description="No elections match this filter. Try switching to all elections."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((e) => {
          const open = e.status === 'LIVE' && e.endsInMs > 0;
          return (
            <Card key={e.electionId} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <StatusBadge status={e.status} />
                  <h3 className="mt-2.5 text-[15.5px] font-semibold leading-snug">{e.name}</h3>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink/55">{e.description}</p>
                </div>
                {e.hasVoted && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-soft text-[#4c6b10]">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg border border-line px-2.5 py-2">
                  <p className="text-[11px] text-ink/40">Candidates</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{e.candidateCount}</p>
                </div>
                <div className="rounded-lg border border-line px-2.5 py-2">
                  <p className="text-[11px] text-ink/40">Registered</p>
                  <p className="mt-0.5 font-semibold tabular-nums">{formatNumber(e.registeredVoters)}</p>
                </div>
                <div className="rounded-lg border border-line px-2.5 py-2">
                  <p className="text-[11px] text-ink/40">Closes</p>
                  <p className="mt-0.5 font-semibold">{open ? timeRemaining(e.endsInMs) : formatDate(e.endDate)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="text-[11px] text-ink/40">
                  {formatDate(e.startDate)} – {formatDate(e.endDate)}
                </span>
                {e.hasVoted ? (
                  <Badge tone="lime">Ballot recorded</Badge>
                ) : open ? (
                  <Button to={`/voter/elections/${e.electionId}`} size="sm" variant="lime">
                    Open ballot <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button to={`/voter/elections/${e.electionId}`} size="sm" variant="outline">
                    Details
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface BallotElection {
  electionId: string;
  name: string;
  description: string;
  status: string;
  rules: string;
  maxSelections: number;
  startDate: string;
  endDate: string;
  merkleRoot: string | null;
  leafIndex: number;
  hasVoted: boolean;
  isOpen: boolean;
  candidates: { candidateId: string; name: string; position: string; slogan: string; index: number }[];
}

export function VoterElectionDetail() {
  const { electionId } = useParams();
  const { data, loading, error } = useApi<BallotElection>(`/api/voter/elections/${electionId}`);

  if (loading) return <LoadingBlock rows={5} />;
  if (error || !data) {
    return (
      <Card>
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Election unavailable"
          description={error ?? 'You are not eligible for this election.'}
          action={
            <Button to="/voter/elections" variant="outline" size="sm">
              Back to elections
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/voter/elections" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/55 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All elections
      </Link>

      <PageHeader
        title={data.name}
        description={data.description}
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} />
            <span className="text-[11.5px] text-ink/45">{data.electionId}</span>
          </div>
        }
        actions={
          data.hasVoted ? (
            <Button to="/voter/history" variant="outline">
              <CheckCircle2 className="h-4 w-4" /> View receipt
            </Button>
          ) : data.isOpen ? (
            <Button to={`/voter/elections/${data.electionId}/vote`} variant="lime">
              <Vote className="h-4 w-4" /> Cast ballot
            </Button>
          ) : undefined
        }
      />

      {data.hasVoted && (
        <Callout tone="lime" icon={<CheckCircle2 className="h-4 w-4" />} title="Your ballot for this election is recorded">
          A ballot bound to your credential already exists in the ledger. One ballot per voter is enforced by a single-use
          nullifier, so the ballot cannot be submitted again.
        </Callout>
      )}

      {!data.hasVoted && !data.isOpen && (
        <Callout tone="neutral" icon={<Clock className="h-4 w-4" />} title="Voting is not open">
          {data.status === 'SCHEDULED'
            ? `This election opens on ${formatDateTime(data.startDate)}.`
            : 'The voting window for this election has closed.'}
        </Callout>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Voting rules', data.rules],
          ['Selections allowed', `${data.maxSelections}`],
          ['Your leaf index', data.leafIndex != null ? `#${data.leafIndex}` : '—'],
          ['Closes', formatDate(data.endDate)],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 text-[13px] font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <Card>
        <SectionHeading title="Candidates" description="Review the full list before you open the ballot." />
        <div className="mt-4 divide-y divide-line">
          {data.candidates.map((c) => (
            <div key={c.candidateId} className="flex items-start gap-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10.5px] font-semibold text-ink/50">
                {String(c.index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-[13px] font-medium">{c.name}</p>
                <p className="text-[11px] text-ink/45">{c.position}</p>
                {c.slogan && <p className="mt-0.5 text-[11.5px] italic text-ink/40">“{c.slogan}”</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading title="What happens when you submit" description="Four cryptographic steps run before your ballot is recorded." />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ['Proof', 'Your browser proves eligibility against the published Merkle root.'],
            ['Encryption', 'Your selection is encrypted locally with the election public key.'],
            ['Consensus', 'Four of five validators sign the block containing your ballot.'],
            ['Receipt', 'You receive a receipt code and the block number it was committed in.'],
          ].map(([title, detail], i) => (
            <div key={title} className="rounded-xl border border-line p-3">
              <p className="font-mono text-[11px] text-ink/35">0{i + 1}</p>
              <p className="mt-1 text-[12px] font-semibold">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink/50">{detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11.5px] text-ink/45">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {formatNumber(data.candidates.length)} candidates on the ballot
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Single-use nullifier prevents a second ballot
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" /> Your selection is never stored with your identity
          </span>
        </div>
      </Card>
    </div>
  );
}
