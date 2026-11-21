import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Fingerprint,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Vote,
} from 'lucide-react';
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  LoadingBlock,
  ProgressSteps,
  SectionHeading,
  useToast,
} from '../../components/ui';
import { useApi } from '../../lib/useApi';
import { api } from '../../lib/api';
import { ballotCommitment, encryptVector, generateEligibilityProof, verifyLocally, type WitnessPayload } from '../../lib/zkp';
import { formatDateTime, formatNumber, shortHash } from '../../lib/format';

interface BallotElection {
  electionId: string;
  name: string;
  description: string;
  status: string;
  rules: string;
  startDate: string;
  endDate: string;
  merkleRoot: string | null;
  hasVoted: boolean;
  isOpen: boolean;
  candidates: { candidateId: string; name: string; position: string; slogan: string; index: number }[];
}

interface WitnessResponse extends WitnessPayload {
  circuit: string;
  candidates: { candidateId: string; name: string; index: number }[];
  verificationKey: Record<string, unknown>;
}

interface Receipt {
  receiptCode: string;
  electionId: string;
  electionName: string;
  blockNumber: number;
  blockHash: string;
  txHash: string;
  proofVerified: boolean;
  proofType: string;
  circuit: string;
  approvals: number;
  threshold: number;
  validatorIds: string[];
  timestamp: string;
  nullifier: string;
  merkleRoot: string;
  verificationMs: number;
}

type Stage = 'select' | 'review' | 'processing' | 'receipt';
type StepStatus = 'pending' | 'active' | 'done' | 'error';

interface Step {
  label: string;
  detail: string;
  status: StepStatus;
}

const INITIAL_STEPS: Step[] = [
  { label: 'Fetch eligibility witness', detail: 'Retrieving your Merkle path over the authenticated session', status: 'pending' },
  { label: 'Generate Groth16 proof', detail: 'Proving membership of the published eligibility root', status: 'pending' },
  { label: 'Verify proof locally', detail: 'Checking the proof against the circuit verification key', status: 'pending' },
  { label: 'Encrypt ballot', detail: 'Encrypting a one-hot vector with the election public key', status: 'pending' },
  { label: 'Submit to consortium', detail: 'Awaiting nullifier check and validator quorum', status: 'pending' },
];

export default function VoterBallot() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const { data: election, loading, error: loadError } = useApi<BallotElection>(`/api/voter/elections/${electionId}`);

  const [stage, setStage] = useState<Stage>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofMs, setProofMs] = useState<number | null>(null);

  const chosen = useMemo(
    () => election?.candidates.find((c) => c.candidateId === selected) ?? null,
    [election, selected],
  );

  const setStep = (index: number, status: StepStatus, detail?: string) =>
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status, detail: detail ?? s.detail } : s)),
    );

  const run = async () => {
    if (!election || !selected) return;
    setStage('processing');
    setError(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus })));

    let active = 0;
    try {
      // 1 — witness
      active = 0;
      setStep(0, 'active');
      const witness = await api.get<WitnessResponse>(`/api/voter/elections/${election.electionId}/witness`);
      if (!witness.tallyPublicKey) throw new Error('This election has no published tally key.');
      setStep(0, 'done', `Depth ${witness.depth} Poseidon path · leaf ${election.candidates.length} slot ballot`);

      // 2 — proof
      active = 1;
      setStep(1, 'active');
      const proof = await generateEligibilityProof(witness);
      setProofMs(proof.proveMs);
      setStep(1, 'done', `Proof generated in ${formatNumber(proof.proveMs)} ms (${witness.circuit}.circom)`);

      // 3 — local verification
      active = 2;
      setStep(2, 'active');
      const valid = await verifyLocally(witness.verificationKey, proof.publicSignals, proof.proof);
      if (!valid) throw new Error('The locally generated proof did not verify against the circuit key.');
      setStep(2, 'done', 'Proof valid before transmission — no invalid ballot can be sent');

      // 4 — encryption
      active = 3;
      setStep(3, 'active');
      const oneHot = election.candidates.map((c) => (c.candidateId === selected ? 1 : 0));
      const ciphertexts = encryptVector(witness.tallyPublicKey, oneHot);
      const commitment = await ballotCommitment(ciphertexts);
      setStep(3, 'done', `${ciphertexts.length} ciphertexts · commitment ${shortHash(commitment, 10, 6)}`);

      // 5 — submission
      active = 4;
      setStep(4, 'active');
      const result = await api.post<{ receipt: Receipt }>(`/api/voter/elections/${election.electionId}/submit`, {
        proof: proof.proof,
        publicSignals: proof.publicSignals,
        ciphertexts,
        ballotCommitment: commitment,
        nullifier: witness.nullifier,
      });
      setStep(4, 'done', `Committed in block #${result.receipt.blockNumber} with ${result.receipt.approvals}/5 approvals`);
      setReceipt(result.receipt);
      setStage('receipt');
      push({ title: 'Ballot accepted', description: `Receipt ${result.receipt.receiptCode} committed to the ledger.` });
    } catch (err: any) {
      setStep(active, 'error', err?.message ?? 'Step failed');
      setError(err?.message ?? 'The ballot could not be submitted.');
      push({ title: 'Ballot not submitted', description: err?.message, tone: 'error' });
    }
  };

  if (loading) return <LoadingBlock rows={5} />;

  if (loadError || !election) {
    return (
      <Card>
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Ballot unavailable"
          description={loadError ?? 'You are not eligible for this election.'}
          action={
            <Button to="/voter/elections" variant="outline" size="sm">
              Back to elections
            </Button>
          }
        />
      </Card>
    );
  }

  if (election.hasVoted) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Your ballot is already recorded"
          description="A single-use nullifier guarantees one ballot per voter per election. You can review the receipt in your history."
          action={
            <div className="flex gap-2">
              <Button to="/voter/history" variant="lime" size="sm">
                View voting history
              </Button>
              <Button to="/voter/elections" variant="outline" size="sm">
                Other elections
              </Button>
            </div>
          }
        />
      </Card>
    );
  }

  if (!election.isOpen && stage !== 'receipt') {
    return (
      <Card>
        <EmptyState
          icon={<Lock className="h-5 w-5" />}
          title="Voting is closed"
          description={`This election is ${election.status.toLowerCase()} and no longer accepts ballots.`}
          action={<Button to="/voter/elections" variant="outline" size="sm">Back to elections</Button>}
        />
      </Card>
    );
  }

  const currentStep = stage === 'select' ? 1 : stage === 'review' ? 2 : stage === 'processing' ? 3 : 4;

  return (
    <div className="space-y-5">
      <Link
        to={`/voter/elections/${election.electionId}`}
        className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/55 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to election
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">
 Secure ballot
          </span>
          <h1 className="mt-4 text-[28px] font-extrabold leading-[1.08] md:text-[32px]">{election.name}</h1>
          <p className="mt-1.5 text-[12.5px] text-ink/50">
            {election.electionId} · {election.rules} · closes {formatDateTime(election.endDate)}
          </p>
        </div>
        <Badge tone="lime">
          <ShieldCheck className="h-3 w-3" /> End-to-end encrypted
        </Badge>
      </div>

      <Card>
        <ProgressSteps
          steps={['Select', 'Review', stage === 'receipt' ? 'Receipt' : 'Submit']}
          current={stage === 'receipt' ? 4 : currentStep}
        />
      </Card>

      {/* -------------------------------- Select ------------------------------- */}
      {stage === 'select' && (
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <SectionHeading
              title="Select one candidate"
              description="Your selection is encrypted in this browser. It is never transmitted in plaintext."
            />
            <div className="mt-4 space-y-2.5">
              {election.candidates.map((c) => {
                const active = selected === c.candidateId;
                return (
                  <button
                    key={c.candidateId}
                    onClick={() => setSelected(c.candidateId)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                      active ? 'border-ink bg-surface/70' : 'border-line bg-white hover:border-ink/30'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                        active ? 'border-ink bg-ink text-white' : 'border-line bg-white'
                      }`}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-semibold">{c.name}</span>
                        <span className="mono shrink-0 text-[10px] text-ink/35">{c.candidateId}</span>
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-ink/45">{c.position}</span>
                      {c.slogan && <span className="mt-1 block text-[11.5px] italic text-ink/40">“{c.slogan}”</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-[11.5px] text-ink/45">
                {selected ? 'Selection ready for review.' : 'Choose a candidate to continue.'}
              </p>
              <Button variant="lime" disabled={!selected} onClick={() => setStage('review')}>
                Review ballot
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionHeading title="Ballot parameters" description="Frozen when the election opened." />
              <dl className="mt-4 space-y-2 text-[12px]">
                {[
                  ['Eligibility root', election.merkleRoot ? shortHash(election.merkleRoot, 14, 10) : 'Not published'],
                  ['Candidates', String(election.candidates.length)],
                  ['Selections allowed', '1'],
                  ['Encryption', 'Paillier additive'],
                  ['Proof system', 'Groth16 / BN254'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <span className="text-ink/50">{label}</span>
                    <span className="mono font-medium">{value}</span>
                  </div>
                ))}
              </dl>
            </Card>
            <Callout tone="blue" icon={<Fingerprint className="h-4 w-4" />} title="Privacy guarantee">
              The proof shows that you belong to the eligibility set. It does not reveal which leaf you are, and the
              nullifier is derived from a secret that never leaves your browser session.
            </Callout>
          </div>
        </div>
      )}

      {/* -------------------------------- Review ------------------------------- */}
      {stage === 'review' && chosen && (
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <SectionHeading title="Confirm your selection" description="This is your last chance to change your ballot." />
            <div className="mt-4 rounded-xl border border-ink/15 bg-surface/60 p-4">
              <p className="stat-label">Your candidate</p>
              <p className="mt-1 text-[18px] font-bold">{chosen.name}</p>
              <p className="text-[12px] text-ink/50">
                {chosen.position} · {chosen.candidateId}
              </p>
            </div>
            <div className="mt-4 space-y-2 text-[12px] text-ink/60">
              {[
                'A Groth16 proof will be generated locally — expect a few seconds on first use while the circuit loads.',
                'Your selection is encrypted before it leaves this page.',
                'The ballot is bound to a single-use nullifier, so it cannot be replayed or cast twice.',
                'Once committed to a block, the ballot cannot be edited or withdrawn.',
              ].map((line) => (
                <p key={line} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c6b10]" />
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <Button variant="outline" onClick={() => setStage('select')}>
                Change selection
              </Button>
              <Button variant="lime" size="lg" onClick={run}>
                <Lock className="h-4 w-4" /> Encrypt &amp; submit ballot
              </Button>
            </div>
          </Card>

          <Card>
            <SectionHeading title="Submission pipeline" description="Five stages run in order." />
            <ol className="mt-4 space-y-3">
              {INITIAL_STEPS.map((step, i) => (
                <li key={step.label} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-ink/50">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[12px] font-medium">{step.label}</p>
                    <p className="text-[11px] leading-relaxed text-ink/45">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {/* ------------------------------ Processing ----------------------------- */}
      {stage === 'processing' && (
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <SectionHeading
              title={error ? 'Submission halted' : 'Submitting your ballot'}
              description={
                error
                  ? 'The pipeline stopped at the failed stage. Your ballot was not committed.'
                  : 'Keep this tab open — the proof is generated on this device.'
              }
            />
            <div className="mt-4 space-y-2">
              {steps.map((step) => (
                <div
                  key={step.label}
                  className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                    step.status === 'error'
                      ? 'border-[#F6D2D2] bg-[#FEF6F6]'
                      : step.status === 'active'
                        ? 'border-ink/20 bg-surface/70'
                        : 'border-line'
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-white">
                    {step.status === 'done' ? (
                      <Check className="h-3.5 w-3.5 text-[#4c6b10]" strokeWidth={3} />
                    ) : step.status === 'active' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/60" />
                    ) : step.status === 'error' ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-ink/20" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium">{step.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink/50">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F6D2D2] bg-[#FEF6F6] px-4 py-3">
                <p className="text-[12px] text-[#B42318]">{error}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStage('review')}>
                    Back to review
                  </Button>
                  <Button variant="lime" size="sm" onClick={run}>
                    Retry submission
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionHeading title="Encrypted ballot" description="Only ciphertext exists after this step." />
              <div className="mt-4 rounded-xl border border-dashed border-line bg-canvas p-4">
                <p className="stat-label">Selection</p>
                <p className="mt-1 text-[13px] font-semibold">{chosen?.name ?? '—'}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink/45">
                  The one-hot vector is encrypted element by element. Without the tally private key these values are
                  indistinguishable from random.
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11.5px] text-ink/50">
                <Sparkles className="h-3.5 w-3.5 text-[#4c6b10]" />
                {proofMs ? `Proof generated in ${formatNumber(proofMs)} ms` : 'Generating proof locally…'}
              </div>
            </Card>
            <Callout tone="neutral" icon={<Vote className="h-4 w-4" />}>
              If the tab is closed before the receipt appears, your ballot may or may not have been accepted. Check your
              voting history before submitting again — the nullifier prevents duplicates.
            </Callout>
          </div>
        </div>
      )}

      {/* -------------------------------- Receipt ------------------------------ */}
      {stage === 'receipt' && receipt && (
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-ink">
                <Check className="h-6 w-6" strokeWidth={3} />
              </span>
              <div>
                <h2 className="text-[20px] font-bold leading-tight">Ballot accepted</h2>
                <p className="mt-1 text-[13px] text-ink/55">
                  Your ballot was verified, encrypted and committed to the consortium ledger.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="stat-label">Receipt code</p>
                  <p className="mono mt-1 text-[18px] font-bold tracking-tight">{receipt.receiptCode}</p>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(receipt.receiptCode);
                    push({ title: 'Receipt copied', tone: 'info' });
                  }}
                  className="rounded-lg border border-line bg-white p-2 text-ink/50 hover:text-ink"
                  aria-label="Copy receipt code"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-ink/45">
                Keep this code. It proves your ballot exists without revealing what it contains.
              </p>
            </div>

            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                ['Election', receipt.electionName],
                ['Block number', `#${receipt.blockNumber}`],
                ['Approvals', `${receipt.approvals} of 5 validators`],
                ['Proof', `${receipt.proofType} · ${receipt.proofVerified ? 'verified' : 'unverified'}`],
                ['Block hash', shortHash(receipt.blockHash, 14, 10)],
                ['Transaction', shortHash(receipt.txHash, 14, 10)],
                ['Server verification', `${receipt.verificationMs} ms`],
                ['Committed', formatDateTime(receipt.timestamp)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line px-3 py-2">
                  <dt className="stat-label">{label}</dt>
                  <dd className="mono mt-0.5 break-all text-[11.5px] font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="lime" onClick={() => navigate('/voter/history')}>
                View voting history
              </Button>
              <Button variant="outline" onClick={() => navigate('/voter/elections')}>
                Other elections
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionHeading title="What the ledger now contains" description="Nothing here identifies your selection." />
              <ul className="mt-4 space-y-2.5 text-[12px] text-ink/60">
                {[
                  `Receipt ${receipt.receiptCode} bound to block #${receipt.blockNumber}`,
                  `Nullifier ${shortHash(receipt.nullifier, 12, 8)} — single use, unlinkable to your identity by others`,
                  `Encrypted vector committed under a SHA-256 commitment`,
                  `${receipt.validatorIds.length} validator signatures over the block header`,
                  'No plaintext candidate, ballot image or voter identity in the block',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4c6b10]" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
            <Callout tone="lime" icon={<CheckCircle2 className="h-4 w-4" />} title="Verifiable by anyone">
              The eligibility root and the block hash are public. An auditor can re-verify your proof against the published
              verification key without learning anything about your choice.
            </Callout>
          </div>
        </div>
      )}
    </div>
  );
}
