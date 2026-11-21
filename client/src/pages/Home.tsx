import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { PublicShell } from '../components/Layout';
import { Badge, Button, StatusBadge } from '../components/ui';
import { ParticipationChart } from '../components/Charts';
import { PipelineStrip } from '../components/Diagrams';
import { Reveal } from '../components/Motion';
import { useApi } from '../lib/useApi';
import type { Stats } from '../lib/types';
import { formatNumber, formatPercent, shortHash } from '../lib/format';

const STEPS = [
  {
    title: 'Authenticate',
    body: 'The voter signs in with a voter number and password over an HttpOnly session cookie.',
  },
  {
    title: 'Prove eligibility',
    body: 'A Groth16 proof shows the credential belongs to the published Merkle root. The witness never leaves the browser.',
  },
  {
    title: 'Encrypt the ballot',
    body: 'The selection becomes a one-hot vector, encrypted with the election’s Paillier public key before submission.',
  },
  {
    title: 'Reach consensus',
    body: 'Validators re-check the transaction independently. Four of five signatures commit the block.',
  },
];

const PORTAILS = [
  {
    role: 'Administrator',
    to: '/admin/login',
    body: 'Configure elections, register voters, publish the eligibility root and run the consortium ledger.',
  },
  {
    role: 'Voter',
    to: '/voter/login',
    body: 'Open the ballot, generate an eligibility proof locally and submit an encrypted selection.',
  },
  {
    role: 'Auditor',
    to: '/auditor/login',
    body: 'Re-verify proofs, traverse the chain and read validator signatures without seeing a vote.',
  },
];

export default function Home() {
  const { data: stats } = useApi<Stats>('/api/public/stats');
  const featured = stats?.featuredElections.find((e) => e.status === 'LIVE') ?? stats?.featuredElections[0];
  const trend = (stats?.dailyParticipation ?? []).slice(-10).map((d) => ({
    label: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    value: d.ballots,
  }));

  const systemFacts = [
    ['Registered voter entries', formatNumber(stats?.registeredVoters ?? 0)],
    ['Accepted ballots', formatNumber(stats?.verifiedBallots ?? 0)],
    ['Verified proofs', formatNumber(stats?.verifiedProofs ?? 0)],
    ['Rejected proofs', formatNumber(stats?.rejectedProofs ?? 0)],
    ['Ledger blocks', formatNumber(stats?.ledgerBlocks ?? 0)],
    ['Validator identities', `${stats?.activeValidators ?? 5} of 5`],
  ];

  return (
    <PublicShell>
      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-20">
          <div>
            <p className="eyebrow">Secure digital elections</p>
            <h1 className="mt-5 max-w-[560px] text-[42px] font-bold leading-[1.05] md:text-[54px]">
              A ballot that stays private. A result anyone can verify.
            </h1>
            <p className="mt-5 max-w-[480px] text-[15px] leading-relaxed text-ink/60">
              CRYPTORA combines zero-knowledge eligibility proofs, encrypted ballots and a consortium ledger so that
              elections can be audited without exposing a single vote.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button to="/access" size="lg">
                Sign in to the portal <ArrowRight className="h-4 w-4" />
              </Button>
              <Button to="/how-it-works" variant="outline" size="lg">
                How the ballot works
              </Button>
            </div>
            <p className="mt-7 flex items-center gap-2 text-[12px] text-ink/45">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Academic prototype · figures below come from the seeded demonstration dataset
            </p>
          </div>

          <div className="surface-card overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{featured?.name ?? 'No election published'}</p>
                <p className="mt-0.5 text-[11.5px] text-ink/45">{featured?.electionId ?? '—'}</p>
              </div>
              {featured && <StatusBadge status={featured.status} />}
            </div>

            <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
              {[
                ['Registered', formatNumber(featured?.registeredVoters ?? stats?.registeredVoters ?? 0)],
                ['Ballots cast', formatNumber(featured?.votesCast ?? stats?.verifiedBallots ?? 0)],
                ['Participation', formatPercent(featured?.participation ?? stats?.participationRate ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="px-4 py-4">
                  <p className="text-[11.5px] text-ink/45">{label}</p>
                  <p className="mt-1 font-display text-[19px] font-bold leading-none">{value}</p>
                </div>
              ))}
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="text-[11.5px] font-medium text-ink/50">Daily ballots</p>
                <p className="text-[11px] text-ink/35">Last 10 days</p>
              </div>
              <ParticipationChart data={trend.length ? trend : [{ label: '—', value: 0 }]} height={104} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface/50 px-5 py-3">
              <p className="text-[11.5px] text-ink/50">
                Ledger · {formatNumber(stats?.ledgerBlocks ?? 0)} blocks · {stats?.totalValidators ?? 5} validators
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink/50">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${stats?.ledgerIntegrity === 'VALID' ? 'bg-[#8FD01A]' : 'bg-ink/25'}`}
                  aria-hidden
                />
                {stats?.ledgerIntegrity === 'VALID' ? 'Integrity verified' : 'Not verified'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Three properties, stated once */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1200px] px-5 py-9 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-ink/45">From ballot to ledger</p>
              <p className="mt-1 max-w-[560px] text-[12.5px] leading-relaxed text-ink/55">
                The five stages below run in this build, from an in-browser proof to an aggregate tally.
              </p>
            </div>
            <Link to="/docs/architecture" className="link-quiet">
              Architecture <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Reveal className="mt-4">
            <PipelineStrip />
          </Reveal>
        </div>
      </section>

      <section className="border-b border-line bg-surface/40">
        <div className="mx-auto grid max-w-[1200px] gap-6 px-5 py-8 md:grid-cols-3 md:gap-10 lg:px-8">
          {[
            ['Eligibility without identity', 'A Groth16 proof of Merkle membership replaces the voter list at the ballot box.'],
            ['Ballots encrypted on the device', 'Only Paillier ciphertexts are submitted. The server never stores a candidate choice.'],
            ['Consensus before the record', 'Every transaction is validated and signed by four of five consortium validators.'],
          ].map(([title, body]) => (
            <div key={title}>
              <p className="text-[13px] font-semibold">{title}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/55">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How a ballot is cast */}
      <section className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8 lg:py-24">
        <Reveal className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <h2 className="max-w-[420px] text-[30px] font-bold leading-[1.15] md:text-[36px]">
              Four steps, none of which reveal how you voted.
            </h2>
            <div className="mt-8 divide-y divide-line border-t border-line">
              {STEPS.map((step, i) => (
                <div key={step.title} className="flex gap-5 py-5">
                  <span className="pt-0.5 font-mono text-[12px] text-ink/35">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-[13.5px] font-semibold">{step.title}</p>
                    <p className="mt-1 max-w-[380px] text-[12.5px] leading-relaxed text-ink/55">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/how-it-works" className="link-quiet mt-6">
              Read the full technical walkthrough <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="lg:pt-4">
            <div className="rounded-card border border-line bg-white p-5">
              <p className="text-[12px] font-medium text-ink/45">Eligibility circuit</p>
              <dl className="mt-4 space-y-3 text-[12.5px]">
                {[
                  ['Circuit', 'eligibility.circom'],
                  ['Proving system', 'Groth16 over BN254'],
                  ['Merkle depth', '13 · Poseidon'],
                  ['Public inputs', 'root, electionId, nullifier'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink/45">{k}</dt>
                    <dd className="mono text-right text-ink/70">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 space-y-1.5 rounded-lg bg-surface px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-ink/60">
                <p>leaf = Poseidon(secret)</p>
                <p>root = path(leaf) → published root</p>
                <p>nullifier = Poseidon(secret, electionId)</p>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-ink/50">
                The proof confirms membership and single use. It says nothing about which credential was used, and the
                nullifier cannot be linked across elections.
              </p>
            </div>
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink/45">
              Not claimed: ballot well-formedness inside the circuit, or threshold decryption with distributed trustees.
              Both are documented as limitations.
            </p>
          </div>
        </Reveal>
      </section>

      {/* System state */}
      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-18">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[24px] font-bold leading-tight md:text-[28px]">The demonstration environment</h2>
              <p className="mt-2 max-w-[520px] text-[13px] leading-relaxed text-ink/55">
                Seeded elections, encrypted ballots and a signed ledger are loaded on first start so every workspace
                opens with consistent data.
              </p>
            </div>
            <Link to="/results" className="link-quiet">
              Public results <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6">
              {systemFacts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12px] text-ink/45">{label}</dt>
                  <dd className="mt-1 font-display text-[22px] font-bold leading-none tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <p className="text-[12px] font-medium text-ink/50">Recent ledger transactions</p>
                <Badge tone={stats?.ledgerIntegrity === 'VALID' ? 'lime' : 'neutral'}>
                  {stats?.ledgerIntegrity === 'VALID' ? 'Chain valid' : 'Unverified'}
                </Badge>
              </div>
              <ul className="divide-y divide-line">
                {(stats?.recentTransactions ?? []).slice(0, 5).map((tx) => (
                  <li key={tx.txHash} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] capitalize text-ink/70">
                        {tx.type.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="mono mt-0.5 text-[10.5px] text-ink/40">{shortHash(tx.txHash, 12, 6)}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-ink/40">#{tx.blockNumber}</span>
                  </li>
                ))}
                {!stats?.recentTransactions?.length && (
                  <li className="py-3 text-[12px] text-ink/45">No transactions recorded yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Portals */}
      <section className="mx-auto max-w-[1200px] px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {PORTAILS.map((portal) => (
            <div key={portal.role} className="border-t border-ink/15 pt-5">
              <p className="text-[13px] font-semibold">{portal.role}</p>
              <p className="mt-2 min-h-[60px] text-[12.5px] leading-relaxed text-ink/55">{portal.body}</p>
              <Link to={portal.to} className="link-quiet mt-4">
                Sign in <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 className="max-w-[520px] text-[26px] font-bold leading-tight md:text-[30px]">
                Inspect the whole election without reading a single vote.
              </h2>
              <p className="mt-2 max-w-[520px] text-[13px] leading-relaxed text-ink/55">
                Administrator, voter and auditor accounts are prepared with demo credentials.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button to="/access" size="lg">
                Sign in <ArrowRight className="h-4 w-4" />
              </Button>
              <Button to="/results" variant="outline" size="lg">
                Public results
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
