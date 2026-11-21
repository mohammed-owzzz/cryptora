import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  CheckCircle2,
  Copy,
  Cpu,
  Fingerprint,
  Layers,
  Network,
  Search,
  ShieldCheck,
  ShieldX,
  Signature,
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
  useToast,
} from '../../components/ui';
import { BlockDetailModal, BlockTable } from '../../components/Ledger';
import { ValidatorNetwork } from '../../components/ValidatorNetwork';
import { ElectionsBarChart } from '../../components/Charts';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDateTime, formatNumber } from '../../lib/format';
import type { BlockSummary } from '../../lib/types';

interface LedgerVerification {
  valid: boolean;
  blocks: number;
  transactions: number;
  signaturesChecked: number;
  errors: string[];
  checkedAt: string;
}


/* ------------------------------ Consortium -------------------------------- */

export function AdminBlockchain() {
  const { data, loading } = useApi<{ height: number; blocks: BlockSummary[] }>('/api/admin/blockchain/blocks');
  const { data: validatorsData } = useApi<{
    threshold: number;
    blockHeight: number;
    validators: { id: string; validatorId: string; name: string; publicKey: string; active: boolean; signatures: number; uptime: number }[];
  }>('/api/admin/validators');
  const { push } = useToast();
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<LedgerVerification | null>(null);
  const [openBlock, setOpenBlock] = useState<number | null>(null);

  const verify = async () => {
    setVerifying(true);
    try {
      const outcome = await api.post<LedgerVerification>('/api/admin/blockchain/verify');
      setResult(outcome);
      push({
        title: outcome.valid ? 'Ledger integrity valid' : 'Integrity failure detected',
        description: `${outcome.blocks} blocks, ${outcome.transactions} transactions, ${outcome.signaturesChecked} signatures checked.`,
        tone: outcome.valid ? 'success' : 'error',
      });
    } catch (err: any) {
      push({ title: 'Verification failed', description: err?.message, tone: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const txPerBlock = (data?.blocks ?? [])
    .slice(0, 8)
    .reverse()
    .map((b) => ({ label: `#${b.blockNumber}`, value: b.txCount }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Consortium Network"
        description="Five validator identities hold independent Ed25519 keypairs. A block is only final once four of the five sign its hash."
        actions={
          <Button variant="lime" loading={verifying} onClick={verify}>
            <ShieldCheck className="h-4 w-4" /> Verify ledger
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Chain height', `#${data?.height ?? 0}`],
          ['Blocks', formatNumber(data?.blocks.length ?? 0)],
          ['Validator set', `${validatorsData?.validators.filter((v) => v.active).length ?? 0} / 5`],
          ['Quorum', `${validatorsData?.threshold ?? 4} of 5`],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[21px] font-bold leading-none">{value}</p>
          </div>
        ))}
      </div>

      {result && (
        <Callout
          tone={result.valid ? 'lime' : 'danger'}
          icon={result.valid ? <CheckCircle2 className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
          title={result.valid ? 'Chain verified from genesis' : 'Integrity failure'}
        >
          {result.valid
            ? `Every hash link, Merkle root and signature across ${formatNumber(result.blocks)} blocks and ${formatNumber(
                result.transactions,
              )} transactions was recomputed and matched.`
            : result.errors.join(' · ')}
        </Callout>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <SectionHeading title="Validator topology" description="Quorum is reached when four nodes return the same block hash." />
          <ValidatorNetwork
            validators={(validatorsData?.validators ?? []).map((v) => ({
              validatorId: v.validatorId,
              name: v.name,
              active: v.active,
              publicKey: v.publicKey,
            }))}
            height={260}
          />
        </Card>
        <Card>
          <SectionHeading title="Transactions per block" description="The eight most recent blocks." />
          <div className="mt-4">
            {loading ? (
              <LoadingBlock rows={3} />
            ) : (
              <ElectionsBarChart data={txPerBlock} height={240} />
            )}
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <SectionHeading title="Recent blocks" description="Newest first. Select a block to inspect its signatures." />
          <Link to="/admin/ledger" className="link-quiet">
            Open ledger explorer
          </Link>
        </div>
        <div className="mt-4">
          <BlockTable blocks={(data?.blocks ?? []).slice(0, 8)} loading={loading} onOpen={setOpenBlock} />
        </div>
      </Card>

      <BlockDetailModal blockNumber={openBlock} onClose={() => setOpenBlock(null)} path="/api/admin/blockchain/blocks" />
    </div>
  );
}

/* -------------------------------- Ledger --------------------------------- */

export function AdminLedger() {
  const { data, loading } = useApi<{ height: number; blocks: BlockSummary[] }>('/api/admin/blockchain/blocks');
  const [query, setQuery] = useState('');
  const [minApprovals, setMinApprovals] = useState('ALL');
  const [openBlock, setOpenBlock] = useState<number | null>(null);

  const blocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.blocks ?? []).filter((b) => {
      const matchesHash = !q || b.blockHash.toLowerCase().includes(q) || b.merkleRoot.toLowerCase().includes(q) || String(b.blockNumber) === q;
      const matchesApprovals =
        minApprovals === 'ALL' || (minApprovals === 'QUORUM' ? b.approvals >= 4 : b.approvals < 4);
      return matchesHash && matchesApprovals;
    });
  }, [data, query, minApprovals]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction Ledger"
        description="An append-only chain. Any change to a committed block breaks every hash that follows it."
        actions={
          <Button to="/admin/blockchain" variant="outline">
            <Network className="h-4 w-4" /> Network view
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Chain height', `#${data?.height ?? 0}`],
          ['Blocks in window', formatNumber(blocks.length)],
          ['Hash function', 'SHA-256 (canonical JSON header)'],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[19px] font-bold leading-none">{value}</p>
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
              placeholder="Search by block number or hash"
              className="h-9 w-[300px] max-w-full rounded-lg border border-line bg-white pl-9 pr-3 font-mono text-[12px] focus:outline-none"
            />
          </div>
          <Select value={minApprovals} onChange={(e) => setMinApprovals(e.target.value)} className="h-9 w-[190px] text-[12.5px]">
            <option value="ALL">All blocks</option>
            <option value="QUORUM">Quorum reached</option>
            <option value="BELOW">Below quorum</option>
          </Select>
        </div>
        <BlockTable blocks={blocks} loading={loading} onOpen={setOpenBlock} />
        {!loading && blocks.length === 0 && (
          <div className="p-6">
            <EmptyState icon={<Layers className="h-5 w-5" />} title="No blocks match this filter" description="Clear the search to see the whole chain window." />
          </div>
        )}
      </Card>

      <BlockDetailModal blockNumber={openBlock} onClose={() => setOpenBlock(null)} path="/api/admin/blockchain/blocks" />
    </div>
  );
}

/* ------------------------------- Validators ------------------------------ */

export function AdminValidators() {
  const { data, loading } = useApi<{
    blockHeight: number;
    threshold: number;
    validators: { id: string; validatorId: string; name: string; publicKey: string; active: boolean; signatures: number; uptime: number }[];
  }>('/api/admin/validators');
  const { push } = useToast();

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    push({ title: 'Public key copied', tone: 'info' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Validator Nodes"
        description="Each validator runs the same block-validation routine: recompute the header hash, verify every transaction Merkle root and check the previous hash link."
      />

      <Callout tone="neutral" icon={<Boxes className="h-4 w-4" />} title="Simulation boundary">
        The five validators are independent database identities with genuine Ed25519 keypairs and independent validation
        code paths, but they execute inside a single Node process rather than on five machines. This is stated explicitly
        in the project documentation.
      </Callout>

      {loading ? (
        <LoadingBlock rows={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.validators ?? []).map((v) => (
            <Card key={v.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-lime/40 bg-lime-soft text-[#4c6b10]">
                    <Cpu className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">{v.validatorId}</p>
                    <p className="text-[11px] text-ink/45">{v.name}</p>
                  </div>
                </div>
                <Badge tone={v.active ? 'lime' : 'danger'}>{v.active ? 'Active' : 'Offline'}</Badge>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-2">
                <Fingerprint className="h-3.5 w-3.5 shrink-0 text-ink/35" />
                <p className="mono truncate text-[10.5px] text-ink/55">{v.publicKey}</p>
                <button onClick={() => copy(v.publicKey)} className="ml-auto text-ink/35 hover:text-ink" aria-label="Copy public key">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                <div className="rounded-lg border border-line px-2.5 py-2">
                  <dt className="stat-label">Signatures</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{formatNumber(v.signatures)}</dd>
                </div>
                <div className="rounded-lg border border-line px-2.5 py-2">
                  <dt className="stat-label">Uptime</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{v.uptime}%</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <SectionHeading title="Consensus parameters" description="Applied uniformly to every block in the chain." />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['Threshold', `${data?.threshold ?? 4} of 5 signatures`],
            ['Signature scheme', 'Ed25519 over the SHA-256 block header'],
            ['Failure rule', 'A block below quorum is rejected and never appended'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line px-3.5 py-3">
              <p className="stat-label">{label}</p>
              <p className="mt-1 text-[12.5px] text-ink/65">{value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------- ZKP ---------------------------------- */

interface ZkpRecord {
  id: string;
  electionId: string;
  nullifierPrefix: string;
  status: string;
  provenance: string;
  verificationMs: number | null;
  createdAt: string;
}

export function AdminZkp() {
  const { data, loading } = useApi<{
    circuit: { name: string; depth: number; fieldPrime: string; protocol: string; curve: string };
    artifactsReady: boolean;
    stats: { verified: number; rejected: number; seeded: number; live: number };
    proofs: ZkpRecord[];
  }>('/api/admin/zkp');

  return (
    <div className="space-y-5">
      <PageHeader
        title="ZKP Verification"
        description="Eligibility is proven with a Groth16 proof over a depth-13 Poseidon Merkle tree. The proof reveals the root, the election and a nullifier — nothing else."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Verified proofs', formatNumber(data?.stats.verified ?? 0)],
          ['Rejected proofs', formatNumber(data?.stats.rejected ?? 0)],
          ['Live proofs', formatNumber(data?.stats.live ?? 0)],
          ['Seeded records', formatNumber(data?.stats.seeded ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="surface-card px-4 py-3.5">
            <p className="stat-label">{label}</p>
            <p className="mt-1 font-display text-[21px] font-bold leading-none">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <SectionHeading title="Circuit parameters" description="Compiled with circom2 and a local powers-of-tau ceremony." />
          <dl className="mt-4 space-y-2">
            {[
              ['Circuit', `${data?.circuit.name ?? 'eligibility'}.circom`],
              ['Protocol', (data?.circuit.protocol ?? 'groth16').toUpperCase()],
              ['Curve', data?.circuit.curve ?? 'bn128'],
              ['Merkle depth', String(data?.circuit.depth ?? 13)],
              ['Public signals', 'root, electionId, nullifier'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="text-[11.5px] text-ink/50">{label}</span>
                <span className="mono text-[11.5px] font-medium">{value}</span>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <Badge tone={data?.artifactsReady ? 'lime' : 'danger'}>
              {data?.artifactsReady ? 'Proving artifacts present' : 'Artifacts missing'}
            </Badge>
          </div>
        </Card>

        <Card>
          <SectionHeading title="How a proof is produced" description="The witness stays in the voter's browser." />
          <ol className="mt-4 space-y-3">
            {[
              'The voter authenticates and requests only their own witness material over the session.',
              'The browser derives the credential secret, builds the Poseidon path and computes the nullifier.',
              'snarkjs.fullProve generates a Groth16 proof against the published verification key.',
              'Only the proof and the three public signals are transmitted; the witness is discarded.',
              'The server verifies against the verification key before the ballot is accepted.',
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-[12.5px] leading-relaxed text-ink/65">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-ink/50">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <SectionHeading
            title="Proof records"
            description="Live records were produced by this browser prover. Seeded records belong to the demonstration dataset."
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Proof</th>
                <th>Election</th>
                <th>Nullifier</th>
                <th>Provenance</th>
                <th className="text-right">Verify time</th>
                <th>Status</th>
                <th>Created</th>
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
              {(data?.proofs ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="mono text-[11px] text-ink/55">{p.id.slice(0, 10)}</td>
                  <td className="text-[12px]">{p.electionId}</td>
                  <td className="mono text-[11px] text-ink/45">{p.nullifierPrefix}…</td>
                  <td>
                    <Badge tone={p.provenance === 'LIVE' ? 'lime' : 'outline'} dot={false}>
                      {p.provenance}
                    </Badge>
                  </td>
                  <td className="text-right tabular-nums text-ink/60">{p.verificationMs ? `${p.verificationMs} ms` : '—'}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDateTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Callout tone="neutral" icon={<Signature className="h-4 w-4" />} title="Honest limitation">
        The circuit proves eligibility and single-use nullifiers. It does not prove ballot well-formedness — that every
        encrypted vector is exactly one-hot. That property is currently enforced by server-side length checks and the
        commitment binding, not by a range proof.
      </Callout>
    </div>
  );
}
