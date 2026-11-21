import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, BadgeCheck, Check, Info, Loader2, ShieldCheck, UserRound, Vote, X } from 'lucide-react';

/* --------------------------------- Button -------------------------------- */

type Variant = 'primary' | 'lime' | 'outline' | 'ghost' | 'danger' | 'cobalt';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-[#26281f] active:bg-[#26281f]',
  lime: 'bg-lime text-ink hover:bg-[#bff04a] active:bg-[#b6e63f]',
  outline: 'border border-line bg-white text-ink hover:border-ink/20 hover:bg-surface',
  ghost: 'text-ink/70 hover:bg-surface hover:text-ink',
  danger: 'bg-[#B42318] text-white hover:bg-[#9d1e14]',
  cobalt: 'bg-cobalt text-white hover:bg-[#1c40b4]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-[8px]',
  md: 'h-10 px-4 text-[13px] gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-[13.5px] gap-2 rounded-[10px]',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  to,
  className = '',
  ...props
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  to?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = `group inline-flex select-none items-center justify-center font-medium transition-[background-color,border-color,color,transform,box-shadow,gap] duration-200 ease-out [&>svg]:transition-transform [&>svg]:duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_16px_-12px_rgba(17,18,16,0.5)] hover:[&>svg:last-child]:translate-x-0.5 active:translate-y-0 active:scale-[0.985] active:shadow-none active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
      {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* --------------------------------- Avatar -------------------------------- */

const AVATAR_ROLE = {
  ADMIN: { Icon: ShieldCheck, label: 'Administrator account' },
  AUDITOR: { Icon: BadgeCheck, label: 'Auditor account' },
  VOTER: { Icon: Vote, label: 'Voter account' },
} as const;

/**
 * A branded account mark used instead of name initials: a dark squircle with a
 * lime inner glow, the role glyph and a small presence dot.
 */
export function Avatar({
  role,
  size = 'md',
  className = '',
}: {
  role?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dims = {
    sm: 'h-8 w-8 rounded-[10px]',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-14 w-14 rounded-2xl',
  }[size];
  const iconSize = { sm: 'h-4 w-4', md: 'h-[18px] w-[18px]', lg: 'h-6 w-6' }[size];
  const meta = AVATAR_ROLE[(role ?? '') as keyof typeof AVATAR_ROLE] ?? { Icon: UserRound, label: 'Account' };
  const Icon = meta.Icon;

  return (
    <span
      role="img"
      aria-label={meta.label}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#191C12] text-lime shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${dims} ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(198,246,90,0.24)_0%,rgba(198,246,90,0.06)_40%,transparent_64%)]"
      />
      <Icon className={`relative ${iconSize}`} strokeWidth={1.9} aria-hidden />
      {size !== 'sm' && (
        <span
          aria-hidden
          className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-lime ring-2 ring-[#191C12]"
        />
      )}
    </span>
  );
}

/* --------------------------------- Badge --------------------------------- */

type BadgeTone = 'lime' | 'blue' | 'neutral' | 'danger' | 'outline';

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    lime: 'bg-[#F2FADF] text-[#3f5410] border-[#D8EEA9]',
    blue: 'bg-[#F2F5FE] text-[#1B3EAF] border-[#D9E2FB]',
    neutral: 'bg-surface text-ink/60 border-line',
    danger: 'bg-[#FDF1F0] text-[#A32218] border-[#F3D6D2]',
    outline: 'bg-white text-ink/65 border-line',
  };
  const dots: Record<BadgeTone, string> = {
    lime: 'bg-[#8FD01A]',
    blue: 'bg-cobalt',
    neutral: 'bg-ink/30',
    danger: 'bg-[#D92D20]',
    outline: 'bg-ink/30',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] font-medium ${tones[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  LIVE: 'lime',
  COMPLETED: 'lime',
  VALID: 'lime',
  VERIFIED: 'lime',
  ELIGIBLE: 'lime',
  ACHIEVED: 'lime',
  CONFIRMED: 'lime',
  HEALTHY: 'lime',
  SCHEDULED: 'blue',
  TALLYING: 'blue',
  REJECTED: 'danger',
  FAILED: 'danger',
  'INTEGRITY FAILURE': 'danger',
};

export function StatusBadge({ status, className = '' }: { status?: string | null; className?: string }) {
  const label = status ? status.toLowerCase().replace(/_/g, ' ') : '—';
  return (
    <Badge tone={status ? (STATUS_TONE[status] ?? 'neutral') : 'neutral'} dot className={`capitalize ${className}`}>
      {label}
    </Badge>
  );
}

/* ---------------------------------- Card --------------------------------- */

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={`surface-card ${padded ? 'p-5' : ''} ${className}`}>{children}</div>;
}

export function SectionHeading({
  title,
  description,
  action,
  className = '',
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-[15.5px] font-semibold leading-snug">{title}</h3>
        {description && <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink/55">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className = '',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-2.5">{eyebrow}</div>}
        <h1 className="text-[26px] font-bold leading-[1.15] md:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink/55">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  loading = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: 'lime' | 'neutral';
  loading?: boolean;
}) {
  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-ink/50">{label}</p>
          {loading ? (
            <div className="mt-2.5 h-7 w-24 skeleton" />
          ) : (
            <p className="mt-1.5 font-display text-[25px] font-bold leading-none">{value}</p>
          )}
        </div>
        {icon && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              tone === 'lime' ? 'border-[#D8EEA9] bg-[#F2FADF] text-[#4c6b10]' : 'border-line bg-surface text-ink/45'
            }`}
          >
            {icon}
          </span>
        )}
      </div>
      {hint && <p className="mt-3 text-[11.5px] leading-snug text-ink/45">{hint}</p>}
    </div>
  );
}

/* --------------------------------- Inputs -------------------------------- */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="error-in mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-[#A32218]">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[11.5px] leading-snug text-ink/45">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  icon,
  className = '',
  ...props
}: { icon?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {icon && (
        <span className="input-icon" aria-hidden>
          {icon}
        </span>
      )}
      <input className={`input-base ${icon ? 'pl-10' : ''} ${className}`} {...props} />
    </div>
  );
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input-base select-base ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input-base min-h-[96px] resize-y py-2.5 leading-relaxed ${className}`} {...props} />;
}

export function Checkbox({
  label,
  checked,
  onChange,
  id,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="group flex cursor-pointer select-none items-center gap-2.5 text-[12.5px] text-ink/70">
      <span
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-[background-color,border-color,transform] duration-200 ease-out group-active:scale-90 ${
          checked ? 'border-ink bg-ink text-white' : 'border-line bg-white group-hover:border-ink/30'
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input id={id} type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`relative w-full ${width} max-h-[calc(100vh-2rem)] overflow-y-auto rounded-card border border-line bg-white p-6 shadow-lift focus:outline-none`}
            initial={{ opacity: 0, y: reduce ? 0 : 14, scale: reduce ? 1 : 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.99 }}
            transition={{ duration: reduce ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id={titleId} className="text-[16.5px] font-semibold leading-snug">
                  {title}
                </h3>
                {description && <p className="mt-1 text-[12.5px] leading-relaxed text-ink/55">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink/40 transition-[background-color,color,transform] duration-200 hover:rotate-90 hover:bg-surface hover:text-ink"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children && <div className="mt-5">{children}</div>}
            {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* --------------------------------- Toasts -------------------------------- */

type Toast = { id: number; title: string; description?: string; tone: 'success' | 'error' | 'info' };
type ToastInput = { title: string; description?: string; tone?: 'success' | 'error' | 'info' };

const ToastContext = createContext<{ push: (t: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const reduce = useReducedMotion();

  const push = useCallback((t: ToastInput) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, tone: 'success', ...t }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(370px,calc(100vw-2rem))] flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: reduce ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : 6 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-start gap-3 rounded-card border border-line bg-white p-3.5 shadow-lift"
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  t.tone === 'error'
                    ? 'bg-[#FDF1F0] text-[#A32218]'
                    : t.tone === 'info'
                      ? 'bg-[#F2F5FE] text-cobalt'
                      : 'bg-[#F2FADF] text-[#4c6b10]'
                }`}
              >
                {t.tone === 'error' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : t.tone === 'info' ? (
                  <Info className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold leading-snug">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12px] leading-snug text-ink/60">{t.description}</p>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-ink/30 transition-colors duration-150 hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/* ------------------------------- Empty state ----------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink/30">{icon}</div>}
      <p className="text-[13.5px] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink/55">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function Callout({
  tone = 'neutral',
  title,
  children,
  icon,
}: {
  tone?: 'neutral' | 'lime' | 'blue' | 'danger';
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    neutral: 'border-line bg-surface/60',
    lime: 'border-[#D8EEA9] bg-[#F5FBE8]',
    blue: 'border-[#D9E2FB] bg-[#F5F8FF]',
    danger: 'border-[#F3D6D2] bg-[#FDF5F4]',
  };
  return (
    <div className={`flex items-start gap-3 rounded-card border p-4 ${tones[tone]}`}>
      {icon && <span className="mt-0.5 shrink-0 text-ink/45">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="text-[12.5px] font-semibold">{title}</p>}
        <div className={`text-[12.5px] leading-relaxed text-ink/60 ${title ? 'mt-1' : ''}`}>{children}</div>
      </div>
    </div>
  );
}

export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((step, i) => {
        const index = i + 1;
        const active = index === current;
        const done = index < current;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-200 ${
                done || active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink/40'
              }`}
            >
              {done ? <Check className="h-3 w-3" strokeWidth={3} /> : index}
            </span>
            <span className={`text-[12px] font-medium ${active ? 'text-ink' : 'text-ink/45'}`}>{step}</span>
            {i < steps.length - 1 && <span className="ml-1 hidden h-px w-8 bg-line sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
