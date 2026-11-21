import { useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Filter, Search, Settings2, ShieldCheck } from 'lucide-react';
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
  useToast,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { downloadFile } from '../../lib/api';
import { formatDateTime, formatNumber, formatPercent } from '../../lib/format';

/* ------------------------------- Audit logs ------------------------------- */

interface AuditRow {
  id: string;
  action: string;
  actor: string;
  actorRole: string;
  target: string | null;
  detail: string;
  ip: string | null;
  createdAt: string;
}

export function AdminAuditLogs() {
  const { data, loading, refetch } = useApi<AuditRow[]>('/api/admin/audit-logs');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('ALL');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (l) =>
        (role === 'ALL' || l.actorRole === role) &&
        (!q ||
          l.action.toLowerCase().includes(q) ||
          l.detail.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q) ||
          (l.target ?? '').toLowerCase().includes(q)),
    );
  }, [data, query, role]);

  const exportCsv = () => {
    const header = 'timestamp,action,actor,role,target,detail,ip';
    const body = rows.map((r) => [r.createdAt, r.action, r.actor, r.actorRole, r.target ?? '', r.detail, r.ip ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cryptora-audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Every privileged action is recorded with its actor, target and source address. Entries are append-only."
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search action, actor or target"
              className="h-9 w-[300px] max-w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[12.5px] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="outline" dot={false}>
              {formatNumber(rows.length)} events
            </Badge>
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-[150px] text-[12.5px]">
              <option value="ALL">All roles</option>
              <option value="ADMIN">Admin</option>
              <option value="VOTER">Voter</option>
              <option value="AUDITOR">Auditor</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Detail</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6}>
                    <LoadingBlock rows={6} />
                  </td>
                </tr>
              )}
              {rows.slice(0, 100).map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-[11.5px] text-ink/50">{formatDateTime(l.createdAt)}</td>
                  <td>
                    <span className="mono rounded bg-surface px-1.5 py-0.5 text-[10.5px] font-medium text-ink/65">{l.action}</span>
                  </td>
                  <td className="text-[12px]">
                    {l.actor}
                    <span className="block text-[11px] text-ink/40">{l.actorRole.toLowerCase()}</span>
                  </td>
                  <td className="mono text-[11px] text-ink/50">{l.target ?? '—'}</td>
                  <td className="max-w-[320px] text-[11.5px] text-ink/60">{l.detail}</td>
                  <td className="mono text-[11px] text-ink/40">{l.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div className="p-6">
              <EmptyState icon={<Filter className="h-5 w-5" />} title="No audit events match" description="Change the filter or clear the search field." />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- Reports -------------------------------- */

interface ReportRow {
  electionId: string;
  name: string;
  status: string;
  registeredVoters: number;
  ballots: number;
  proofs: number;
  tallyPublished: boolean;
  results: { name: string; votes: number }[];
}

export function AdminReports() {
  const { data, loading } = useApi<{ reports: ReportRow[] }>('/api/admin/reports');
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (electionId: string, format: 'csv' | 'pdf') => {
    setBusy(`${electionId}-${format}`);
    try {
      await downloadFile(
        `/api/admin/reports/${electionId}/${format}`,
        `cryptora-audit-${electionId}.${format}`,
      );
      push({ title: 'Report downloaded', description: `${electionId} ${format.toUpperCase()} export generated.` });
    } catch (err: any) {
      push({ title: 'Export failed', description: err?.message, tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Generate a signed-off audit package for any election: registry size, ballot counts, proof results, consensus participation, ledger state and the published tally."
      />

      <Callout tone="blue" icon={<FileText className="h-4 w-4" />} title="Report contents">
        CSV and PDF exports are rendered server-side from the live database at request time. They include the ledger
        verification result computed during generation, not a cached value.
      </Callout>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Election</th>
                <th>Status</th>
                <th className="text-right">Registered</th>
                <th className="text-right">Ballots</th>
                <th className="text-right">Proofs</th>
                <th>Tally</th>
                <th className="text-right">Export</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7}>
                    <LoadingBlock rows={5} />
                  </td>
                </tr>
              )}
              {(data?.reports ?? []).map((r) => (
                <tr key={r.electionId}>
                  <td>
                    <p className="text-[12.5px] font-medium">{r.name}</p>
                    <p className="text-[10.5px] text-ink/40">{r.electionId}</p>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(r.registeredVoters)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(r.ballots)}</td>
                  <td className="text-right tabular-nums text-ink/70">{formatNumber(r.proofs)}</td>
                  <td>
                    <Badge tone={r.tallyPublished ? 'lime' : 'neutral'}>{r.tallyPublished ? 'Published' : 'Pending'}</Badge>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={busy === `${r.electionId}-csv`}
                        onClick={() => download(r.electionId, 'csv')}
                      >
                        CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        loading={busy === `${r.electionId}-pdf`}
                        onClick={() => download(r.electionId, 'pdf')}
                      >
                        PDF
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- Settings ------------------------------- */

interface SettingsShape {
  environment: string;
  consensusThreshold: number;
  validators: number;
  sessionTtlHours: number;
  database: string;
  zkp: { name: string; depth: number; protocol: string; curve: string; artifactsReady: boolean; prover: string };
  accounts: number;
  activeSessions: number;
  demoMode: boolean;
}

export function AdminSettings() {
  const { data, loading } = useApi<SettingsShape>('/api/admin/settings');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Runtime configuration read directly from the server environment. Values here are intentionally not editable at runtime."
      />

      {loading || !data ? (
        <LoadingBlock rows={5} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <SectionHeading title="Platform" description="Deployment-level configuration." />
              <dl className="mt-4 space-y-2">
                {[
                  ['Environment', data.environment],
                  ['Database', data.database],
                  ['Registered accounts', formatNumber(data.accounts)],
                  ['Active sessions', formatNumber(data.activeSessions)],
                  ['Session lifetime', `${data.sessionTtlHours} hours`],
                  ['Demonstration mode', data.demoMode ? 'Enabled' : 'Disabled'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <span className="text-[11.5px] text-ink/50">{label}</span>
                    <span className="text-[12px] font-medium">{value}</span>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <SectionHeading title="Consensus & zero-knowledge" description="Parameters enforced by the backend." />
              <dl className="mt-4 space-y-2">
                {[
                  ['Validator set', `${data.validators} nodes`],
                  ['Approval threshold', `${data.consensusThreshold} of ${data.validators}`],
                  ['Circuit', `${data.zkp.name}.circom`],
                  ['Protocol / curve', `${data.zkp.protocol} · ${data.zkp.curve}`],
                  ['Merkle depth', String(data.zkp.depth)],
                  ['Prover location', data.zkp.prover],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <span className="text-[11.5px] text-ink/50">{label}</span>
                    <span className="mono text-[11.5px] font-medium">{value}</span>
                  </div>
                ))}
              </dl>
              <div className="mt-3">
                <Badge tone={data.zkp.artifactsReady ? 'lime' : 'danger'}>
                  {data.zkp.artifactsReady ? 'Circuit artifacts ready' : 'Circuit artifacts missing'}
                </Badge>
              </div>
            </Card>
          </div>

          <Card>
            <SectionHeading title="Security controls in force" description="These are not toggles — they are enforced in code." />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ['Role-based access control', 'Admin, voter and auditor routes each require their own role claim.'],
                ['Same-origin mutation guard', 'State-changing API requests reject foreign origins.'],
                ['Rate-limited authentication', 'Eight failed attempts per ten minutes per identifier.'],
                ['Hashed session tokens', 'Only SHA-256 digests of session tokens are stored.'],
                ['No plaintext ballots', 'The server stores Paillier ciphertexts only.'],
                ['Sealed voter linkage', 'Ballot rows are never joined to a candidate selection in any API response.'],
              ].map(([title, detail]) => (
                <div key={title} className="flex items-start gap-2.5 rounded-xl border border-line px-3.5 py-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4c6b10]" />
                  <div>
                    <p className="text-[12.5px] font-semibold">{title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink/55">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* --------------------------------- Results -------------------------------- */

export function AdminResults() {
  const { data, loading } = useApi<{ reports: ReportRow[] }>('/api/admin/reports');
  const [selected, setSelected] = useState<string>('');
  const reports = data?.reports ?? [];
  const active = reports.find((r) => r.electionId === selected) ?? reports.find((r) => r.tallyPublished) ?? reports[0];

  const total = active?.results.reduce((s, r) => s + r.votes, 0) ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Results"
        description="Decrypted aggregate totals per election. Individual ballots are never decrypted in this workflow."
        actions={
          <Select
            value={active?.electionId ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            className="h-10 w-[300px] text-[12.5px]"
          >
            {reports.map((r) => (
              <option key={r.electionId} value={r.electionId}>
                {r.electionId} — {r.name}
              </option>
            ))}
          </Select>
        }
      />

      {loading || !active ? (
        <LoadingBlock rows={5} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Registered voters', formatNumber(active.registeredVoters)],
              ['Ballots accepted', formatNumber(active.ballots)],
              ['Participation', formatPercent(active.registeredVoters ? (active.ballots / active.registeredVoters) * 100 : 0)],
              ['Proof records', formatNumber(active.proofs)],
            ].map(([label, value]) => (
              <div key={label} className="surface-card px-4 py-3.5">
                <p className="stat-label">{label}</p>
                <p className="mt-1 font-display text-[21px] font-bold leading-none">{value}</p>
              </div>
            ))}
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading title={active.name} description={`${active.electionId} · ${active.status}`} />
              <StatusBadge status={active.tallyPublished ? 'COMPLETED' : active.status} />
            </div>

            {!active.tallyPublished ? (
              <div className="mt-5">
                <EmptyState
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="Tally not published"
                  description="Results appear once the election is closed and the aggregate ciphertexts are decrypted."
                />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {active.results
                  .slice()
                  .sort((a, b) => b.votes - a.votes)
                  .map((r, i) => {
                    const share = total ? (r.votes / total) * 100 : 0;
                    return (
                      <div key={r.name}>
                        <div className="flex items-end justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-ink/50">
                              {i + 1}
                            </span>
                            <p className="text-[13px] font-medium">{r.name}</p>
                            {i === 0 && <Badge tone="lime">Leading</Badge>}
                          </div>
                          <div className="text-right">
                            <p className="text-[13px] font-semibold tabular-nums">{formatNumber(r.votes)}</p>
                            <p className="text-[10.5px] text-ink/40">{formatPercent(share)}</p>
                          </div>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                          <div
                            className={`h-full rounded-full ${i === 0 ? 'bg-lime' : 'bg-ink/25'}`}
                            style={{ width: `${Math.max(share, 1.5)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                <div className="flex items-center justify-between border-t border-line pt-3 text-[11.5px] text-ink/45">
                  <span>{formatNumber(total)} aggregate votes</span>
                  <span>Decrypted with the election tally key after closure</span>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      <Callout tone="neutral" icon={<Settings2 className="h-4 w-4" />} title="Custody model">
        The Paillier private key for each election is stored on the server in this prototype. A production deployment would
        split it across independent trustees with a threshold decryption ceremony.
      </Callout>
    </div>
  );
}
