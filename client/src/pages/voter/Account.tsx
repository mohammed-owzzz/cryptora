import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Fingerprint,
  History,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  StatusBadge,
  useToast,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate, formatDateTime, formatNumber, formatPercent, relativeTime, shortHash } from '../../lib/format';

/* -------------------------------- History --------------------------------- */

interface HistoryRow {
  receiptCode: string;
  electionId: string;
  electionName: string;
  electionStatus: string;
  blockNumber: number | null;
  committedAt: string;
  nullifierPrefix: string;
  resultsPublished: boolean;
}

interface ReceiptLookup {
  receiptCode: string;
  electionName: string;
  blockNumber: number | null;
  blockHash: string | null;
  txHash: string | null;
  label: string | null;
  committedAt: string;
  ciphertextCount: number;
  scheme: string | null;
}

export function VoterHistory() {
  const { data, loading } = useApi<{ note: string; history: HistoryRow[] }>('/api/voter/history');
  const { push } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<ReceiptLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setFound(null);
    setLookupError(null);
    try {
      setFound(await api.get<ReceiptLookup>(`/api/voter/receipt/${encodeURIComponent(code.trim())}`));
    } catch (err: any) {
      setLookupError(err?.message ?? 'Receipt not found');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    push({ title: 'Copied to clipboard', tone: 'info' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Voting History"
        description="A record of every ballot you have committed. Your candidate selections are deliberately absent — the ledger stores ciphertext only."
      />

      <Callout tone="blue" icon={<Lock className="h-4 w-4" />} title="What this page proves">
        {data?.note ?? 'Ballot contents are sealed and never linked to your identity in this record.'}
      </Callout>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <SectionHeading title="Committed ballots" description="Ordered by most recent submission." />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Election</th>
                <th>Block</th>
                <th>Nullifier</th>
                <th>Committed</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7}>
                    <LoadingBlock rows={4} />
                  </td>
                </tr>
              )}
              {(data?.history ?? []).map((h) => (
                <tr key={h.receiptCode}>
                  <td className="mono text-[11.5px] font-medium">{h.receiptCode}</td>
                  <td>
                    <p className="text-[12.5px]">{h.electionName}</p>
                    <p className="text-[10px] text-ink/40">{h.electionId}</p>
                  </td>
                  <td className="text-[12px] tabular-nums text-ink/60">#{h.blockNumber}</td>
                  <td className="mono text-[11px] text-ink/45">{h.nullifierPrefix}…</td>
                  <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDateTime(h.committedAt)}</td>
                  <td>
                    <StatusBadge status={h.electionStatus} />
                  </td>
                  <td className="text-right">
                    <button onClick={() => copy(h.receiptCode)} className="text-[11.5px] text-ink/45 hover:text-ink">
                      Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && (data?.history ?? []).length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={<History className="h-5 w-5" />}
                title="No ballots yet"
                description="Once you cast a ballot it appears here with a verifiable receipt code."
                action={
                  <Button to="/voter/elections" variant="lime" size="sm">
                    View elections
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeading title="Verify a receipt" description="Look up any of your receipt codes to confirm its ledger position." />
        <form onSubmit={verify} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <Field label="Receipt code" htmlFor="receipt">
              <Input
                id="receipt"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CRY-XXXXXXXXXXXX"
                icon={<Search className="h-3.5 w-3.5" />}
              />
            </Field>
          </div>
          <Button type="submit" variant="outline" loading={busy}>
            Verify
          </Button>
        </form>

        {lookupError && <p className="mt-3 text-[12px] text-red-600">{lookupError}</p>}

        {found && (
          <div className="mt-4 rounded-xl border border-lime/50 bg-lime-soft/40 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#4c6b10]" />
              <p className="text-[13px] font-semibold">Receipt found in the ledger</p>
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ['Election', found.electionName],
                ['Block', `#${found.blockNumber}`],
                ['Block hash', shortHash(found.blockHash, 16, 10)],
                ['Transaction', shortHash(found.txHash, 16, 10)],
                ['Ciphertexts', `${found.ciphertextCount} · ${found.scheme ?? 'paillier'}`],
                ['Committed', formatDateTime(found.committedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-white px-3 py-2">
                  <dt className="stat-label">{label}</dt>
                  <dd className="mono mt-0.5 break-all text-[11.5px]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------- Results --------------------------------- */

interface VoterResult {
  electionId: string;
  name: string;
  status: string;
  registeredVoters: number;
  votesCast: number;
  published: boolean;
  results: { candidateId: string; name: string; votes: number; share: number }[] | null;
}

export function VoterResults() {
  const { data, loading } = useApi<VoterResult[]>('/api/voter/results');
  const published = (data ?? []).filter((e) => e.published && e.results);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Election Results"
        description="Aggregate totals published after each election closes. Individual ballots are never decrypted, only the sum."
      />

      {loading && <LoadingBlock rows={4} />}

      {!loading && published.length === 0 && (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="No published results yet"
          description="Results appear here once an election you were eligible for is closed and tallied."
        />
      )}

      {published.map((e) => {
        const total = e.results?.reduce((s, r) => s + r.votes, 0) ?? 0;
        return (
          <Card key={e.electionId}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionHeading title={e.name} description={`${e.electionId} · ${formatNumber(e.votesCast)} ballots counted`} />
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="outline" dot={false}>
                  Turnout {formatPercent(e.registeredVoters ? (e.votesCast / e.registeredVoters) * 100 : 0)}
                </Badge>
                <StatusBadge status={e.status} />
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {(e.results ?? []).map((r, i) => (
                <div key={r.candidateId}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-ink/50">
                        {i + 1}
                      </span>
                      <p className="text-[12.5px] font-medium">{r.name}</p>
                      {i === 0 && <Badge tone="lime">Elected</Badge>}
                    </div>
                    <p className="text-[12px] tabular-nums text-ink/60">
                      <span className="font-semibold text-ink">{formatNumber(r.votes)}</span> · {formatPercent(r.share)}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${i === 0 ? 'bg-lime' : 'bg-ink/20'}`}
                      style={{ width: `${Math.max(r.share, 1.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink/40">
              {formatNumber(total)} aggregate votes decrypted from homomorphically combined ciphertexts.
            </p>
          </Card>
        );
      })}
    </div>
  );
}

/* -------------------------------- Profile --------------------------------- */

interface ProfileShape {
  name: string;
  email: string;
  voterNumber: string;
  voterId: string | null;
  faculty: string;
  district: string | null;
  eligibility: string;
  verifiedAt: string;
  lastLoginAt: string | null;
  membershipCount: number;
  ballotCount: number;
  sessions: number;
}

export function VoterProfile() {
  const { data, loading, refetch } = useApi<ProfileShape>('/api/voter/profile');
  const { refresh } = useAuth();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', faculty: '' });

  const startEdit = () => {
    setForm({ name: data?.name ?? '', faculty: data?.faculty ?? '' });
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/api/voter/profile', { name: form.name, faculty: form.faculty });
      await refetch();
      await refresh();
      setEditing(false);
      push({ title: 'Profile updated' });
    } catch (err: any) {
      push({ title: 'Update failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) return <LoadingBlock rows={5} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Profile"
        description="Your identity is used only to determine eligibility. It is never joined to a ballot selection."
        actions={
          editing ? undefined : (
            <Button variant="outline" onClick={startEdit}>
              <UserRound className="h-4 w-4" /> Edit profile
            </Button>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar role="VOTER" size="lg" />
            <div>
              <p className="text-[16px] font-semibold">{data.name}</p>
              <p className="text-[12px] text-ink/50">{data.email}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone={data.eligibility === 'ELIGIBLE' ? 'lime' : 'danger'}>{data.eligibility}</Badge>
                <span className="text-[10.5px] text-ink/40">verified {formatDate(data.verifiedAt)}</span>
              </div>
            </div>
          </div>

          <dl className="mt-5 space-y-2 text-[12px]">
            {[
              ['Voter number', data.voterNumber],
              ['Faculty', data.faculty],
              ['District', data.district ?? '—'],
              ['Eligible elections', String(data.membershipCount)],
              ['Ballots submitted', String(data.ballotCount)],
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
          {editing ? (
            <Card>
              <SectionHeading title="Edit profile" description="Only your display name and faculty are editable." />
              <form onSubmit={save} className="mt-4 space-y-4">
                <Field label="Full name" htmlFor="p-name">
                  <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </Field>
                <Field label="Faculty" htmlFor="p-faculty">
                  <Input id="p-faculty" value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="lime" loading={busy}>
                    Save changes
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card>
              <SectionHeading title="Identity verification" description="How your eligibility was established." />
              <ul className="mt-4 space-y-2.5 text-[12px] text-ink/60">
                {[
                  'Your voter number is checked against the institution registry before the account is activated.',
                  'A random credential salt is generated once and stored only on the server.',
                  'For each election the salt derives a commitment: Poseidon(sha256(salt ‖ electionId)).',
                  'The commitment is placed in the Merkle tree; the salt is never written to the ledger.',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c6b10]" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Callout tone="blue" icon={<Fingerprint className="h-4 w-4" />} title="Why candidates never appear here">
            The database keeps ballot rows without any reference to the selected candidate. The encrypted vector is the
            only representation of your choice, which is what makes the secret ballot enforceable rather than a promise.
          </Callout>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Security -------------------------------- */

interface SecurityShape {
  passwordHashAlgorithm: string;
  sessionTtlHours: number;
  cookieFlags: string[];
  sessions: { id: string; createdAt: string; expiresAt: string; ip: string | null; current: boolean }[];
  events: { action: string; detail: string; createdAt: string }[];
  zkp: { circuit: string; protocol: string; proofLocation: string };
}

export function VoterSecurity() {
  const { data, loading, refetch } = useApi<SecurityShape>('/api/voter/security');
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    setBusy(true);
    try {
      const result = await api.del<{ revoked: number }>('/api/voter/sessions');
      push({ title: 'Sessions revoked', description: `${result.revoked} other session(s) terminated.` });
      await refetch();
    } catch (err: any) {
      push({ title: 'Could not revoke sessions', description: err?.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) return <LoadingBlock rows={5} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Security & Privacy"
        description="Review the cryptographic guarantees and the session controls protecting your account."
        actions={
          <Button variant="outline" loading={busy} onClick={revoke}>
            <LogOut className="h-4 w-4" /> Sign out other sessions
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ['Proof system', `${data.zkp.protocol.toUpperCase()} over ${data.zkp.circuit}.circom`],
          ['Password hashing', data.passwordHashAlgorithm],
          ['Session lifetime', `${data.sessionTtlHours} hours`],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 text-[12.5px] font-medium">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="px-5 pt-5">
            <SectionHeading title="Active sessions" description="Each sign-in creates a separate server-side session." />
          </div>
          <div className="mt-4 divide-y divide-line">
            {data.sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-start gap-2.5">
                  <Laptop className="mt-0.5 h-4 w-4 text-ink/40" />
                  <div>
                    <p className="text-[12px] font-medium">
                      {s.current ? 'This device' : 'Another device'}
                      {s.current && <Badge tone="lime" className="ml-2">Current</Badge>}
                    </p>
                    <p className="text-[10.5px] text-ink/40">
                      {s.ip ?? 'unknown IP'} · expires {formatDateTime(s.expiresAt)}
                    </p>
                  </div>
                </div>
                <span className="text-[10.5px] text-ink/35">{relativeTime(s.createdAt)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-3 text-[11px] text-ink/45">
            Cookie flags: {data.cookieFlags.join(' · ')}
          </div>
        </Card>

        <Card>
          <SectionHeading title="How your ballot stays secret" description="Four independent properties." />
          <div className="mt-4 space-y-2.5">
            {[
              ['Unlinkable eligibility', 'The proof reveals membership of the set, not which member.'],
              ['Encrypted at the source', data.zkp.proofLocation],
              ['No plaintext storage', 'The server only ever receives Paillier ciphertexts and a commitment.'],
              ['Aggregate-only decryption', 'The tally key decrypts the sum of all ciphertexts, never an individual ballot.'],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-xl border border-line px-3.5 py-3">
                <p className="text-[12.5px] font-semibold">{title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink/55">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <SectionHeading title="Account activity" description="Security events recorded against your account." />
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

      <Callout tone="neutral" icon={<KeyRound className="h-4 w-4" />} title="Prototype scope">
        Credential material is held server-side and delivered to your own browser over the authenticated session. There is
        no hardware wallet or national e-ID integration in this build, and that boundary is documented in the project
        report rather than hidden.
      </Callout>
    </div>
  );
}

/* ---------------------------------- Help ---------------------------------- */

const FAQ = [
  {
    q: 'How do I know my vote was counted?',
    a: 'Every accepted ballot returns a receipt code and the block number it was committed in. You can look the receipt up on the voting history page, and an auditor can independently verify the block that contains it.',
  },
  {
    q: 'Can anyone tell who I voted for?',
    a: 'No. Your selection is encrypted in your browser before it is sent. The server stores ciphertext, and only the aggregate sum is decrypted after the election closes. Your ballot row is never linked to a candidate in the database.',
  },
  {
    q: 'Why does submitting take a few seconds?',
    a: 'The eligibility proof is generated locally with snarkjs. The first submission also downloads the proving key (about 3 MB). Server-side verification of the same proof takes tens of milliseconds.',
  },
  {
    q: 'What stops me voting twice?',
    a: 'Each ballot carries a nullifier derived from your credential secret and the election identifier. The server records the nullifier and rejects any second ballot with the same value, even if the proof is valid.',
  },
  {
    q: 'What if the proof fails?',
    a: 'The submission pipeline stops before anything is committed, and the failed stage is shown with the server error. No partial ballot is ever written to the ledger.',
  },
  {
    q: 'Can I change my vote after submitting?',
    a: 'No. Once a ballot is committed to a block it cannot be edited or withdrawn. That immutability is what makes the result auditable.',
  },
];

export function VoterHelp() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-5">
      <PageHeader title="Help Centre" description="Answers about eligibility, receipts, privacy and the submission pipeline." />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <SectionHeading title="Frequently asked questions" description="Six questions voters ask most often." />
          <div className="mt-4 divide-y divide-line">
            {FAQ.map((item, i) => (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
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
            <SectionHeading title="Quick links" description="Common tasks." />
            <div className="mt-4 space-y-2">
              {[
                { label: 'Available elections', to: '/voter/elections' },
                { label: 'My voting history', to: '/voter/history' },
                { label: 'Published results', to: '/voter/results' },
                { label: 'Security & privacy', to: '/voter/security' },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[12.5px] hover:bg-surface"
                >
                  {l.label} <span aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </Card>

          <Callout tone="blue" icon={<BookOpen className="h-4 w-4" />} title="Still stuck?">
            Election support is provided by the returning officer. Quote your voucher number and, if relevant, the receipt
            code — never share your password or credential material with anyone, including support staff.
          </Callout>

          <Card>
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
              <p className="text-[11.5px] leading-relaxed text-ink/55">
                This is an academic demonstration environment. Figures come from a seeded dataset and the consortium runs
                locally rather than across five institutions.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
