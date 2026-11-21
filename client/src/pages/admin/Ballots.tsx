import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Search, Vote } from 'lucide-react';
import { Badge, Button, Callout, Card, EmptyState, LoadingBlock, PageHeader, SectionHeading, Select } from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { formatDateTime, formatNumber, shortHash } from '../../lib/format';

interface BallotRow {
  receiptCode: string;
  electionId: string;
  electionName: string;
  blockNumber: number | null;
  committedAt: string;
  nullifierPrefix: string;
  scheme: string;
  ciphertextCount: number;
  commitment: string | null;
}

interface ElectionOption {
  electionId: string;
  name: string;
  votesCast: number;
  status: string;
}

export default function AdminBallots() {
  const [electionId, setElectionId] = useState('');
  const [query, setQuery] = useState('');
  const path = `/api/admin/ballots${electionId ? `?electionId=${encodeURIComponent(electionId)}` : ''}`;
  const { data, loading, refetch } = useApi<{ total: number; note: string; ballots: BallotRow[] }>(path, [electionId]);
  const { data: elections } = useApi<ElectionOption[]>('/api/admin/elections');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data?.ballots ?? [];
    return (data?.ballots ?? []).filter(
      (b) => b.receiptCode.toLowerCase().includes(q) || b.nullifierPrefix.toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ballot Management"
        description="Accepted ballots are stored as Paillier ciphertext vectors. The plaintext selection never exists on the server in this workflow."
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      <Callout tone="blue" icon={<Lock className="h-4 w-4" />} title="What this page can and cannot show">
        Administrators can inspect receipt codes, ciphertext counts, commitments and the block each ballot landed in. The
        candidate chosen is mathematically inaccessible without the tally private key, and it is never joined to a voter
        identity in the database.
      </Callout>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Total ballots stored', formatNumber(data?.total ?? 0)],
          ['Listed in this view', formatNumber(data?.ballots.length ?? 0)],
          ['Encryption scheme', 'Paillier additive'],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[20px] font-bold leading-none">{value}</p>
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
              placeholder="Search receipt or nullifier"
              className="h-9 w-[260px] max-w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[12.5px] focus:outline-none"
            />
          </div>
          <Select value={electionId} onChange={(e) => setElectionId(e.target.value)} className="h-9 w-[280px] text-[12.5px]">
            <option value="">All elections</option>
            {(elections ?? []).map((e) => (
              <option key={e.electionId} value={e.electionId}>
                {e.electionId} — {e.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Election</th>
                <th className="text-right">Vector</th>
                <th>Nullifier</th>
                <th>Block</th>
                <th>Committed</th>
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
              {rows.map((b) => (
                <tr key={b.receiptCode}>
                  <td>
                    <p className="mono text-[11.5px] font-medium">{b.receiptCode}</p>
                    <p className="text-[10px] text-ink/40">commitment {shortHash(b.commitment, 10, 6)}</p>
                  </td>
                  <td>
                    <Link to={`/admin/elections/${b.electionId}`} className="text-[12px] hover:underline">
                      {b.electionName}
                    </Link>
                    <p className="text-[10px] text-ink/40">{b.electionId}</p>
                  </td>
                  <td className="text-right">
                    <Badge tone="outline" dot={false}>
                      {b.ciphertextCount} cts
                    </Badge>
                  </td>
                  <td className="mono text-[11px] text-ink/50">{b.nullifierPrefix}…</td>
                  <td className="text-[12px] tabular-nums text-ink/60">#{b.blockNumber}</td>
                  <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDateTime(b.committedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={<Vote className="h-5 w-5" />}
                title="No ballots in this view"
                description="Select another election or clear the search. Ballots appear here as soon as a voter's proof is accepted."
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Ballot acceptance pipeline"
          description="A ballot is only stored after all five stages below succeed."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {[
            ['01', 'Client proof', 'Groth16 proof generated in the voter browser'],
            ['02', 'Server verify', 'Proof checked against the circuit verification key'],
            ['03', 'Nullifier', 'Single-use nullifier recorded to stop double voting'],
            ['04', 'Consensus', 'Four of five validators sign the block header'],
            ['05', 'Commit', 'Ciphertexts plus commitment written to the ledger'],
          ].map(([step, title, detail]) => (
            <div key={step} className="rounded-xl border border-line p-3">
              <p className="text-[11px] font-medium text-ink/40">{step}</p>
              <p className="mt-1 text-[12px] font-semibold">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink/50">{detail}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
