import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { PublicShell } from '../components/Layout';
import { Badge, Button, Callout } from '../components/ui';
import { ConsensusDiagram, SystemArchitecture, VotingWorkflow, ZkpLifecycle } from '../components/Diagrams';
import { Reveal } from '../components/Motion';

function PageHero({
  label,
  title,
  description,
  children,
}: {
  label?: string;
  title: React.ReactNode;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
        {label && <p className="text-[12px] font-medium text-ink/45">{label}</p>}
        <h1 className="mt-4 max-w-[820px] text-[34px] font-bold leading-[1.08] md:text-[46px]">{title}</h1>
        <p className="mt-5 max-w-[620px] text-[14.5px] leading-relaxed text-ink/60">{description}</p>
        {children}
      </div>
    </section>
  );
}

function Section({
  id,
  title,
  description,
  children,
  className = '',
}: {
  id?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-18 ${className}`}>
      <h2 className="max-w-[680px] text-[26px] font-bold leading-tight md:text-[32px]">{title}</h2>
      {description && <p className="mt-3 max-w-[620px] text-[13.5px] leading-relaxed text-ink/55">{description}</p>}
      {children && <div className="mt-9">{children}</div>}
    </section>
  );
}

function DefinitionRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line py-4 sm:grid-cols-[220px_1fr] sm:gap-8">
      <dt className="text-[13px] font-medium text-ink/70">{term}</dt>
      <dd className="text-[12.5px] leading-relaxed text-ink/55">{children}</dd>
    </div>
  );
}

/* -------------------------------- Platform -------------------------------- */

export function Platform() {
  return (
    <PublicShell>
      <PageHero
        label="Platform"
        title="One election, three verified perspectives."
        description="CRYPTORA joins an election management workspace, a private voter experience and an independent audit console to the same append-only ledger."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Button to="/access" size="lg">
            Open the demonstration <ArrowRight className="h-4 w-4" />
          </Button>
          <Button to="/how-it-works" variant="outline" size="lg">
            Read the workflow
          </Button>
        </div>
      </PageHero>

      <Section
        title="What the platform actually does"
        description="Each capability below is implemented in the running application and exercised by the seeded demonstration dataset."
      >
        <div className="grid gap-x-12 gap-y-0 md:grid-cols-2">
          {[
            {
              title: 'Election lifecycle',
              body: 'Draft, publish the eligibility root, open, close and tally. Each transition is a recorded, auditable action.',
            },
            {
              title: 'Voter registry',
              body: 'Register voters individually or import a CSV. Each eligible voter receives a Poseidon commitment in the election Merkle tree.',
            },
            {
              title: 'Zero-knowledge eligibility',
              body: 'A Groth16 membership proof is generated in the browser and verified against the published key before a ballot is accepted.',
            },
            {
              title: 'Encrypted ballots',
              body: 'One-hot vectors are Paillier-encrypted on the device. No table in the database stores a plaintext candidate selection.',
            },
            {
              title: 'Consortium ledger',
              body: 'Five validator identities re-validate each transaction and sign with Ed25519. Four approvals commit the block.',
            },
            {
              title: 'Independent audit',
              body: 'Auditors re-verify proofs, traverse the chain, inspect signatures and export CSV and PDF reports generated from live data.',
            },
          ].map((cap) => (
            <div key={cap.title} className="border-t border-line py-5">
              <h3 className="text-[14px] font-semibold">{cap.title}</h3>
              <p className="mt-1.5 max-w-[440px] text-[12.5px] leading-relaxed text-ink/55">{cap.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Role boundaries" description="Every API route names the roles allowed to call it. The interface reflects those boundaries; it does not define them.">
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            {
              role: 'Administrator',
              to: '/admin/login',
              body: 'Runs elections and the registry. Can inspect ledger state, but no route returns an individual ballot selection.',
              points: ['Election lifecycle', 'Registry and commitments', 'Ledger operations'],
            },
            {
              role: 'Voter',
              to: '/voter/login',
              body: 'Signs in with a voter number, proves eligibility privately, encrypts a ballot and receives a sealed receipt.',
              points: ['Eligibility proof', 'Encrypted submission', 'Private receipt'],
            },
            {
              role: 'Auditor',
              to: '/auditor/login',
              body: 'Read-only access to proofs, validator signatures and aggregate results for independent verification.',
              points: ['Proof re-verification', 'Ledger traversal', 'Report export'],
            },
          ].map((item) => (
            <div key={item.role} className="border-t border-ink/15 pt-5">
              <p className="text-[13px] font-semibold">{item.role}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink/55">{item.body}</p>
              <ul className="mt-4 space-y-1.5">
                {item.points.map((point) => (
                  <li key={point} className="text-[12px] text-ink/45">
                    {point}
                  </li>
                ))}
              </ul>
              <Link to={item.to} className="link-quiet mt-4">
                Sign in <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Implementation" description="The stack that runs in this repository, not a target architecture.">
        <dl className="border-b border-line">
          <DefinitionRow term="Frontend">React 18, TypeScript, Vite, Tailwind CSS, React Router</DefinitionRow>
          <DefinitionRow term="API">Node.js with Express 4, Zod request validation, cookie sessions</DefinitionRow>
          <DefinitionRow term="Data">SQLite through Prisma ORM; ballots stored as ciphertext and commitments</DefinitionRow>
          <DefinitionRow term="Cryptography">
            Circom circuit compiled to Groth16 (snarkjs), Poseidon Merkle tree, Paillier encryption, Ed25519 signatures
          </DefinitionRow>
          <DefinitionRow term="Ledger">
            Five validator identities with independent keypairs and validation routines, executed inside one backend
            process. This is a consortium workflow prototype, not five networked hosts.
          </DefinitionRow>
        </dl>
        <p className="mt-4 text-[12px] text-ink/45">
          Hyperledger Besu and QBFT are part of the wider project proposal; this build implements the consensus
          workflow in application code rather than on a Besu network.
        </p>
        <Reveal className="mt-8">
          <SystemArchitecture />
        </Reveal>
      </Section>
    </PublicShell>
  );
}

/* -------------------------------- Security -------------------------------- */

export function Security() {
  return (
    <PublicShell>
      <PageHero
        label="Security architecture"
        title="Privacy is a proof obligation, not a promise."
        description="CRYPTORA separates three questions that elections usually conflate: who is eligible, what was submitted, and whether anything has been altered."
      />

      <Section
        id="zkp"
        title="Eligibility without identification"
        description="Each election publishes a Merkle root over the commitment of every eligible voter. A voter proves membership in that set; the ledger learns only that the proof is valid and that the nullifier is unspent."
      >
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="min-w-0">
            <dl className="border-b border-line">
              <DefinitionRow term="Private inputs">Credential secret, Merkle path elements, path direction bits</DefinitionRow>
              <DefinitionRow term="Public inputs">Election Merkle root, election identifier, nullifier</DefinitionRow>
              <DefinitionRow term="Constraint">
                Poseidon(secret) hashes up the supplied path to the published root
              </DefinitionRow>
              <DefinitionRow term="Nullifier">
                Poseidon(secret, electionId) — deterministic within one election, unlinkable across elections
              </DefinitionRow>
            </dl>
            <p className="mt-5 text-[12.5px] leading-relaxed text-ink/55">
              The eligibility proof is independent of ballot encryption. No circuit in this build proves that an
              encrypted ballot encodes a valid one-hot vector; that property is stated as a limitation rather than
              claimed.
            </p>
          </div>
          <div className="min-w-0 rounded-card border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-ink/45">Circuit</p>
              <Badge tone="neutral">Groth16 · BN254</Badge>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-surface px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-ink/65">
{`leaf      = Poseidon(secret)
path      = MerklePath(leaf, elements, indices)
nullifier = Poseidon(secret, electionId)
public    = [root, electionId, nullifier]`}
            </pre>
            <ul className="mt-4 space-y-2 text-[12px] text-ink/55">
              <li>Depth 13 · 8,192 leaves per election</li>
              <li>Witness and proving happen in the voter’s browser</li>
              <li>The verification key is the only material the server needs</li>
            </ul>
          </div>
        </div>
        <Reveal className="mt-8">
          <ZkpLifecycle />
        </Reveal>
      </Section>

      <Section
        id="blockchain"
        title="Five validators, one append-only record"
        description="Every accepted action becomes a transaction. Validators independently check format, previous-block hash, nullifier uniqueness, proof status and election state before signing the block hash."
      >
        <dl className="border-b border-line">
          <DefinitionRow term="Permissioning">Five known validator identities, each with its own Ed25519 keypair</DefinitionRow>
          <DefinitionRow term="Consensus">A block commits at four of five signatures</DefinitionRow>
          <DefinitionRow term="Chaining">SHA-256 over a canonical JSON header, including the previous block hash</DefinitionRow>
          <DefinitionRow term="Verification">A full traversal recomputes every hash, chain link, Merkle root and signature</DefinitionRow>
        </dl>
        <div className="mt-5">
          <Callout tone="neutral" title="Local consortium simulation">
            The validators hold real keypairs and run independent validation routines, but they execute inside a single
            backend process. That is a genuine quorum workflow, not a production distributed network.
          </Callout>
        </div>
        <Reveal className="mt-6">
          <ConsensusDiagram />
        </Reveal>
      </Section>

      <Section title="Controls that apply to every role" description="Enforced server-side; the interface only reflects them.">
        <dl className="grid gap-x-12 md:grid-cols-2">
          {[
            ['Role-based authorisation', 'Each router declares its role. A voter cannot reach an administrator endpoint by changing the interface.'],
            ['Password hashing', 'Credentials are bcrypt hashes. Seeded non-demo accounts hold a locked hash and cannot sign in.'],
            ['Sessions', 'Random 256-bit tokens stored only as SHA-256 hashes, delivered in HttpOnly, SameSite=Lax cookies.'],
            ['Rate limiting', 'Authentication attempts are limited per identifier and address within a ten-minute window.'],
            ['Input validation', 'Every mutation is validated with a Zod schema; Prisma uses parameterised queries.'],
            ['Secret handling', 'Validator keys and the Paillier private key stay on the server. Only the public tally key reaches the browser.'],
          ].map(([title, body]) => (
            <div key={title} className="border-t border-line py-4">
              <dt className="flex items-start gap-2 text-[13px] font-medium">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" aria-hidden />
                {title}
              </dt>
              <dd className="mt-1.5 text-[12.5px] leading-relaxed text-ink/55">{body}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </PublicShell>
  );
}

/* ------------------------------- How it works ----------------------------- */

export function HowItWorks() {
  const steps = [
    ['Election configuration', 'Dates, rules and candidates are defined, and an election-scoped Paillier tally keypair is generated.', 'Administrator'],
    ['Registry and commitments', 'Each eligible voter is assigned a credential secret; Poseidon(secret) becomes the Merkle leaf.', 'Administrator'],
    ['Root publication', 'The Merkle root is published and recorded in a VOTER_ROOT_PUBLISHED transaction.', 'Ledger'],
    ['Authentication', 'The voter signs in with their voter number and password over an HttpOnly session.', 'Voter'],
    ['Proof generation', 'The browser builds the witness, generates a Groth16 proof and checks it against the verification key.', 'Voter'],
    ['Encryption', 'The selection becomes a one-hot vector encrypted with the election public key. Only ciphertext leaves the device.', 'Voter'],
    ['Consensus', 'The server verifies the proof, rejects spent nullifiers and runs the four-of-five quorum.', 'Ledger'],
    ['Tally', 'Ciphertexts are multiplied homomorphically and decrypted once. Only candidate totals are published.', 'Results'],
  ] as const;

  return (
    <PublicShell>
      <PageHero
        label="Workflow"
        title="The complete path of a private ballot."
        description="Eight stages across three roles and one ledger. Everything below runs in this application."
      />

      <Section title="The eight-stage pipeline" description="Select a stage to see what runs and where it runs. The list below covers the same stages in text.">
        <VotingWorkflow />
      </Section>

      <Section title="From configuration to published tally">
        <ol className="border-b border-line">
          {steps.map(([title, body, owner], i) => (
            <li key={title} className="grid gap-2 border-t border-line py-5 sm:grid-cols-[56px_1fr_120px] sm:gap-6">
              <span className="font-mono text-[12px] text-ink/35">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="text-[13.5px] font-semibold">{title}</p>
                <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-ink/55">{body}</p>
              </div>
              <span className="text-[12px] text-ink/40 sm:text-right">{owner}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Why the nullifier matters" description="Duplicate prevention without storing a voter identity next to a ballot." >
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-[13px] leading-relaxed text-ink/60">
              Because the nullifier is a deterministic function of the voter’s secret and the election identifier, a
              second submission produces exactly the same value. The ledger rejects it, while the nullifier itself says
              nothing about who the voter is and differs in every other election.
            </p>
            <p className="mt-4 text-[13px] leading-relaxed text-ink/60">
              Paillier encryption is additively homomorphic: multiplying ciphertexts adds their plaintexts. Aggregating
              thousands of encrypted ballots therefore needs one decryption per candidate — and no individual ballot is
              ever decrypted.
            </p>
          </div>
          <div className="rounded-card border border-line bg-white p-5">
            <p className="text-[12px] font-medium text-ink/45">Aggregate tally</p>
            <div className="mt-3 space-y-2 font-mono text-[11.5px] leading-relaxed text-ink/60">
              <p>ballot&nbsp;&nbsp;&nbsp;&nbsp;= E(v₁) · E(v₂) · … · E(vₙ)</p>
              <p>aggregate = E(Σvᵢ)</p>
              <p>published = totals only</p>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-ink/50">
              The tally key is held by the backend in this build. Threshold decryption with independent trustees is
              listed as future work.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Where to verify it yourself">
        <dl className="border-b border-line">
          <DefinitionRow term="Inspect a block">Open any block to see its header, previous hash, transactions and every validator signature.</DefinitionRow>
          <DefinitionRow term="Re-verify a proof">The auditor console re-runs Groth16 verification against the circuit key for live proof records.</DefinitionRow>
          <DefinitionRow term="Traverse the chain">A full integrity run recomputes block hashes, numbering, links, signatures and transaction hashes.</DefinitionRow>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button to="/auditor/login" variant="outline">
            Open the auditor console
          </Button>
          <Button to="/results">See published results</Button>
        </div>
      </Section>
    </PublicShell>
  );
}

/* ---------------------------------- About --------------------------------- */

export function About() {
  return (
    <PublicShell>
      <PageHero
        label="About the project"
        title="A secure and privacy-preserving e-voting system using consortium blockchain and zero-knowledge proofs."
        description="CRYPTORA treats election privacy and election integrity as one cryptographic problem rather than two competing policy goals."
      >
        <dl className="mt-8 grid gap-x-10 gap-y-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Institution', 'Shree L.R. Tiwari College of Engineering'],
            ['Department', 'Computer Engineering'],
            ['Project group', 'AY26BECSA11'],
            ['Type', 'Final-year engineering project'],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-line pt-3">
              <dt className="text-ink/45">{label}</dt>
              <dd className="mt-1 font-medium text-ink/80">{value}</dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <Section title="Objectives">
        <ol className="grid gap-x-12 gap-y-0 md:grid-cols-2">
          {[
            'Demonstrate that eligibility can be proven without disclosing voter identity.',
            'Keep individual ballots encrypted while totals remain verifiable.',
            'Implement a permissioned consortium ledger with real validator signatures and quorum.',
            'Give independent auditors read-only tools to verify proofs, blocks and aggregates.',
            'Provide a prepared demonstration environment that works without manual configuration.',
            'State clearly which properties are proven and which remain out of scope.',
          ].map((objective, i) => (
            <li key={objective} className="flex gap-4 border-t border-line py-4">
              <span className="font-mono text-[12px] text-ink/35">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-[12.5px] leading-relaxed text-ink/60">{objective}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Implementation status" description="Stated precisely, because a project review depends on knowing what is real.">
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {[
            {
              label: 'Implemented',
              tone: 'lime' as const,
              items: [
                'Circom eligibility circuit compiled to Groth16',
                'Local trusted setup with proving and verifying keys',
                'Browser-side proof generation and server verification',
                'Paillier encryption, homomorphic aggregation, tally',
                'Ed25519 validator signatures with 4-of-5 quorum',
                'Hash-chained ledger with full traversal verification',
              ],
            },
            {
              label: 'Simulated',
              tone: 'blue' as const,
              items: [
                'Validators run as logical identities in one process',
                'Network latency and partitions are not modelled',
                'Historical ballots carry seeded proof metadata',
              ],
            },
            {
              label: 'Out of scope',
              tone: 'neutral' as const,
              items: [
                'Threshold decryption with distributed trustees',
                'In-circuit proof of ballot well-formedness',
                'Hardware tokens or voter credential wallets',
                'Certification for binding public elections',
              ],
            },
          ].map((group) => (
            <div key={group.label} className="border-t border-ink/15 pt-5">
              <Badge tone={group.tone}>{group.label}</Badge>
              <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-ink/55">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Documentation">
        <dl className="border-b border-line">
          {[
            ['README.md', 'Setup, commands, architecture and demo script'],
            ['docs/ARCHITECTURE.md', 'System components and data flow'],
            ['docs/BLOCKCHAIN.md', 'Ledger structure, consensus and verification'],
            ['docs/ZKP.md', 'Circuit, trusted setup and proof lifecycle'],
            ['docs/SECURITY.md', 'Threat model, controls and limitations'],
            ['docs/DEMO_GUIDE.md', 'Step-by-step presentation script'],
          ].map(([file, desc]) => (
            <div key={file} className="grid gap-1 border-t border-line py-3 sm:grid-cols-[240px_1fr] sm:gap-8">
              <dt className="mono text-ink/70">{file}</dt>
              <dd className="text-[12.5px] text-ink/50">{desc}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <Callout tone="neutral" title="Academic prototype">
            CRYPTORA is built for demonstration and evaluation. It is not certified, externally audited or intended for
            legally binding elections.
          </Callout>
        </div>
      </Section>
    </PublicShell>
  );
}
