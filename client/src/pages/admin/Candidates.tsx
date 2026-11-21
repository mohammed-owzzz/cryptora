import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, UserRound, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatNumber, initials } from '../../lib/format';

interface CandidateRow {
  id: string;
  candidateId: string;
  name: string;
  position: string;
  slogan: string;
  electionId: string;
  electionName: string;
  electionStatus: string;
}

interface ElectionOption {
  electionId: string;
  name: string;
  status: string;
  votesCast: number;
  candidateCount: number;
}

export default function AdminCandidates() {
  const { data, loading, refetch } = useApi<CandidateRow[]>('/api/admin/candidates');
  const { data: elections } = useApi<ElectionOption[]>('/api/admin/elections');
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [electionFilter, setElectionFilter] = useState('ALL');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ electionId: '', name: '', position: 'Student Council President', slogan: '' });

  const editable = useMemo(
    () => (elections ?? []).filter((e) => e.votesCast === 0 && ['DRAFT', 'SCHEDULED'].includes(e.status)),
    [elections],
  );

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (data ?? []).filter(
      (c) =>
        (electionFilter === 'ALL' || c.electionId === electionFilter) &&
        (!q || c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q) || c.electionName.toLowerCase().includes(q)),
    );
    const map = new Map<string, { electionId: string; electionName: string; status: string; candidates: CandidateRow[] }>();
    for (const c of rows) {
      const entry = map.get(c.electionId) ?? {
        electionId: c.electionId,
        electionName: c.electionName,
        status: c.electionStatus,
        candidates: [],
      };
      entry.candidates.push(c);
      map.set(c.electionId, entry);
    }
    return [...map.values()];
  }, [data, query, electionFilter]);

  const remove = async (c: CandidateRow) => {
    try {
      await api.del(`/api/admin/candidates/${c.candidateId}`);
      push({ title: 'Candidate removed', description: `${c.name} was removed from ${c.electionId}.` });
      await refetch();
    } catch (err: any) {
      push({ title: 'Removal failed', description: err?.message, tone: 'error' });
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.electionId) {
      push({ title: 'Select an election', description: 'Candidates belong to an editable election.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/admin/elections/${form.electionId}/candidates`, {
        name: form.name,
        position: form.position,
        slogan: form.slogan,
      });
      push({ title: 'Candidate added', description: `${form.name} joined ${form.electionId}.` });
      setOpen(false);
      setForm({ electionId: form.electionId, name: '', position: form.position, slogan: '' });
      await refetch();
    } catch (err: any) {
      push({ title: 'Could not add candidate', description: err?.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Candidates"
        description="Candidate lists are frozen once the first ballot is accepted, so the ballot vector always matches the published metadata."
        actions={
          <Button variant="lime" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add candidate
          </Button>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search candidates"
              className="h-9 w-[260px] max-w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[12.5px] focus:outline-none"
            />
          </div>
          <Select value={electionFilter} onChange={(e) => setElectionFilter(e.target.value)} className="h-9 w-[260px] text-[12.5px]">
            <option value="ALL">All elections</option>
            {(elections ?? []).map((e) => (
              <option key={e.electionId} value={e.electionId}>
                {e.electionId} — {e.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-4 p-4">
          {loading && <LoadingBlock rows={5} />}
          {!loading && grouped.length === 0 && (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No candidates found"
              description="Add candidates to a draft election to build its ballot."
              action={
                <Button variant="lime" size="sm" onClick={() => setOpen(true)}>
                  Add candidate
                </Button>
              }
            />
          )}
          {grouped.map((group) => (
            <div key={group.electionId} className="overflow-hidden rounded-xl border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface/60 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Link to={`/admin/elections/${group.electionId}`} className="text-[12.5px] font-semibold hover:underline">
                    {group.electionName}
                  </Link>
                  <span className="text-[10.5px] text-ink/40">{group.electionId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="outline" dot={false}>
                    {formatNumber(group.candidates.length)} candidates
                  </Badge>
                  <StatusBadge status={group.status} />
                </div>
              </div>
              <div className="divide-y divide-line">
                {group.candidates
                  .slice()
                  .sort((a, b) => a.candidateId.localeCompare(b.candidateId))
                  .map((c) => (
                    <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-[10.5px] font-semibold text-ink/50">
                          {initials(c.name)}
                        </span>
                        <div>
                          <p className="text-[12.5px] font-medium">{c.name}</p>
                          <p className="text-[11px] text-ink/45">
                            {c.position} · <span className="mono">{c.candidateId}</span>
                          </p>
                          {c.slogan && <p className="mt-0.5 max-w-lg text-[11.5px] italic text-ink/40">“{c.slogan}”</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(c)}
                        className="rounded-lg border border-line p-1.5 text-ink/40 transition hover:border-[#F6D2D2] hover:text-red-600"
                        aria-label={`Remove ${c.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a candidate"
        description="Only elections with no accepted ballots accept new candidates."
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="lime" loading={busy} onClick={add as any}>
              Add candidate
            </Button>
          </>
        }
      >
        <form onSubmit={add} className="space-y-4">
          <Field label="Election" htmlFor="c-election" hint={editable.length === 0 ? 'No editable elections are available' : undefined}>
            <Select id="c-election" value={form.electionId} onChange={(e) => setForm({ ...form, electionId: e.target.value })}>
              <option value="">Select an election</option>
              {editable.map((e) => (
                <option key={e.electionId} value={e.electionId}>
                  {e.electionId} — {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Candidate name" htmlFor="c-name">
            <Input id="c-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Position" htmlFor="c-position">
            <Input id="c-position" required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </Field>
          <Field label="Statement" htmlFor="c-slogan" hint="Shown beneath the candidate on the ballot">
            <Input id="c-slogan" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
          </Field>
          {editable.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/70 px-3.5 py-3 text-[12px] text-ink/60">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0" />
              Create a draft election first, then return here to build its candidate list.
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
