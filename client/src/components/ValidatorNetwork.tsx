import { Boxes, Shield } from 'lucide-react';

/**
 * Consortium topology illustration. Five validator nodes joined in a ring with a
 * consensus shield at the centre — the same visual language as the reference
 * dashboards, drawn from live validator state.
 */
export function ValidatorNetwork({
  validators,
  className = '',
  height = 220,
  compact = false,
}: {
  validators: { validatorId: string; active: boolean; name?: string }[];
  className?: string;
  height?: number;
  compact?: boolean;
}) {
  const nodes = validators.length > 0 ? validators.slice(0, 5) : Array.from({ length: 5 }, (_, i) => ({ validatorId: `VAL-0${i + 1}`, active: true }));
  const center = { x: 50, y: 50 };
  const radius = compact ? 31 : 34;
  const points = nodes.map((_, i) => {
    const angle = (Math.PI * 2 * i) / nodes.length - Math.PI / 2;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {points.map((p, i) =>
          points.slice(i + 1).map((q, j) => (
            <line
              key={`${i}-${j}`}
              x1={p.x}
              y1={p.y}
              x2={q.x}
              y2={q.y}
              stroke="#DCE3D0"
              strokeWidth="0.35"
              strokeDasharray="1.4 1.6"
            />
          )),
        )}
        {points.map((p, i) => (
          <line key={`c${i}`} x1={p.x} y1={p.y} x2={center.x} y2={center.y} stroke="#E7EADF" strokeWidth="0.25" />
        ))}
        <circle cx={center.x} cy={center.y} r={compact ? 13 : 12} fill="#F0F6E0" />
      </svg>

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-lime/60 bg-white shadow-card">
          <Shield className="h-4 w-4 text-[#4c6b10]" />
        </span>
        {!compact && <span className="mt-1 text-[10.5px] font-medium text-ink/45">Consensus</span>}
      </div>

      {points.map((p, i) => {
        const node = nodes[i];
        return (
          <div
            key={node.validatorId}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white shadow-card">
              <Boxes className="h-3.5 w-3.5 text-ink/60" />
              <span
                className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white ${node.active ? 'bg-[#8FD01A]' : 'bg-[#D92D20]'}`}
              />
            </span>
            {!compact && (
              <span className="whitespace-nowrap rounded-full border border-line bg-white px-1.5 py-0.5 text-[8.5px] font-semibold text-ink/55">
                Validator {node.validatorId.slice(-2)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VoteTallyBar({
  name,
  votes,
  share,
  winner,
}: {
  name: string;
  votes: number;
  share: number;
  winner?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          {name}
          {winner && (
            <span className="rounded-md bg-[#F2FADF] px-2 py-0.5 text-[10.5px] font-medium text-[#4c6b10]">
              Leading
            </span>
          )}
        </p>
        <p className="text-[12.5px] tabular-nums text-ink/60">
          <span className="font-semibold text-ink">{votes.toLocaleString()}</span> · {share.toFixed(1)}%
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${winner ? 'bg-[#A8E02F]' : 'bg-ink/15'}`}
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>
    </div>
  );
}
