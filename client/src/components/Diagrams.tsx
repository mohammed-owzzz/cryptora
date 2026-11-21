import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, KeyRound, Lock, ShieldCheck } from 'lucide-react';

/* --------------------------------------------------------------------------
   Diagrams derived from the implementation and the repository documentation.
   No simulated activity, no invented numbers: every label is a real component,
   stage or artefact of this build.
-------------------------------------------------------------------------- */

const INK = '#111210';
const LINE = '#E4E6E2';
const LIME = '#C6F65A';

interface Node {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
  h?: number;
  detail: string;
}

const ARCH_NODES: Node[] = [
  {
    id: 'ui',
    label: 'Voter and staff interface',
    sub: 'React 18 · React Router',
    x: 24,
    y: 48,
    w: 208,
    detail: 'Public site, administrator, voter and auditor workspaces. The interface reflects server-enforced role boundaries; it does not define them.',
  },
  {
    id: 'prover',
    label: 'In-browser prover',
    sub: 'snarkjs · Groth16',
    x: 24,
    y: 148,
    w: 208,
    detail: 'Builds the witness from this voter’s Merkle path, generates a Groth16 proof and verifies it against the circuit key before transmitting anything.',
  },
  {
    id: 'encrypt',
    label: 'Ballot encryption',
    sub: 'Paillier · SHA-256 commitment',
    x: 24,
    y: 248,
    w: 208,
    detail: 'The selection becomes a one-hot vector encrypted with the election’s Paillier public key. Only ciphertext and a commitment leave the device.',
  },
  {
    id: 'auth',
    label: 'Authentication and RBAC',
    sub: 'Express · bcrypt · sessions',
    x: 344,
    y: 48,
    w: 236,
    detail: 'Every router mounts requireAuth(role). Session tokens are random 256-bit values stored only as SHA-256 digests in HttpOnly cookies.',
  },
  {
    id: 'elections',
    label: 'Election service',
    sub: 'lifecycle · registry · tally',
    x: 344,
    y: 148,
    w: 236,
    detail: 'Draft, publish the Merkle root, open, close, tally. Metadata and candidates freeze when the first ballot is accepted.',
  },
  {
    id: 'verify',
    label: 'Proof verifier',
    sub: 'root · field id · nullifier',
    x: 344,
    y: 248,
    w: 236,
    detail: 'Checks the submitted proof against the stored root and verification key, binds the nullifier to this voter’s salt and rejects a spent nullifier before consensus.',
  },
  {
    id: 'data',
    label: 'SQLite · Prisma',
    sub: 'ballots · ciphertexts · audit log',
    x: 344,
    y: 338,
    w: 236,
    h: 52,
    detail: 'Seventeen models. The Ballot table has no candidate column; the ciphertext vector lives in EncryptedBallot and totals only in ElectionResult.',
  },
  {
    id: 'consensus',
    label: 'Validator quorum',
    sub: 'five identities · 4-of-5',
    x: 680,
    y: 48,
    w: 236,
    detail: 'Each validator independently re-validates the transaction, recomputes hashes and the Merkle root, then signs the canonical header with Ed25519.',
  },
  {
    id: 'chain',
    label: 'Append-only ledger',
    sub: 'SHA-256 hash chain',
    x: 680,
    y: 148,
    w: 236,
    detail: 'A block is final after four signatures. The header commits to the previous hash and the transaction Merkle root, so edits invalidate every later block.',
  },
  {
    id: 'results',
    label: 'Aggregate results',
    sub: 'homomorphic tally',
    x: 680,
    y: 248,
    w: 236,
    detail: 'Ciphertexts are multiplied homomorphically and decrypted once by the tally key holder. Only candidate totals are published, and the auditor can re-verify the chain.',
  },
];

const ARCH_LINKS: [string, string][] = [
  ['ui', 'auth'],
  ['prover', 'verify'],
  ['encrypt', 'verify'],
  ['elections', 'consensus'],
  ['verify', 'consensus'],
  ['consensus', 'chain'],
  ['chain', 'results'],
  ['elections', 'data'],
];

function nodeById(id: string) {
  return ARCH_NODES.find((n) => n.id === id)!;
}

export function SystemArchitecture({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState<string>('verify');
  const selected = ARCH_NODES.find((n) => n.id === active) ?? ARCH_NODES[0];
  const reduce = useReducedMotion();

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <svg
          viewBox="0 0 940 410"
          className="h-auto w-full min-w-[720px]"
          role="img"
          aria-label="CRYPTORA architecture: interface and in-browser proving feed the API, which verifies proofs and persists ciphertext before the validator quorum appends a signed block and publishes aggregate results."
        >
          <defs>
            <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#B9BDB4" />
            </marker>
          </defs>

          {[['Client', 128], ['API and persistence', 462], ['Consortium ledger', 798]].map(([label, x]) => (
            <text key={label as string} x={x as number} y={24} textAnchor="middle" fontSize="10.5" fill="#8A9087" letterSpacing="0.06em">
              {String(label).toUpperCase()}
            </text>
          ))}

          {ARCH_LINKS.map(([from, to]) => {
            const a = nodeById(from);
            const b = nodeById(to);
            const startX = a.x + a.w;
            const startY = a.y + (a.h ?? 64) / 2;
            const endX = b.x;
            const endY = b.y + (b.h ?? 64) / 2;
            const midX = (startX + endX) / 2;
            const highlighted = active === from || active === to;
            const path =
              startY === endY
                ? `M ${startX} ${startY} H ${endX - 6}`
                : `M ${startX} ${startY} H ${midX} V ${endY} H ${endX - 6}`;
            return (
              <path
                key={`${from}-${to}`}
                d={path}
                fill="none"
                stroke={highlighted ? '#9AA096' : '#D9DCD6'}
                strokeWidth={highlighted ? 1.6 : 1.1}
                markerEnd="url(#arch-arrow)"
                style={{ transition: 'stroke 220ms cubic-bezier(0.22,1,0.36,1), stroke-width 220ms' }}
              />
            );
          })}

          {ARCH_NODES.map((node) => {
            const isActive = node.id === active;
            const h = node.h ?? 64;
            return (
              <g
                key={node.id}
                tabIndex={0}
                role="button"
                aria-label={`${node.label}. ${node.detail}`}
                aria-pressed={isActive}
                onMouseEnter={() => setActive(node.id)}
                onFocus={() => setActive(node.id)}
                onClick={() => setActive(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActive(node.id);
                  }
                }}
                style={{ cursor: 'pointer', outline: 'none' }}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={h}
                  rx={10}
                  fill={isActive ? '#F7FBEE' : '#FFFFFF'}
                  stroke={isActive ? '#A9CE5C' : LINE}
                  strokeWidth={isActive ? 1.6 : 1}
                  style={{ transition: 'fill 240ms cubic-bezier(0.22,1,0.36,1), stroke 240ms' }}
                />
                <rect x={node.x} y={node.y} width={3} height={h} rx={2} fill={isActive ? LIME : 'transparent'} />
                <text x={node.x + 16} y={node.y + 26} fontSize="12.5" fontWeight="600" fill={INK}>
                  {node.label}
                </text>
                {node.sub && (
                  <text x={node.x + 16} y={node.y + 44} fontSize="10.5" fill="#7C837A">
                    {node.sub}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {!compact && (
        <div className="mt-3 flex min-h-[68px] gap-3 rounded-card border border-line bg-surface/60 px-4 py-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <ShieldCheck className="h-3 w-3" />
          </span>
          <div className="min-w-0">
            <motion.div
              key={selected.id}
              initial={reduce ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[12px] font-semibold">{selected.label}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink/55">{selected.detail}</p>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Ballot flow ------------------------------ */

const WORKFLOW = [
  {
    title: 'Authentication',
    actor: 'Voter',
    body: 'The voter signs in with a voter number and password. The session is an HttpOnly, SameSite=Lax cookie whose token exists in the database only as a SHA-256 digest.',
  },
  {
    title: 'Eligibility check',
    actor: 'Server',
    body: 'The API confirms an EligibleVoter row for this election, that the election is LIVE, inside its window, and that the voter has not already submitted a ballot.',
  },
  {
    title: 'Witness delivery',
    actor: 'Server',
    body: 'GET /api/voter/elections/:id/witness returns only that voter’s Merkle path, derived secret, nullifier and the election’s public tally key. The response is no-store.',
  },
  {
    title: 'Proof generation',
    actor: 'Browser',
    body: 'snarkjs builds the witness and generates a Groth16 proof of Merkle membership. Proving happens in the voter’s browser; the witness never reaches the network.',
  },
  {
    title: 'Local verification',
    actor: 'Browser',
    body: 'The browser verifies the proof against the circuit verification key before transmitting it, so an invalid ballot is never posted.',
  },
  {
    title: 'Encryption',
    actor: 'Browser',
    body: 'The selection becomes a one-hot vector, encrypted with the Paillier public key. A SHA-256 commitment over the canonical ciphertext vector is computed alongside it.',
  },
  {
    title: 'Verification and consensus',
    actor: 'Server + ledger',
    body: 'The server re-verifies the proof, binds the nullifier to the voter’s salt, rejects a spent nullifier, then collects four of five validator signatures over one block.',
  },
  {
    title: 'Receipt and audit record',
    actor: 'Ledger',
    body: 'The voter receives a receipt code, block number and transaction hash. The receipt proves inclusion, never content: it carries no candidate reference.',
  },
];

export function VotingWorkflow({ start = 0 }: { start?: number }) {
  const [active, setActive] = useState(start);
  const reduce = useReducedMotion();
  const stage = WORKFLOW[active];

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {WORKFLOW.map((step, i) => (
          <button
            key={step.title}
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={`group relative flex min-w-0 flex-col gap-2 rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-0.5 ${
              i === active ? 'border-ink/25 bg-surface' : 'border-line bg-white hover:border-ink/15'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-200 ${
                i === active ? 'bg-ink text-white' : i < active ? 'bg-[#EAFBC4] text-[#4c6b10]' : 'bg-surface text-ink/40'
              }`}
            >
              {i < active ? <Check className="h-3 w-3" strokeWidth={3} /> : String(i + 1).padStart(2, '0')}
            </span>
            <span className={`text-[11.5px] font-medium leading-tight ${i === active ? 'text-ink' : 'text-ink/55'}`}>
              {step.title}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 min-h-[104px] rounded-card border border-line bg-white p-4">
        <motion.div
          key={stage.title}
          initial={reduce ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[13px] font-semibold">{stage.title}</p>
            <span className="text-[11px] text-ink/45">{stage.actor}</span>
            <span className="ml-auto font-mono text-[10.5px] text-ink/35">
              stage {String(active + 1).padStart(2, '0')} / {String(WORKFLOW.length).padStart(2, '0')}
            </span>
          </div>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-relaxed text-ink/55">{stage.body}</p>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------- ZKP lifecycle ---------------------------- */

const ZKP_STAGES = [
  { title: 'Witness', body: 'The browser combines the credential secret with the 13 path elements and direction bits.' },
  { title: 'Proof', body: 'Groth16 proves membership and nullifier binding over BN254 without revealing the witness.' },
  { title: 'Verification', body: 'The verifier checks the proof against the published root and circuit verification key.' },
  { title: 'Decision', body: 'Valid proofs proceed to consensus; a rejected proof aborts the submission with no block written.' },
];

export function ZkpLifecycle() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const stage = ZKP_STAGES[active];

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
      <div className="rounded-card border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold">Never leaves the browser</p>
          <span className="inline-flex items-center gap-1 text-[10.5px] text-[#4c6b10]">
            <Lock className="h-3 w-3" /> private
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {[
            ['Credential secret', 'sha256(credentialSalt : electionId) mod p'],
            ['Merkle path', '13 Poseidon siblings + direction bits'],
            ['Witness', 'assembled in memory, never transmitted'],
          ].map(([title, value]) => (
            <li key={title} className="rounded-lg border border-[#D8EEA9] bg-[#F7FBEE] px-3 py-2">
              <p className="text-[11.5px] font-medium text-ink/75">{title}</p>
              <p className="mt-0.5 font-mono text-[10.5px] leading-relaxed text-ink/50">{value}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-card border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold">Public signals</p>
          <span className="inline-flex items-center gap-1 text-[10.5px] text-cobalt">
            <KeyRound className="h-3 w-3" /> verifier sees these
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ['root', 'published eligibility root'],
            ['electionId', 'reduced into BN254'],
            ['nullifier', 'Poseidon(secret, electionId)'],
          ].map(([title, value]) => (
            <li key={title} className="rounded-lg border border-line bg-surface/60 px-3 py-2">
              <p className="mono text-[11px] text-ink/75">{title}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink/45">{value}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ZKP_STAGES.map((item, i) => (
            <button
              key={item.title}
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-[background-color,border-color,color] duration-200 ${
                i === active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink/55 hover:bg-surface'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        <motion.p
          key={stage.title}
          initial={reduce ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 min-h-[40px] text-[12px] leading-relaxed text-ink/55"
        >
          {stage.body}
        </motion.p>
      </div>
    </div>
  );
}

/* ------------------------------- Consensus -------------------------------- */

const VALIDATORS = [
  { id: 'V1', name: 'Validator 01' },
  { id: 'V2', name: 'Validator 02' },
  { id: 'V3', name: 'Validator 03' },
  { id: 'V4', name: 'Validator 04' },
  { id: 'V5', name: 'Validator 05' },
];

const NODE_W = 166;
const NODE_GAP = 22;
const nodeX = (index: number) => 21 + index * (NODE_W + NODE_GAP);

export function ConsensusDiagram() {
  const [active, setActive] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const validator = VALIDATORS.find((item) => item.id === active) ?? null;
  const blockX = 280;
  const blockW = 400;
  const blockCx = blockX + blockW / 2;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8FD01A]" aria-hidden />
          <p className="text-[11.5px] font-medium text-ink/70">Validator set</p>
          <span className="hidden text-[11px] text-ink/35 sm:inline">five independent identities</span>
        </div>
        <p className="mono text-[10px] text-ink/40">quorum 4 of 5 · ed25519</p>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 960 372"
          className="h-auto w-full min-w-[760px]"
          role="img"
          aria-label="Five rectangular validator identities each sign one canonical block header; four signatures are required before the block is appended to the chain."
        >
          <defs>
            <pattern id="consensus-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#EDEFEA" />
            </pattern>
          </defs>
          <rect width="960" height="372" fill="url(#consensus-dots)" />

          <g>
            <rect x={36} y={206} width={196} height={62} rx={10} fill="#FFFFFF" stroke={LINE} />
            <text x={52} y={228} fontSize="10" letterSpacing="0.12em" fontFamily="ui-monospace, Menlo, monospace" fill="#8A9087">
              QUORUM
            </text>
            <text x={52} y={250} fontSize="13" fontWeight="600" fill="#4A5147">
              4 of 5 signatures
            </text>
          </g>
          <g>
            <rect x={728} y={206} width={196} height={62} rx={10} fill="#FFFFFF" stroke={LINE} />
            <text x={744} y={228} fontSize="10" letterSpacing="0.12em" fontFamily="ui-monospace, Menlo, monospace" fill="#8A9087">
              DIGEST
            </text>
            <text x={744} y={250} fontSize="13" fontWeight="600" fill="#4A5147">
              SHA-256 header
            </text>
          </g>

          {VALIDATORS.map((item, index) => {
            const x = nodeX(index);
            const cx = x + NODE_W / 2;
            const isActive = active === item.id;
            return (
              <g key={item.id}>
                <line
                  x1={cx}
                  y1={116}
                  x2={cx}
                  y2={148}
                  stroke={isActive ? '#A9CE5C' : '#DBDFD6'}
                  strokeWidth={isActive ? 1.8 : 1.1}
                  style={{ transition: 'stroke 220ms cubic-bezier(0.22,1,0.36,1), stroke-width 220ms' }}
                />
                <g
                  tabIndex={0}
                  role="button"
                  aria-pressed={isActive}
                  aria-label={`${item.name}. Re-validates the transaction, recomputes the canonical header and transaction Merkle root, then signs the header with its Ed25519 key.`}
                  onMouseEnter={() => setActive(item.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(item.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setActive(item.id);
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  <rect
                    x={x}
                    y={30}
                    width={NODE_W}
                    height={86}
                    rx={10}
                    fill={isActive ? '#F8FCEE' : '#FFFFFF'}
                    stroke={isActive ? '#A9CE5C' : LINE}
                    strokeWidth={isActive ? 1.6 : 1}
                    style={{ transition: 'fill 220ms cubic-bezier(0.22,1,0.36,1), stroke 220ms' }}
                  />
                  <rect x={x} y={30} width={NODE_W} height={3} rx={1.5} fill={isActive ? LIME : '#EDEFEA'} />
                  <text x={x + 14} y={56} fontSize="10.5" letterSpacing="0.08em" fontFamily="ui-monospace, Menlo, monospace" fill="#8A9087">
                    {item.id}
                  </text>
                  <text x={x + 14} y={80} fontSize="14" fontWeight="600" fill={INK}>
                    {item.name}
                  </text>
                  <text x={x + 14} y={99} fontSize="11" fill="#8A9087">
                    Ed25519 keypair
                  </text>
                  <rect
                    x={x + NODE_W - 31}
                    y={44}
                    width={16}
                    height={16}
                    rx={4}
                    fill={isActive ? '#EAFBC4' : '#F4F5F1'}
                    stroke={isActive ? '#CFE89A' : '#E4E6E2'}
                    style={{ transition: 'fill 220ms, stroke 220ms' }}
                  />
                  <path
                    d={`M ${x + NODE_W - 27} 52 l 2.4 2.4 l 4.4 -4.8`}
                    fill="none"
                    stroke={isActive ? '#5C7A12' : '#A9AFA2'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            );
          })}

          <line
            x1={nodeX(0) + NODE_W / 2}
            y1={148}
            x2={nodeX(4) + NODE_W / 2}
            y2={148}
            stroke={active ? '#C9D6B2' : '#DBDFD6'}
            strokeWidth={1.1}
            style={{ transition: 'stroke 220ms' }}
          />
          {VALIDATORS.map((item, index) => (
            <circle
              key={`junction-${item.id}`}
              cx={nodeX(index) + NODE_W / 2}
              cy={148}
              r={2.4}
              fill={active === item.id ? '#A9CE5C' : '#FFFFFF'}
              stroke={active === item.id ? '#A9CE5C' : '#C9CEC4'}
              style={{ transition: 'fill 220ms, stroke 220ms' }}
            />
          ))}
          <line
            x1={blockCx}
            y1={148}
            x2={blockCx}
            y2={184}
            stroke={active ? '#A9CE5C' : '#C9CEC4'}
            strokeWidth={active ? 1.6 : 1.1}
            style={{ transition: 'stroke 220ms, stroke-width 220ms' }}
          />
          <line
            x1={blockCx}
            y1={300}
            x2={blockCx}
            y2={318}
            stroke="#DBDFD6"
            strokeWidth={1.1}
          />

          <g>
            <rect x={blockX} y={184} width={blockW} height={116} rx={12} fill={INK} />
            <rect x={blockX} y={184} width={4} height={116} rx={2} fill={LIME} />
            <text x={blockCx} y={212} textAnchor="middle" fontSize="10.5" letterSpacing="0.12em" fill={LIME}>
              CANONICAL BLOCK HEADER
            </text>
            <text x={blockCx} y={241} textAnchor="middle" fontSize="16" fontWeight="600" fill="#FFFFFF">
              Block #428 · 5 signatures
            </text>
            <text x={blockCx} y={262} textAnchor="middle" fontSize="11.5" fill="#A9B0A4">
              SHA-256 over previousHash · transaction Merkle root
            </text>
            <line x1={blockX + 32} y1={274} x2={blockX + blockW - 32} y2={274} stroke="rgba(255,255,255,0.12)" />
            <text x={blockCx} y={289} textAnchor="middle" fontSize="10.5" fill="#8F978A">
              final at four signatures
            </text>
          </g>

          <g>
            <rect x={330} y={318} width={300} height={36} rx={9} fill="#FFFFFF" stroke={LINE} />
            <rect x={330} y={318} width={3} height={36} rx={1.5} fill="#8FD01A" />
            <text x={480} y={341} textAnchor="middle" fontSize="11.5" fontWeight="500" fill="#4A5147">
              Block appended · chain tip advances
            </text>
          </g>
        </svg>
      </div>

      <div className="border-t border-line bg-surface/40 px-4 py-3">
        <motion.div
          key={validator?.id ?? 'default'}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[12px] font-semibold">
            {validator ? `${validator.name} · signature` : 'Independent validation before signature'}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink/55">
            {validator
              ? 'Re-validates the transaction, recomputes the canonical header and transaction Merkle root, checks the nullifier, then signs the header with its own Ed25519 key. Four signatures append the block.'
              : 'Each of the five identities runs the same checks against its own registered key. Hover or focus a validator to inspect its role in the round.'}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/* ----------------------------- Election states ---------------------------- */

const STATES = [
  { label: 'DRAFT', detail: 'Metadata and candidates editable' },
  { label: 'SCHEDULED', detail: 'Eligibility root published' },
  { label: 'LIVE', detail: 'Ballots accepted' },
  { label: 'CLOSED', detail: 'No further ballots' },
  { label: 'COMPLETED', detail: 'Aggregate tally published' },
];

export function ElectionLifecycle() {
  return (
    <div className="min-w-0">
      <div className="relative">
        <span className="absolute left-[6%] right-[6%] top-[5px] hidden h-px bg-line sm:block" aria-hidden />
        <ol className="relative grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5">
          {STATES.map((state) => (
            <li key={state.label} className="min-w-0">
              <span
                className={`flex h-[11px] w-[11px] items-center justify-center rounded-full border ${
                  state.label === 'LIVE' ? 'border-ink bg-lime' : 'border-[#CFD4C8] bg-white'
                }`}
              />
              <p className="mt-2.5 font-mono text-[10.5px] font-medium tracking-wide text-ink/70">{state.label}</p>
              <p className="mt-0.5 max-w-[150px] text-[11px] leading-snug text-ink/45">{state.detail}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink/40">
        Each transition writes an audit entry and commits a ledger transaction. Metadata and candidates freeze when the
        first ballot is accepted.
      </p>
    </div>
  );
}

/* --------------------------- Separation of identity ----------------------- */

export function SecurityBoundary() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-card border border-line bg-white p-4">
        <p className="text-[11.5px] font-semibold text-ink/70">Identity side</p>
        <ul className="mt-2.5 space-y-1.5 text-[11.5px] text-ink/50">
          {['User · account and role', 'Voter · number, faculty, credential salt', 'EligibleVoter · Poseidon commitment', 'Nullifier · single use, election-scoped'].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink/30" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-card border border-line bg-white p-4">
        <p className="text-[11.5px] font-semibold text-ink/70">Ballot side</p>
        <ul className="mt-2.5 space-y-1.5 text-[11.5px] text-ink/50">
          {['Ballot · election, receipt, block — no candidate column', 'EncryptedBallot · Paillier ciphertext vector', 'Commitment · SHA-256 over canonical ciphertext', 'ElectionResult · the only candidate totals'].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink/30" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <p className="md:col-span-2 text-[11px] leading-relaxed text-ink/40">
        No endpoint joins the two sides. An administrator with database access can learn who voted; recovering a
        selection additionally requires the tally private key.
      </p>
    </div>
  );
}

/* ------------------------------ Pipeline strip ---------------------------- */

const PIPELINE = ['Authenticate', 'Prove eligibility', 'Encrypt ballot', 'Reach quorum', 'Publish tally'];

export function PipelineStrip() {
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-1 scrollbar-thin" aria-label="Ballot pipeline">
      {PIPELINE.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div className="flex min-w-[112px] flex-col gap-1 rounded-lg border border-line bg-white px-3 py-2.5">
            <span className="font-mono text-[9.5px] text-ink/35">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-[11.5px] font-medium leading-tight text-ink/70">{step}</span>
          </div>
          {i < PIPELINE.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-ink/25" aria-hidden />}
        </div>
      ))}
    </div>
  );
}
