import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Eye, EyeOff, IdCard, Lock, Mail, Shield, ShieldCheck } from 'lucide-react';
import { AuthShell } from '../components/Layout';
import { Badge, Button, Checkbox, Field, Input } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui';

type Mode = 'admin' | 'voter' | 'auditor';

const COPY: Record<
  Mode,
  {
    eyebrow: string;
    headline: React.ReactNode;
    description: string;
    title: string;
    subtitle: string;
    identifierLabel: string;
    placeholder: string;
    button: string;
    footnote: React.ReactNode;
    trust: string[];
    demo: { id: string; password: string };
  }
> = {
  admin: {
    eyebrow: 'Secure administrator access',
    headline: (
      <>
        Control the integrity
        <br />
        of every election.
      </>
    ),
    description:
      'A secure workspace for authorised election administrators and consortium operations.',
    title: 'Administrator sign in',
    subtitle: 'Access your CRYPTORA management workspace.',
    identifierLabel: 'Institutional email',
    placeholder: 'admin@institution.edu',
    button: 'Continue securely',
    footnote: (
      <span className="inline-flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#5C7A12]" />
        Multi-factor verification required.
      </span>
    ),
    trust: ['Protected by multi-layer authentication', 'Institutional identity'],
    demo: { id: 'admin@cryptora.demo', password: 'Admin@1234!' },
  },
  voter: {
    eyebrow: 'Your voice matters',
    headline: (
      <>
        Your voice.
        <br />
        Your choice.
        <br />
        Your democracy.
      </>
    ),
    description:
      'Participate in secure digital elections through a privacy-preserving voting experience built on cryptographic verification and distributed trust.',
    title: 'Welcome back',
    subtitle: 'Sign in to access your eligible elections.',
    identifierLabel: 'Voter Identification Number',
    placeholder: 'Enter your voter ID',
    button: 'Verify & Continue',
    footnote: (
      <div>
        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink/60">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5C7A12]" />
          <span>
            <span className="font-semibold text-ink">Your privacy is protected.</span> Secure authentication and
            zero-knowledge verification help protect voter privacy throughout the election process.
          </span>
        </p>
        <Link to="/voter/help" className="link-quiet mt-3 inline-block">
          Need assistance? Contact voter support.
        </Link>
      </div>
    ),
    trust: ['Private participation', 'Verifiable ballots', 'Secure records'],
    demo: { id: 'VOTER-2026-0042', password: 'Voter@1234!' },
  },
  auditor: {
    eyebrow: 'Independent election oversight',
    headline: (
      <>
        Trust, backed by
        <br />
        verifiable evidence.
      </>
    ),
    description:
      'Access an independent auditing workspace to inspect election integrity, validate cryptographic proofs and review tamper-evident blockchain records.',
    title: 'Auditor sign in',
    subtitle: 'Sign in to access the CRYPTORA election auditing workspace.',
    identifierLabel: 'Institutional email',
    placeholder: 'auditor@institution.edu',
    button: 'Authenticate securely',
    footnote: (
      <div>
        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink/60">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5C7A12]" />
          <span>
            <span className="font-semibold text-ink">Protected auditor access.</span> Institutional email, auditor ID
            and password are required for authorised auditing sessions.
          </span>
        </p>
        <p className="mt-2 text-[11.5px] text-ink/45">Access is restricted to registered election auditors.</p>
      </div>
    ),
    trust: ['Institutional authentication', 'Secure audit access', 'Immutable ledger records', 'Independent verification'],
    demo: { id: 'jordan@cryptora.demo', password: 'Auditor@1234!', secondary: 'AUD-2026-001' } as any,
  },
};

function LoginPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [secondary, setSecondary] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim()) return setError(copy.identifierLabel + ' is required.');
    if (mode === 'auditor' && !secondary.trim()) return setError('Auditor ID is required.');
    if (password.length < 6) return setError('Enter your password (minimum 6 characters).');
    setLoading(true);
    try {
      const result = await login({ mode, identifier, secondary, password, remember });
      push({ title: 'Signed in securely', description: `Welcome back, ${result.user.name}.`, tone: 'success' });
      navigate(result.redirect, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setIdentifier(copy.demo.id);
    setPassword(copy.demo.password);
    if (mode === 'auditor') setSecondary((copy.demo as any).secondary ?? '');
    setError(null);
  };

  return (
    <AuthShell
      eyebrow={copy.eyebrow}
      headline={copy.headline}
      description={copy.description}
      trustItems={copy.trust}
      topRight={
        mode === 'voter' ? (
          <Link to="/admin/login" className="hidden text-[12.5px] text-ink/50 hover:text-ink md:inline">
            Administrator?
          </Link>
        ) : null
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[26px] font-bold leading-tight">{copy.title}</h2>
          <p className="mt-1 text-[13px] text-ink/55">{copy.subtitle}</p>
        </div>
      </div>

      {mode === 'auditor' && (
        <div className="mt-4">
          <Badge tone="lime">
            <Shield className="h-3 w-3" /> Authorised auditor access
          </Badge>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label={copy.identifierLabel} htmlFor="identifier" error={error ?? undefined}>
          <Input
            id="identifier"
            icon={mode === 'voter' ? <IdCard /> : <Mail />}
            placeholder={copy.placeholder}
            value={identifier}
            autoComplete="username"
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </Field>

        {mode === 'auditor' && (
          <Field label="Auditor ID" htmlFor="auditorId">
            <Input
              id="auditorId"
              icon={<IdCard />}
              placeholder="Enter your assigned auditor ID"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
            />
          </Field>
        )}

        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Lock className="input-icon" />
            <input
              id="password"
              type={show ? 'text' : 'password'}
              className="input-base pl-10 pr-10"
              placeholder="Enter your password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/35 transition hover:text-ink"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between gap-3">
          <Checkbox checked={remember} onChange={setRemember} label="Remember this device" />
          <Link to="/about" className="text-[12.5px] font-medium text-cobalt underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[10px] border border-[#F3D6D2] bg-[#FDF5F4] px-3 py-2.5 text-[12px] leading-snug text-[#A32218]"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-between px-5">
          <span>{loading ? 'Verifying credentials…' : copy.button}</span>
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <div className="mt-5 rounded-[10px] border border-line bg-surface/50 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11.5px] font-medium text-ink/50">Demonstration credentials</p>
          <button onClick={fillDemo} className="text-[11.5px] font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline">
            Fill form
          </button>
        </div>
        <div className="mt-2 space-y-1 font-mono text-[11.5px] text-ink/60">
          <p>{copy.demo.id}</p>
          <p>
            {copy.demo.password}
            {mode === 'auditor' ? ' · AUD-2026-001' : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 text-center text-[11.5px] text-ink/45">{copy.footnote}</div>
      {mode === 'admin' && <p className="mt-3 text-center text-[11.5px] text-ink/40">Authorised administrators only.</p>}
    </AuthShell>
  );
}

export function AdminLogin() {
  return <LoginPage mode="admin" />;
}
export function VoterLogin() {
  return <LoginPage mode="voter" />;
}
export function AuditorLogin() {
  return <LoginPage mode="auditor" />;
}
