import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search, UserPlus, Users } from 'lucide-react';
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
  SectionHeading,
  StatusBadge,
  useToast,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { csvEscape, formatDate, formatNumber, initials } from '../../lib/format';

interface VoterRow {
  id: string;
  voterNumber: string;
  name: string;
  email: string;
  faculty: string;
  district: string | null;
  eligibility: string;
  registeredElections: number;
  ballotsCast: number;
  verifiedAt: string;
}

const PAGE_SIZE = 12;

export default function AdminVoters() {
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  const { data, loading, refetch } = useApi<{
    total: number;
    summary?: { eligible: number; voted: number; faculties: number };
    voters: VoterRow[];
  }>(`/api/admin/voters?limit=200${term ? `&search=${encodeURIComponent(term)}` : ''}`);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', voterNumber: '', faculty: '', district: '' });

  useEffect(() => {
    const id = window.setTimeout(() => {
      setTerm(query.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const filtered = data?.voters ?? [];

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const stats = useMemo(
    () => ({
      total: data?.total ?? 0,
      verified: data?.summary?.eligible ?? 0,
      voted: data?.summary?.voted ?? 0,
      faculties: data?.summary?.faculties ?? 0,
    }),
    [data],
  );

  const addVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/admin/voters', {
        name: form.name,
        email: form.email,
        voterNumber: form.voterNumber,
        faculty: form.faculty || 'General',
        district: form.district || undefined,
      });
      push({ title: 'Voter registered', description: `${form.name} was added to the registry.` });
      setAddOpen(false);
      setForm({ name: '', email: '', voterNumber: '', faculty: '', district: '' });
      await refetch();
    } catch (err: any) {
      push({ title: 'Registration failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = 'voterNumber,name,email,faculty,eligibility,registeredElections,ballotsCast';
    const body = filtered
      .map((v) =>
        [v.voterNumber, v.name, v.email, v.faculty, v.eligibility, v.registeredElections, v.ballotsCast]
          .map(csvEscape)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cryptora-voter-registry.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Voter Registry"
        description="Every registered account is committed to each election as a Poseidon Merkle leaf. Secrets are generated server-side and never exported."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export view
            </Button>
            <Button variant="lime" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" /> Register voter
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Registry entries', formatNumber(stats.total)],
          ['Eligible accounts', formatNumber(stats.verified)],
          ['Have cast a ballot', formatNumber(stats.voted)],
          ['Faculties', String(stats.faculties)],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[21px] font-bold leading-none">{value}</p>
          </div>
        ))}
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search by name, voter number, email or faculty"
              className="h-9 w-[320px] max-w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[12.5px] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-ink/45">
            <Badge tone="outline" dot={false}>
              {formatNumber(filtered.length)} shown
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Voter</th>
                <th>Faculty</th>
                <th className="text-right">Elections</th>
                <th className="text-right">Ballots</th>
                <th>Status</th>
                <th>Registered</th>
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
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-[10.5px] font-semibold text-ink/55">
                        {initials(v.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium">{v.name}</p>
                        <p className="truncate text-[10.5px] text-ink/40">
                          {v.voterNumber} · {v.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-[12px] text-ink/65">
                    {v.faculty}
                    {v.district && <span className="block text-[10.5px] text-ink/35">{v.district}</span>}
                  </td>
                  <td className="text-right tabular-nums text-ink/70">{v.registeredElections}</td>
                  <td className="text-right tabular-nums text-ink/70">{v.ballotsCast}</td>
                  <td>
                    <StatusBadge status={v.eligibility} />
                  </td>
                  <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDate(v.verifiedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No voters match this search"
                description="Try a different name or voter number, or register a new account."
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[11.5px] text-ink/50">
          <span>
            Page {current + 1} of {pages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Registry integrity"
          description="Voter identities are separated from ballot contents at every layer of the system."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ['Commitment scheme', 'Poseidon(sha256(salt ‖ electionId)) over BN254'],
            ['Merkle depth', '13 — up to 8,192 eligible voters per election'],
            ['Ballot linkability', 'Prevented — receipts reference ciphertexts, not selections'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line px-3.5 py-3">
              <p className="stat-label">{label}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/65">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Register a voter"
        description="A credential salt is generated automatically and used to derive the voter's Merkle commitment."
        width="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="lime" loading={busy} onClick={addVoter as any}>
              Register
            </Button>
          </>
        }
      >
        <form onSubmit={addVoter} className="space-y-4">
          <Field label="Full name" htmlFor="v-name">
            <Input id="v-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Voter number" htmlFor="v-number">
              <Input
                id="v-number"
                required
                placeholder="VOTER-2027-0001"
                value={form.voterNumber}
                onChange={(e) => setForm({ ...form, voterNumber: e.target.value })}
              />
            </Field>
            <Field label="Faculty" htmlFor="v-faculty">
              <Input id="v-faculty" value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} />
            </Field>
          </div>
          <Field label="Email address" htmlFor="v-email">
            <Input id="v-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="District" htmlFor="v-district" hint="Optional">
            <Input id="v-district" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
          </Field>
          <p className="text-[11.5px] text-ink/45">
            A temporary password is generated. The account is locked until an administrator sets credentials through the
            provisioning workflow.
          </p>
        </form>
      </Modal>
    </div>
  );
}
