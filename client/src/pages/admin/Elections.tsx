import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FileUp,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  SectionHeading,
  Select,
  StatusBadge,
  Textarea,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDate, formatDateTime, formatNumber, formatPercent, shortHash } from '../../lib/format';

interface AdminElection {
  id: string;
  electionId: string;
  name: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  registeredVoters: number;
  votesCast: number;
  candidateCount: number;
  merkleRoot: string | null;
  leafCount: number;
}

/* ------------------------------ Elections list --------------------------- */

export function AdminElections() {
  const { data, loading, refetch } = useApi<AdminElection[]>('/api/admin/elections');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');

  const filtered = useMemo(
    () =>
      (data ?? []).filter(
        (e) =>
          (status === 'ALL' || e.status === status) &&
          (e.name.toLowerCase().includes(query.toLowerCase()) || e.electionId.toLowerCase().includes(query.toLowerCase())),
      ),
    [data, query, status],
  );

  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      total: all.length,
      live: all.filter((e) => e.status === 'LIVE').length,
      drafts: all.filter((e) => ['DRAFT', 'SCHEDULED'].includes(e.status)).length,
      completed: all.filter((e) => e.status === 'COMPLETED').length,
    };
  }, [data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Elections"
        description="Create, publish, open and close elections with enforced state transitions."
        actions={
          <Button to="/admin/elections/create" variant="lime">
            <Plus className="h-4 w-4" /> Create Election
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Total', counts.total],
          ['Live', counts.live],
          ['Draft / scheduled', counts.drafts],
          ['Completed', counts.completed],
        ].map(([label, value]) => (
          <div key={label as string} className="surface-card px-4 py-3">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[20px] font-bold">{String(value).padStart(2, '0')}</p>
          </div>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search elections"
              className="h-9 w-[240px] rounded-lg border border-line bg-white pl-9 pr-3 text-[12.5px] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-[150px] text-[12.5px]">
              {['ALL', 'DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED', 'TALLYING', 'COMPLETED'].map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All statuses' : s}
                </option>
              ))}
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Election</th>
                <th>Voting period</th>
                <th className="text-right">Registered</th>
                <th className="text-right">Votes</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6}>
                    <LoadingBlock rows={5} />
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.electionId}>
                  <td>
                    <p className="text-[13px] font-medium">{e.name}</p>
                    <p className="text-[10.5px] text-ink/40">
                      {e.electionId} · {e.candidateCount} candidates
                    </p>
                  </td>
                  <td className="whitespace-nowrap text-[12px] text-ink/60">
                    {formatDate(e.startDate)} – {formatDate(e.endDate)}
                  </td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(e.registeredVoters)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(e.votesCast)}</td>
                  <td>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="text-right">
                    <Link
                      to={`/admin/elections/${e.electionId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium hover:bg-surface"
                    >
                      Manage <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="No elections match this filter"
                description="Adjust the search or create a new election to get started."
                action={<Button to="/admin/elections/create" variant="lime" size="sm">Create Election</Button>}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- Create election --------------------------- */

interface CandidateDraft {
  name: string;
  position: string;
  slogan: string;
}

export function AdminElectionCreate() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({
    name: '',
    description: '',
    electionId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    rules: 'Plurality',
    voterGroup: 'All registered voters',
  });
  const [candidates, setCandidates] = useState<CandidateDraft[]>([
    { name: '', position: 'Student Council President', slogan: '' },
    { name: '', position: 'Student Council President', slogan: '' },
  ]);
  const [registerCount, setRegisterCount] = useState(250);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    errorRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }, [error]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validCandidates = candidates.filter((c) => c.name.trim().length > 1);
    if (form.name.trim().length < 4) return setError('Provide an election name of at least four characters.');
    if (form.description.trim().length < 10) return setError('Describe the election so voters understand the ballot.');
    if (validCandidates.length < 2) return setError('Add at least two candidates.');
    if (new Date(form.endDate) <= new Date(form.startDate)) return setError('The closing date must be after the opening date.');

    setBusy(true);
    try {
      const created = await api.post<{ election: { electionId: string } }>('/api/admin/elections', {
        ...form,
        electionId: form.electionId.trim() || undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(`${form.endDate}T23:59:59`).toISOString(),
        candidates: validCandidates,
      });

      if (registerCount > 0) {
        await api.post(`/api/admin/elections/${created.election.electionId}/eligible`, {
          mode: 'all',
          limit: registerCount,
        });
      }

      push({
        title: 'Election created',
        description: `${created.election.electionId} created with ${validCandidates.length} candidates and ${registerCount} voter commitments.`,
      });
      navigate(`/admin/elections/${created.election.electionId}`);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to create the election');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/admin/elections" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/55 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to elections
      </Link>
      <PageHeader
        title="Create election"
        description="Configure the ballot, the voting window and the initial voter roster."
      />

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card>
            <SectionHeading title="Election details" description="These fields appear on the voter ballot and the public results page." />
            <div className="mt-5 space-y-4">
              <Field label="Election name" htmlFor="name">
                <Input
                  id="name"
                  placeholder="e.g. Faculty of Science Representative Election"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Description" htmlFor="description">
                <Textarea
                  id="description"
                  placeholder="Explain the purpose of this election."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Election ID" htmlFor="electionId" hint="Leave blank to generate automatically">
                  <Input
                    id="electionId"
                    placeholder="ELEC-2026-009"
                    value={form.electionId}
                    onChange={(e) => setForm({ ...form, electionId: e.target.value })}
                  />
                </Field>
                <Field label="Voting rules" htmlFor="rules">
                  <Select id="rules" value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })}>
                    <option>Plurality</option>
                    <option>Simple majority</option>
                    <option>Single transferable vote</option>
                  </Select>
                </Field>
                <Field label="Opens" htmlFor="startDate">
                  <Input
                    id="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </Field>
                <Field label="Closes" htmlFor="endDate">
                  <Input
                    id="endDate"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Eligible voter group" htmlFor="voterGroup">
                <Input
                  id="voterGroup"
                  value={form.voterGroup}
                  onChange={(e) => setForm({ ...form, voterGroup: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeading
              title="Candidates"
              description="Candidates can only be edited while the election has no ballots."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCandidates([...candidates, { name: '', position: candidates[0]?.position ?? 'Representative', slogan: '' }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              }
            />
            <div className="mt-4 space-y-3">
              {candidates.map((c, i) => (
                <div key={i} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11.5px] font-medium text-ink/45">
                      Candidate {String(i + 1).padStart(2, '0')}
                    </p>
                    {candidates.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setCandidates(candidates.filter((_, idx) => idx !== i))}
                        className="text-ink/35 hover:text-red-600"
                        aria-label="Remove candidate"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Candidate name"
                      value={c.name}
                      onChange={(e) => setCandidates(candidates.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <Input
                      placeholder="Position"
                      value={c.position}
                      onChange={(e) => setCandidates(candidates.map((x, idx) => (idx === i ? { ...x, position: e.target.value } : x)))}
                    />
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Short statement shown on the ballot"
                    value={c.slogan}
                    onChange={(e) => setCandidates(candidates.map((x, idx) => (idx === i ? { ...x, slogan: e.target.value } : x)))}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionHeading title="Voter roster" description="Commitments are generated from existing registry accounts." />
            <div className="mt-4 space-y-4">
              <Field label="Initial eligible voters" htmlFor="registerCount" hint="Maximum 8,192 leaves (depth 13 Merkle tree)">
                <Select
                  id="registerCount"
                  value={String(registerCount)}
                  onChange={(e) => setRegisterCount(Number(e.target.value))}
                >
                  <option value="0">Do not register voters yet</option>
                  <option value="100">100 voters</option>
                  <option value="250">250 voters</option>
                  <option value="500">500 voters</option>
                  <option value="1000">1,000 voters</option>
                  <option value="3000">3,000 voters</option>
                </Select>
              </Field>
              <Callout tone="neutral" icon={<Lock className="h-4 w-4" />}>
                Each voter receives a unique Poseidon commitment. The resulting Merkle root is published to the ledger
                when you publish the election.
              </Callout>
            </div>
          </Card>

          <Card>
            <SectionHeading title="Lifecycle" description="What happens after creation." />
            <ol className="mt-4 space-y-3">
              {[
                'Election is created in DRAFT and an ELECTION_CREATED transaction is committed.',
                'Voter commitments are generated and the Merkle root is published.',
                'Opening the election moves it to LIVE and accepts ballots.',
                'Closing seals the ballot set; tallying decrypts only the aggregate.',
              ].map((step, i) => (
                <li key={step} className="flex gap-3 text-[12.5px] leading-relaxed text-ink/60">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-ink/50">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>

          {error && (
            <div
              ref={errorRef}
              role="alert"
              className="rounded-xl border border-[#F6D2D2] bg-[#FEF6F6] px-4 py-3 text-[12.5px] text-[#B42318]"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/admin/elections')}>
              Cancel
            </Button>
            <Button type="submit" variant="lime" loading={busy}>
              Create election
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- Election detail --------------------------- */

interface DetailShape {
  id: string;
  electionId: string;
  name: string;
  description: string;
  status: string;
  rules: string;
  voterGroup: string;
  startDate: string;
  endDate: string;
  merkleRoot: string | null;
  merkleDepth: number;
  leafCount: number;
  keyBits: number;
  registeredVoters: number;
  votesCast: number;
  proofCount: number;
  candidates: { candidateId: string; name: string; position: string; slogan: string; index: number }[];
  results: { candidateId: string; votes: number }[];
  transactions: { txHash: string; type: string; blockNumber: number | null; timestamp: string; status: string; label: string }[];
}

export function AdminElectionDetail() {
  const { id } = useParams();
  const { data, loading, refetch } = useApi<DetailShape>(`/api/admin/elections/${id}`);
  const { push } = useToast();
  const [action, setAction] = useState<null | 'publish' | 'open' | 'close' | 'tally'>(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('voterNumber,name,faculty\nVOTER-2027-1001,Jordan Ellis,Computer Science\nVOTER-2027-1002,Amara Diallo,Engineering');
  const [registerCount, setRegisterCount] = useState(250);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [candidateForm, setCandidateForm] = useState({ name: '', position: 'Representative', slogan: '' });
  const [removeCandidate, setRemoveCandidate] = useState<{ candidateId: string; name: string } | null>(null);
  const [candidateBusy, setCandidateBusy] = useState(false);

  const addCandidate = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!data) return;
    if (candidateForm.name.trim().length < 2) {
      push({ title: 'Candidate name required', description: 'Enter at least two characters.', tone: 'error' });
      return;
    }
    setCandidateBusy(true);
    try {
      await api.post(`/api/admin/elections/${data.electionId}/candidates`, {
        name: candidateForm.name.trim(),
        position: candidateForm.position.trim() || 'Representative',
        slogan: candidateForm.slogan.trim(),
      });
      push({ title: 'Candidate added', description: `${candidateForm.name.trim()} is now on the ballot.` });
      setCandidateOpen(false);
      setCandidateForm({ name: '', position: 'Representative', slogan: '' });
      await refetch();
    } catch (err: any) {
      push({ title: 'Could not add candidate', description: err?.message, tone: 'error' });
    } finally {
      setCandidateBusy(false);
    }
  };

  const removeCandidateNow = async () => {
    if (!removeCandidate) return;
    setCandidateBusy(true);
    try {
      await api.del(`/api/admin/candidates/${removeCandidate.candidateId}`);
      push({ title: 'Candidate removed', description: `${removeCandidate.name} was removed from the ballot.` });
      setRemoveCandidate(null);
      await refetch();
    } catch (err: any) {
      push({ title: 'Could not remove candidate', description: err?.message, tone: 'error' });
    } finally {
      setCandidateBusy(false);
    }
  };

  const runAction = async () => {
    if (!action || !data) return;
    setBusy(true);
    try {
      const result = await api.post<any>(`/api/admin/elections/${data.electionId}/${action}`);
      push({
        title: `${action === 'tally' ? 'Tally published' : action === 'publish' ? 'Eligibility root published' : action === 'open' ? 'Election opened' : 'Election closed'}`,
        description:
          action === 'publish'
            ? `Merkle root ${shortHash(result.root, 12, 8)} committed for ${formatNumber(result.leafCount)} voters.`
            : action === 'tally'
              ? `${formatNumber(result.acceptedBallots)} encrypted ballots aggregated into the published totals.`
              : `Block #${result.block?.blockNumber} committed with ${result.block?.approvals} validator approvals.`,
      });
      setAction(null);
      await refetch();
    } catch (err: any) {
      push({ title: 'Action failed', description: err?.message, tone: 'error' });
      setAction(null);
    } finally {
      setBusy(false);
    }
  };

  const registerVoters = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const result = await api.post<any>(`/api/admin/elections/${data.electionId}/eligible`, { mode: 'all', limit: registerCount });
      push({ title: 'Registry updated', description: `${result.added} voter commitments generated.` });
      await refetch();
    } catch (err: any) {
      push({ title: 'Registration failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const result = await api.post<any>(`/api/admin/elections/${data.electionId}/import-voters`, { csv });
      push({ title: 'CSV imported', description: `${result.created} new voters, ${result.registered} registered.` });
      setImportOpen(false);
      await refetch();
    } catch (err: any) {
      push({ title: 'Import failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <LoadingBlock rows={2} />
        <Card><LoadingBlock rows={6} /></Card>
      </div>
    );
  }

  const totalResults = data.results.reduce((s, r) => s + r.votes, 0);
  const canEditCandidates = data.votesCast === 0;
  const nextActions: { key: 'publish' | 'open' | 'close' | 'tally'; label: string; enabled: boolean; hint: string }[] = [
    {
      key: 'publish',
      label: 'Publish eligibility root',
      enabled: !data.merkleRoot || data.status === 'DRAFT',
      hint: 'Build the Poseidon Merkle tree and commit the root.',
    },
    {
      key: 'open',
      label: 'Open voting',
      enabled: !!data.merkleRoot && (data.status === 'SCHEDULED' || data.status === 'DRAFT'),
      hint: data.merkleRoot ? 'Move the election to LIVE.' : 'Publish the eligibility root first.',
    },
    { key: 'close', label: 'Close election', enabled: data.status === 'LIVE', hint: 'Stop accepting ballots and seal the set.' },
    {
      key: 'tally',
      label: 'Publish tally',
      enabled: (data.status === 'CLOSED' || data.status === 'TALLYING') && data.votesCast > 0,
      hint: data.votesCast > 0 ? 'Aggregate ciphertexts and decrypt totals.' : 'No accepted ballots to tally.',
    },
  ];

  return (
    <div className="space-y-5">
      <Link to="/admin/elections" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/55 hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to elections
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
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered voters" value={formatNumber(data.registeredVoters)} />
        <Stat label="Votes cast" value={formatNumber(data.votesCast)} />
        <Stat label="Participation" value={formatPercent(data.registeredVoters ? (data.votesCast / data.registeredVoters) * 100 : 0)} />
        <Stat label="ZKP records" value={formatNumber(data.proofCount)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card>
            <SectionHeading title="Election configuration" description="Metadata, voting rules and cryptographic parameters." />
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Row label="Voting period" value={`${formatDate(data.startDate)} – ${formatDate(data.endDate)}`} />
              <Row label="Voting rules" value={data.rules} />
              <Row label="Eligible group" value={data.voterGroup} />
              <Row label="Maximum selections" value="1 candidate" />
              <Row label="Merkle depth" value={`${data.merkleDepth} (2^${data.merkleDepth} leaves)`} />
              <Row label="Tally key size" value={`${data.keyBits}-bit Paillier`} />
            </dl>
            <div className="mt-4 rounded-xl border border-line bg-canvas p-3.5">
              <p className="stat-label">Published eligibility root</p>
              <p className="mono mt-1 break-all text-ink/60">{data.merkleRoot ?? 'Not published yet'}</p>
              <p className="mt-1 text-[11px] text-ink/40">{formatNumber(data.leafCount)} commitments committed to the tree</p>
            </div>
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between px-5 pt-5">
              <SectionHeading title="Candidates" description={canEditCandidates ? 'Editable until the first ballot is cast.' : 'Locked — voting has commenced.'} />
              <div className="flex items-center gap-2">
                <Badge tone={canEditCandidates ? 'outline' : 'neutral'}>{canEditCandidates ? 'Editable' : 'Locked'}</Badge>
                {canEditCandidates && data.status === 'DRAFT' && (
                  <Button variant="outline" size="sm" onClick={() => setCandidateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-3 divide-y divide-line">
              {data.candidates.map((c) => {
                const votes = data.results.find((r) => r.candidateId === c.candidateId)?.votes ?? 0;
                return (
                  <div key={c.candidateId} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-[11px] font-semibold text-ink/50">
                        {String(c.index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="text-[13px] font-medium">{c.name}</p>
                        <p className="text-[11px] text-ink/45">{c.position}</p>
                        {c.slogan && <p className="mt-0.5 max-w-md text-[11.5px] italic text-ink/40">“{c.slogan}”</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {data.results.length > 0 && (
                        <div className="text-right">
                          <p className="text-[13px] font-semibold tabular-nums">{formatNumber(votes)}</p>
                          <p className="text-[10.5px] text-ink/40">{totalResults ? formatPercent((votes / totalResults) * 100) : '—'}</p>
                        </div>
                      )}
                      {canEditCandidates && data.status === 'DRAFT' && (
                        <button
                          type="button"
                          aria-label={`Remove ${c.name}`}
                          onClick={() => setRemoveCandidate({ candidateId: c.candidateId, name: c.name })}
                          className="text-ink/25 transition-colors duration-150 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padded={false}>
            <div className="px-5 pt-5">
              <SectionHeading title="Election ledger activity" description="Transactions associated with this election." />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Type</th>
                    <th>Block</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((tx) => (
                    <tr key={tx.txHash}>
                      <td className="mono text-[11px] text-ink/55">{shortHash(tx.txHash, 10, 6)}</td>
                      <td className="text-[12px]">{tx.label}</td>
                      <td className="text-[12px] tabular-nums text-ink/60">#{tx.blockNumber}</td>
                      <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDateTime(tx.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.transactions.length === 0 && <p className="px-5 py-6 text-[12.5px] text-ink/50">No transactions recorded.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <SectionHeading title="Lifecycle actions" description="Each transition is committed to the consortium ledger." />
            <div className="mt-4 space-y-2">
              {nextActions.map((a) => (
                <div key={a.key} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
                  <div>
                    <p className="text-[12.5px] font-medium">{a.label}</p>
                    <p className="text-[11px] text-ink/45">{a.hint}</p>
                  </div>
                  <Button variant={a.key === 'close' ? 'primary' : 'outline'} size="sm" disabled={!a.enabled} onClick={() => setAction(a.key)}>
                    {{ publish: 'Publish', open: 'Open', close: 'Close', tally: 'Tally' }[a.key]}
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Callout tone="blue" icon={<ShieldCheck className="h-4 w-4" />}>
                Blocks are append-only. Corrections are recorded as new compensating transactions, never by editing
                history.
              </Callout>
            </div>
          </Card>

          <Card>
            <SectionHeading title="Voter roster" description="Generate commitments or import a CSV roster." />
            <div className="mt-4 space-y-3">
              <Field label="Register additional voters" htmlFor="registerCount">
                <div className="flex gap-2">
                  <Select id="registerCount" value={String(registerCount)} onChange={(e) => setRegisterCount(Number(e.target.value))}>
                    <option value="50">50 voters</option>
                    <option value="250">250 voters</option>
                    <option value="1000">1,000 voters</option>
                    <option value="3000">3,000 voters</option>
                  </Select>
                  <Button variant="outline" size="md" onClick={registerVoters} loading={busy} className="shrink-0">
                    <Users className="h-3.5 w-3.5" /> Register
                  </Button>
                </div>
              </Field>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="w-full">
                <FileUp className="h-3.5 w-3.5" /> Import voter CSV
              </Button>
              <p className="text-[11px] leading-relaxed text-ink/45">
                Voter secrets are generated server-side and never appear in transaction records or audit logs.
              </p>
            </div>
          </Card>

          <Card>
            <SectionHeading title="Tally summary" description="Published only after the election is completed." />
            {data.results.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-line p-4 text-center">
                <Lock className="mx-auto h-4 w-4 text-ink/35" />
                <p className="mt-2 text-[12px] text-ink/55">No aggregate published yet.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {data.candidates.map((c) => {
                  const votes = data.results.find((r) => r.candidateId === c.candidateId)?.votes ?? 0;
                  return (
                    <div key={c.candidateId} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-ink/70">{c.name}</span>
                      <span className="tabular-nums font-medium">{formatNumber(votes)}</span>
                    </div>
                  );
                })}
                <div className="border-t border-line pt-2 text-[11.5px] text-ink/45">
                  {formatNumber(totalResults)} aggregate votes from {formatNumber(data.votesCast)} ballots
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={
          action === 'publish'
            ? 'Publish eligibility root?'
            : action === 'open'
              ? 'Open voting?'
              : action === 'close'
                ? 'Close this election?'
                : 'Publish the aggregate tally?'
        }
        description={
          action === 'close'
            ? 'Ballots will no longer be accepted. This action is committed to the ledger.'
            : action === 'tally'
              ? 'Encrypted ballots are aggregated homomorphically and decrypted once. Only candidate totals are published.'
              : 'This action commits a transaction that validators must approve before it is accepted.'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant={action === 'close' ? 'primary' : 'lime'} loading={busy} onClick={runAction}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="rounded-lg bg-surface px-3.5 py-3 text-[12px] text-ink/60">
          <p className="font-medium text-ink">{data.name}</p>
          <p className="mt-0.5">
            {data.electionId} · {formatNumber(data.votesCast)} ballots · {formatNumber(data.registeredVoters)} registered voters
          </p>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import voter registry"
        description="CSV format: voterNumber,name,faculty — one voter per line."
        width="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button variant="lime" loading={busy} onClick={importCsv}>
              Import roster
            </Button>
          </>
        }
      >
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="input-base h-44 w-full font-mono text-[12px] leading-relaxed"
        />
      </Modal>

      <Modal
        open={candidateOpen}
        onClose={() => setCandidateOpen(false)}
        title="Add candidate"
        description="Candidates can be changed until the first ballot is cast."
        footer={
          <>
            <Button variant="outline" onClick={() => setCandidateOpen(false)}>
              Cancel
            </Button>
            <Button variant="lime" loading={candidateBusy} onClick={addCandidate}>
              Add candidate
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" htmlFor="candidateName">
            <Input
              id="candidateName"
              value={candidateForm.name}
              onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })}
              placeholder="Candidate name"
            />
          </Field>
          <Field label="Position" htmlFor="candidatePosition">
            <Input
              id="candidatePosition"
              value={candidateForm.position}
              onChange={(e) => setCandidateForm({ ...candidateForm, position: e.target.value })}
            />
          </Field>
          <Field label="Statement" htmlFor="candidateSlogan" hint="Optional — shown on the ballot">
            <Textarea
              id="candidateSlogan"
              value={candidateForm.slogan}
              onChange={(e) => setCandidateForm({ ...candidateForm, slogan: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={removeCandidate !== null}
        onClose={() => setRemoveCandidate(null)}
        title="Remove candidate?"
        description="The candidate is removed from this draft ballot and the change is recorded in the audit log."
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveCandidate(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={candidateBusy} onClick={removeCandidateNow}>
              Remove
            </Button>
          </>
        }
      >
        <div className="rounded-lg bg-surface px-3.5 py-3 text-[12.5px]">
          <p className="font-medium text-ink">{removeCandidate?.name}</p>
          <p className="mt-0.5 text-ink/55">{removeCandidate?.candidateId}</p>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card px-4 py-3.5">
      <p className="stat-label">{label}</p>
      <p className="mt-1 font-display text-[22px] font-bold leading-none">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <dt className="text-[11.5px] text-ink/45">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] font-medium">{value}</dd>
    </div>
  );
}
