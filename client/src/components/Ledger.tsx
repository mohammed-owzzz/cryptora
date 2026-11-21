import { useEffect, useState } from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { Badge, LoadingBlock, Modal, SectionHeading, StatusBadge } from './ui';
import { api } from '../lib/api';
import { formatDateTime, shortHash } from '../lib/format';
import type { BlockDetail, BlockSummary } from '../lib/types';

/** Block list shared by the admin ledger explorer and the auditor workspace. */
export function BlockTable({
  blocks,
  onOpen,
  loading,
}: {
  blocks: BlockSummary[];
  onOpen: (blockNumber: number) => void;
  loading: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Block</th>
            <th>Hash</th>
            <th>Previous</th>
            <th className="text-right">Tx</th>
            <th className="text-right">Approvals</th>
            <th>Consensus</th>
            <th>Committed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8}>
                <LoadingBlock rows={6} />
              </td>
            </tr>
          )}
          {blocks.map((b) => (
            <tr key={b.blockNumber} className="cursor-pointer" onClick={() => onOpen(b.blockNumber)}>
              <td className="font-semibold tabular-nums">#{b.blockNumber}</td>
              <td className="mono text-[11px] text-ink/55">{shortHash(b.blockHash, 12, 8)}</td>
              <td className="mono text-[11px] text-ink/40">{shortHash(b.previousHash, 10, 6)}</td>
              <td className="text-right tabular-nums text-ink/70">{b.txCount}</td>
              <td className="text-right">
                <span className={b.approvals >= 4 ? 'font-semibold text-[#4c6b10]' : 'font-semibold text-red-600'}>
                  {b.approvals}/5
                </span>
              </td>
              <td>
                <StatusBadge status={b.consensus} />
              </td>
              <td className="whitespace-nowrap text-[11.5px] text-ink/45">{formatDateTime(b.timestamp)}</td>
              <td className="text-right">
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-ink/30" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Block inspector. `path` is the role-scoped detail endpoint without the block
 * number, e.g. `/api/admin/blockchain/blocks` or `/api/auditor/ledger`.
 */
export function BlockDetailModal({
  blockNumber,
  onClose,
  path,
}: {
  blockNumber: number | null;
  onClose: () => void;
  path: string;
}) {
  const [detail, setDetail] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (blockNumber === null) return;
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<BlockDetail>(`${path}/${blockNumber}`)
      .then((result) => {
        if (active) setDetail(result);
      })
      .catch((err: any) => {
        if (active) setError(err?.message ?? 'Unable to load the block');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [blockNumber, path]);

  return (
    <Modal
      open={blockNumber !== null}
      onClose={() => {
        setDetail(null);
        setError(null);
        onClose();
      }}
      title={blockNumber !== null ? `Block #${blockNumber}` : 'Block'}
      description="Every field below is covered by the validator signatures over the block hash."
      width="max-w-3xl"
    >
      {loading && <LoadingBlock rows={4} />}
      {error && <p className="text-[12.5px] text-red-600">{error}</p>}
      {detail && !loading && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['Block hash', detail.blockHash],
              ['Previous hash', detail.previousHash],
              ['Transaction Merkle root', detail.merkleRoot],
              ['Committed at', formatDateTime(detail.timestamp)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line px-3 py-2">
                <p className="stat-label">{label}</p>
                <p className="mono mt-1 break-all text-[11px] text-ink/65">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={detail.approvals >= 4 ? 'lime' : 'danger'}>{detail.approvals} of 5 validator approvals</Badge>
            {detail.consensusRound && (
              <Badge tone="outline" dot={false}>
                {detail.consensusRound.votes} signatures · quorum {detail.consensusRound.required}
              </Badge>
            )}
            <Badge tone="outline" dot={false}>
              {detail.txCount} transactions
            </Badge>
          </div>

          <div>
            <SectionHeading title="Validator signatures" description="Ed25519 signatures over the canonical block header." />
            <div className="mt-3 space-y-1.5">
              {detail.signatures.map((s) => (
                <div key={s.validatorId} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium">
                      {s.validatorId}
                      {s.name ? ` · ${s.name}` : ''}
                    </p>
                    <p className="mono truncate text-[10.5px] text-ink/40">{s.signature}</p>
                  </div>
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#4c6b10]" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading title="Transactions" description="Ordered as included in the block." />
            <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto scrollbar-thin">
              {detail.transactions.map((t) => (
                <div key={t.txHash} className="rounded-lg border border-line px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium">{t.label}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mono mt-0.5 text-[10.5px] text-ink/40">{shortHash(t.txHash, 14, 10)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
