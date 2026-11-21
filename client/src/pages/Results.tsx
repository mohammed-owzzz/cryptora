import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
import { PublicShell } from '../components/Layout';
import { Badge, Card, EmptyState, LoadingBlock, StatusBadge } from '../components/ui';
import { VoteTallyBar } from '../components/ValidatorNetwork';
import { useApi } from '../lib/useApi';
import { formatDate, formatNumber, formatPercent, shortHash } from '../lib/format';

interface PublicElection {
  electionId: string;
  name: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  registeredVoters: number;
  votesCast: number;
  participation: number;
  merkleRoot: string | null;
  candidates: { candidateId: string; name: string; position: string }[];
  results: { candidateId: string; name: string; votes: number }[] | null;
}

export default function Results() {
  const { data, loading } = useApi<PublicElection[]>('/api/public/elections');
  const [params, setParams] = useSearchParams();
  const selected = params.get('election');
  const [active, setActive] = useState<string | null>(selected);

  useEffect(() => {
    if (selected) setActive(selected);
    else if (data?.length && !active) setActive(data[0].electionId);
  }, [selected, data, active]);

  const election = data?.find((e) => e.electionId === active) ?? data?.[0];
  const totalVotes = election?.results?.reduce((s, r) => s + r.votes, 0) ?? 0;

  return (
    <PublicShell>
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1240px] px-5 py-14 lg:px-8">
          <span className="eyebrow">
            Public results
          </span>
          <h1 className="mt-5 max-w-[760px] text-[42px] font-extrabold leading-[1.04] md:text-[50px]">
            Election outcomes, published as aggregates only.
          </h1>
          <p className="mt-4 max-w-[620px] text-[14.5px] leading-relaxed text-ink/60">
            Only elections in a closed state publish totals. Individual ballots remain encrypted and unlinkable to any
            voter, and live elections publish participation only.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1240px] gap-6 px-5 py-10 lg:grid-cols-[280px_1fr] lg:px-8">
        <div className="space-y-1.5">
          <p className="stat-label mb-2">Elections</p>
          {loading ? (
            <LoadingBlock rows={6} />
          ) : (
            (data ?? []).map((e) => (
              <button
                key={e.electionId}
                onClick={() => {
                  setActive(e.electionId);
                  setParams({ election: e.electionId });
                }}
                className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                  active === e.electionId ? 'border-ink/15 bg-white shadow-card' : 'border-transparent hover:bg-white/70'
                }`}
              >
                <p className="text-[12.5px] font-medium leading-snug">{e.name}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10.5px] text-ink/40">{e.electionId}</span>
                  <StatusBadge status={e.status} />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4">
          {!election && !loading && (
            <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No elections published" description="Elections will appear here once they are scheduled." />
          )}

          {election && (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[22px] font-bold leading-tight">{election.name}</h2>
                      <StatusBadge status={election.status} />
                    </div>
                    <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-ink/55">{election.description}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-4">
                  <Metric label="Registered voters" value={formatNumber(election.registeredVoters)} />
                  <Metric label="Valid ballots" value={formatNumber(election.votesCast)} />
                  <Metric label="Participation" value={formatPercent(election.participation)} />
                  <Metric label="Voting period" value={`${formatDate(election.startDate)} – ${formatDate(election.endDate)}`} small />
                </div>
              </Card>

              {election.results && election.results.length > 0 ? (
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[16px] font-semibold">Aggregate results</h3>
                      <p className="mt-0.5 text-[12px] text-ink/50">
                        Homomorphically aggregated from {formatNumber(election.votesCast)} encrypted ballots
                      </p>
                    </div>
                    <Badge tone="lime">
                      <ShieldCheck className="h-3 w-3" /> Verified tally
                    </Badge>
                  </div>
                  <div className="mt-5 space-y-4">
                    {election.results.map((r, i) => (
                      <VoteTallyBar
                        key={r.candidateId}
                        name={r.name}
                        votes={r.votes}
                        share={totalVotes ? (r.votes / totalVotes) * 100 : 0}
                        winner={i === 0 && r.votes > 0}
                      />
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3">
                    <div>
                      <p className="text-[11.5px] font-medium text-ink/45">Eligibility Merkle root</p>
                      <p className="mono mt-1 text-ink/60">{shortHash(election.merkleRoot, 22, 10)}</p>
                    </div>
                    <p className="text-[11.5px] text-ink/45">Total published votes: {formatNumber(totalVotes)}</p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface">
                      <Lock className="h-5 w-5 text-ink/40" />
                    </span>
                    <p className="mt-4 text-[14px] font-semibold">
                      {election.status === 'LIVE' ? 'Results are sealed while voting is open' : 'Results have not been published yet'}
                    </p>
                    <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink/55">
                      {election.status === 'LIVE'
                        ? 'Once this election closes, encrypted ballots are aggregated homomorphically and only candidate totals are published.'
                        : 'The administrator has not yet closed and tallied this election.'}
                    </p>
                    <p className="mt-4 text-[12px] text-ink/45">
                      Current participation: <span className="font-semibold text-ink/70">{formatNumber(election.votesCast)}</span> ballots
                    </p>
                  </div>
                </Card>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-[12px] text-ink/50">
                  {election.candidates?.length ?? 0} candidates · election ledger record available in the auditor console
                </p>
                <a href="/auditor/login" className="link-quiet inline-flex items-center gap-1">
                  Auditor verification <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </PublicShell>
  );
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p className="stat-label">{label}</p>
      <p className={`mt-1 font-semibold ${small ? 'text-[12.5px] leading-snug' : 'font-display text-[20px]'}`}>{value}</p>
    </div>
  );
}
