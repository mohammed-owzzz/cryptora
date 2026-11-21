import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Shield, ShieldCheck, Users, Vote } from 'lucide-react';
import { PublicShell } from '../components/Layout';
import { Button, Callout } from '../components/ui';

const DEMO = [
  {
    role: 'Administrator',
    icon: <Shield className="h-4 w-4" />,
    to: '/admin/login',
    path: '/admin/dashboard',
    id: 'admin@cryptora.demo',
    password: 'Admin@1234!',
    detail: 'Election lifecycle, voter registry, consortium operations.',
  },
  {
    role: 'Voter',
    icon: <Vote className="h-4 w-4" />,
    to: '/voter/login',
    path: '/voter/dashboard',
    id: 'VOTER-2026-0042',
    password: 'Voter@1234!',
    detail: 'Cast a privacy-preserving ballot with a real Groth16 proof.',
  },
  {
    role: 'Auditor',
    icon: <ShieldCheck className="h-4 w-4" />,
    to: '/auditor/login',
    path: '/auditor/dashboard',
    id: 'jordan@cryptora.demo',
    password: 'Auditor@1234!',
    detail: 'Read-only independent verification of proofs and ledger.',
  },
];

export default function Access() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <PublicShell>
      <section className="mx-auto max-w-[1240px] px-5 pb-8 pt-14 lg:px-8">
        <div className="max-w-[720px]">
          <span className="eyebrow">
            Portal access
          </span>
          <h1 className="mt-5 text-[44px] font-extrabold leading-[1.02] md:text-[54px]">
            Choose the workspace that matches your role.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
            CRYPTORA separates administration, voting and independent oversight into three distinct portals. Each one
            enforces its own authorisation boundary on the server.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {DEMO.map((role) => (
            <div key={role.role} className="surface-card flex flex-col p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink/70">
                  {role.icon}
                </span>
                <span className="text-[11.5px] text-ink/40">Demo credentials</span>
              </div>
              <h2 className="mt-5 text-[20px] font-semibold">{role.role} portal</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/55">{role.detail}</p>
              <div className="mt-4 space-y-2 rounded-xl border border-line bg-canvas p-3">
                <DemoRow label={role.role === 'Voter' ? 'Voter ID' : 'Email'} value={role.id} onCopy={() => copy(`${role.role}-id`, role.id)} copied={copied === `${role.role}-id`} />
                <DemoRow label="Password" value={role.password} onCopy={() => copy(`${role.role}-pw`, role.password)} copied={copied === `${role.role}-pw`} />
              </div>
              <Button to={role.to} variant="primary" className="mt-4 w-full">
                Continue to sign in <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-10 lg:px-8" id="demo">
        <div className="surface-card p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="eyebrow">
                Demonstration mode
              </span>
              <h2 className="mt-4 text-[26px] font-bold">A prepared, three-role demonstration.</h2>
              <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink/60">
                The database ships with eight elections, 12,480 registered voter entries, 8,526 genuinely encrypted
                ballots and a signed consortium ledger — so every dashboard opens with real data.
              </p>
            </div>
            <Link to="/results" className="link-quiet">
              View public results
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <DemoStep
              index="A"
              title="Administrator"
              body="Review live elections, create a new election, register voters, publish the eligibility Merkle root, then open voting."
            />
            <DemoStep
              index="B"
              title="Voter"
              body="Sign in as Alex Morgan, open the live ballot, generate an eligibility proof in the browser, encrypt and submit."
            />
            <DemoStep
              index="C"
              title="Auditor"
              body="Verify a stored proof cryptographically, traverse the ledger, check validator signatures and export a PDF report."
            />
          </div>

          <div className="mt-6">
            <Callout tone="blue" title="What this prototype is — and is not" icon={<Users className="h-4 w-4" />}>
              CRYPTORA is an academic prototype. The five validators run as isolated logical identities inside a single
              Node.js process, and the Paillier tally key is held by the backend. It is designed to demonstrate the
              cryptography and consensus workflow — not to run a legally binding election.
            </Callout>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function DemoRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11.5px] text-ink/45">{label}</span>
      <button onClick={onCopy} className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11.5px] text-ink/70 hover:bg-white">
        {value}
        {copied ? <Check className="h-3 w-3 text-[#5C7A12]" /> : <Copy className="h-3 w-3 text-ink/30" />}
      </button>
    </div>
  );
}

function DemoStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[10.5px] font-semibold text-white">{index}</span>
        <p className="text-[13px] font-semibold">{title}</p>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink/55">{body}</p>
    </div>
  );
}
