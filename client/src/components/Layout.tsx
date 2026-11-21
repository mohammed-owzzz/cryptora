import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  FileText,
  Fingerprint,
  HelpCircle,
  History,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Logo, LogoMark } from './Logo';
import { PageTransition } from './Motion';
import { useAuth } from '../lib/auth';
import { Avatar } from './ui';

/* ------------------------------- Public site ----------------------------- */

const PUBLIC_NAV = [
  { label: 'Platform', to: '/platform' },
  { label: 'Security', to: '/security' },
  { label: 'How it works', to: '/how-it-works' },
  { label: 'About', to: '/about' },
  { label: 'Results', to: '/results' },
  { label: 'Documentation', to: '/docs' },
];

export function PublicShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dashboard =
    user?.role === 'ADMIN'
      ? '/admin/dashboard'
      : user?.role === 'VOTER'
        ? '/voter/dashboard'
        : user?.role === 'AUDITOR'
          ? '/auditor/dashboard'
          : '/access';

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
              {PUBLIC_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to !== '/docs'}
                  className="nav-link"
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <Link
              to={user ? dashboard : '/access'}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-ink px-4 text-[12.5px] font-medium text-white transition-[background-color,transform] duration-200 ease-out hover:-translate-y-[1px] hover:bg-[#26281f] active:translate-y-0"
            >
              {user ? 'Open workspace' : 'Sign in'}
              {!user && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
            </Link>
          </div>
          <button
            ref={menuButtonRef}
            className="rounded-lg p-2 text-ink/60 transition-colors hover:bg-surface hover:text-ink md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              id="public-mobile-nav"
              className="overflow-hidden border-t border-line bg-canvas md:hidden"
            >
              <nav className="px-5 py-3" aria-label="Mobile">
                {PUBLIC_NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block rounded-lg px-2 py-2.5 text-[14px] text-ink/70 transition-colors hover:bg-surface hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to={user ? dashboard : '/access'}
                  className="mt-2 flex items-center justify-center gap-2 rounded-[10px] bg-ink px-3 py-2.5 text-center text-[13px] font-medium text-white transition-[background-color,transform] duration-200 active:scale-[0.985]"
                >
                  {user ? 'Open workspace' : 'Sign in'}
                  {!user && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <main>
        <PageTransition>{children}</PageTransition>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[12.5px] leading-relaxed text-ink/55">
            A secure, privacy-preserving e-voting prototype built on a consortium ledger and zero-knowledge proofs.
          </p>
          <p className="mt-4 text-[11.5px] leading-relaxed text-ink/40">
            Academic prototype · Shree L.R. Tiwari College of Engineering
            <br />
            Department of Computer Engineering · AY26BECSA11
          </p>
        </div>
        <FooterColumn
          title="Platform"
          links={[
            { label: 'Overview', to: '/platform' },
            { label: 'Security architecture', to: '/security' },
            { label: 'How it works', to: '/how-it-works' },
            { label: 'Public results', to: '/results' },
          ]}
        />
        <FooterColumn
          title="Access"
          links={[
            { label: 'Administrator portal', to: '/admin/login' },
            { label: 'Voter portal', to: '/voter/login' },
            { label: 'Auditor portal', to: '/auditor/login' },
            { label: 'Sign in', to: '/access' },
          ]}
        />
        <FooterColumn
          title="Project"
          links={[
            { label: 'About CRYPTORA', to: '/about' },
            { label: 'Documentation', to: '/docs' },
            { label: 'Consortium ledger', to: '/security#blockchain' },
            { label: 'Zero-knowledge proofs', to: '/security#zkp' },
            { label: 'Demonstration guide', to: '/docs/demo-guide' },
          ]}
        />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-[11.5px] text-ink/45 lg:px-8">
          <p>© {new Date().getFullYear()} CRYPTORA</p>
          <div className="flex items-center gap-5">
            <Link to="/docs" className="transition-colors hover:text-ink">
              Documentation
            </Link>
            <Link to="/security" className="transition-colors hover:text-ink">
              Security
            </Link>
            <Link to="/about" className="transition-colors hover:text-ink">
              Project
            </Link>
            <span>Demonstration environment</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-ink/45">{title}</p>
      <ul className="mt-3.5 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-[12.5px] text-ink/60 transition-colors duration-150 hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- Auth ---------------------------------- */

export function AuthShell({
  children,
  eyebrow,
  headline,
  description,
  trustItems,
  topRight,
  footerNote,
}: {
  children: ReactNode;
  eyebrow: string;
  headline: ReactNode;
  description: string;
  trustItems: string[];
  topRight?: ReactNode;
  footerNote?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 lg:px-8">
          <Logo />
          <div className="flex items-center gap-5">
            {topRight}
            <Link to="/" className="text-[12.5px] font-medium text-ink/55 transition-colors hover:text-ink">
              Return to homepage
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <PageTransition className="mx-auto grid w-full max-w-[1200px] items-start gap-10 px-5 py-10 lg:grid-cols-[1fr_420px] lg:gap-16 lg:py-16 lg:px-8">
        <div className="max-w-[520px]">
          <p className="text-[12px] font-medium text-ink/45">{eyebrow}</p>
          <h1 className="mt-4 text-[34px] font-bold leading-[1.1] md:text-[42px]">{headline}</h1>
          <p className="mt-4 max-w-[440px] text-[14px] leading-relaxed text-ink/55">{description}</p>
          <ul className="mt-8 space-y-2.5 border-t border-line pt-6">
            {trustItems.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-[12.5px] text-ink/55">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-ink/30" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full">
          <div className="surface-card p-6 md:p-7">{children}</div>
          {footerNote && <div className="mt-4 text-center text-[11.5px] text-ink/45">{footerNote}</div>}
        </div>
        </PageTransition>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-[11.5px] text-ink/45 lg:px-8">
          <Logo compact />
          <p>Academic prototype · Demonstration environment</p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------- Dashboards ------------------------------ */

export interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to.endsWith('dashboard') || item.to.endsWith('overview')}
      className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
    >
      <span className="text-ink/45">{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function UserMenu({ homePath, onLogout }: { homePath: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-1 transition-colors hover:bg-surface"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar role={user?.role} size="sm" />
        <span className="hidden max-w-[140px] truncate text-[12.5px] font-medium sm:block">{user?.name ?? 'Guest'}</span>
        <ChevronDown className={`hidden h-3.5 w-3.5 text-ink/35 transition-transform duration-200 sm:block ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-[10px] border border-line bg-white py-1 shadow-lift"
            >
              <Link
                to={homePath.replace('/dashboard', '/profile')}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-ink/70 transition-colors hover:bg-surface hover:text-ink"
              >
                <User className="h-3.5 w-3.5" /> Profile
              </Link>
              <button
                role="menuitem"
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink/70 transition-colors hover:bg-surface hover:text-ink"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DashboardShell({
  sections,
  roleLabel,
  topActions,
  children,
  homePath,
  note,
}: {
  sections: NavSection[];
  roleLabel: string;
  topActions?: ReactNode;
  children: ReactNode;
  homePath: string;
  note?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const onLogout = async () => {
    await logout();
    navigate('/access');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo to={homePath} compact />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Workspace">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="nav-section">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar role={user?.role} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium">{user?.name ?? 'Guest'}</span>
            <span className="block truncate text-[11px] text-ink/45">{roleLabel.toLowerCase()}</span>
          </span>
        </div>
        <button
          onClick={onLogout}
          className="nav-item mt-1 w-full"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-white lg:block">{sidebar}</aside>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          >
            <div className="absolute inset-0 bg-ink/25" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ x: reduce ? 0 : -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: reduce ? 0 : -12, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-full w-[264px] border-r border-line bg-white"
            >
              {sidebar}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-canvas/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-ink/60 transition-colors hover:bg-surface hover:text-ink lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            {roleLabel === 'ADMIN' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (search.trim()) navigate(`/admin/voters?search=${encodeURIComponent(search.trim())}`);
                }}
                className="relative hidden md:block"
                role="search"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search voters, elections, records"
                  aria-label="Search"
                  className="h-9 w-[280px] rounded-[10px] border border-line bg-white pl-9 pr-3 text-[12.5px] placeholder:text-ink/35 focus:outline-none"
                />
              </form>
            )}
          </div>
          <div className="flex items-center gap-3">
            {topActions}
            <span className="hidden text-[12px] text-ink/45 sm:block">
              {roleLabel === 'VOTER' ? 'Verified voter' : roleLabel === 'AUDITOR' ? 'Read-only auditor' : 'Administrator'}
            </span>
            <UserMenu homePath={homePath} onLogout={onLogout} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] overflow-x-hidden px-4 py-7 md:px-8 md:py-9">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="mt-4 border-t border-line px-4 py-4 md:px-8">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 text-[11.5px] text-ink/40">
            <span className="inline-flex items-center gap-2">
              <LogoMark size={16} /> CRYPTORA
            </span>
            {note ?? <span>Demonstration dataset · Academic prototype</span>}
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------ Role shells ------------------------------ */

const ic = (node: ReactNode) => <span className="[&>svg]:h-[16px] [&>svg]:w-[16px]">{node}</span>;

export function AdminShell() {
  const sections: NavSection[] = [
    {
      label: 'Elections',
      items: [
        { label: 'Dashboard', to: '/admin/dashboard', icon: ic(<LayoutDashboard />) },
        { label: 'Elections', to: '/admin/elections', icon: ic(<CalendarCheck />) },
        { label: 'Voter registry', to: '/admin/voters', icon: ic(<Users />) },
        { label: 'Candidates', to: '/admin/candidates', icon: ic(<Users />) },
        { label: 'Ballot management', to: '/admin/ballot-management', icon: ic(<Vote />) },
        { label: 'Results', to: '/admin/results', icon: ic(<BarChart3 />) },
      ],
    },
    {
      label: 'Ledger',
      items: [
        { label: 'Consortium network', to: '/admin/blockchain', icon: ic(<Network />) },
        { label: 'Validator nodes', to: '/admin/validators', icon: ic(<Boxes />) },
        { label: 'Transaction ledger', to: '/admin/ledger', icon: ic(<ListChecks />) },
        { label: 'ZKP verification', to: '/admin/zkp-verification', icon: ic(<ShieldCheck />) },
      ],
    },
    {
      label: 'Administration',
      items: [
        { label: 'Audit logs', to: '/admin/audit-logs', icon: ic(<ClipboardList />) },
        { label: 'Reports', to: '/admin/reports', icon: ic(<FileText />) },
        { label: 'Settings', to: '/admin/settings', icon: ic(<Settings />) },
      ],
    },
  ];
  return (
    <DashboardShell sections={sections} roleLabel="ADMIN" homePath="/admin/dashboard">
      <Outlet />
    </DashboardShell>
  );
}

export function VoterShell() {
  const { user } = useAuth();
  const sections: NavSection[] = [
    {
      label: 'Voting',
      items: [
        { label: 'Overview', to: '/voter/dashboard', icon: ic(<LayoutDashboard />) },
        { label: 'Available elections', to: '/voter/elections', icon: ic(<CalendarCheck />) },
        { label: 'Voting history', to: '/voter/history', icon: ic(<History />) },
        { label: 'Election results', to: '/voter/results', icon: ic(<BarChart3 />) },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Profile', to: '/voter/profile', icon: ic(<User />) },
        { label: 'Security and privacy', to: '/voter/security', icon: ic(<Fingerprint />) },
        { label: 'Help centre', to: '/voter/help', icon: ic(<HelpCircle />) },
      ],
    },
  ];
  return (
    <DashboardShell
      sections={sections}
      roleLabel="VOTER"
      homePath="/voter/dashboard"
      note={<span>{user?.name} · ballot records are never linked to selections</span>}
    >
      <Outlet />
    </DashboardShell>
  );
}

export function AuditorShell() {
  const sections: NavSection[] = [
    {
      label: 'Audit',
      items: [
        { label: 'Overview', to: '/auditor/dashboard', icon: ic(<LayoutDashboard />) },
        { label: 'Election audits', to: '/auditor/elections', icon: ic(<CalendarCheck />) },
        { label: 'Blockchain ledger', to: '/auditor/ledger', icon: ic(<ListChecks />) },
        { label: 'ZKP verification', to: '/auditor/zkp-verification', icon: ic(<ShieldCheck />) },
        { label: 'Validator network', to: '/auditor/validators', icon: ic(<Network />) },
        { label: 'Ballot integrity', to: '/auditor/ballot-integrity', icon: ic(<Shield />) },
        { label: 'Audit reports', to: '/auditor/reports', icon: ic(<FileText />) },
      ],
    },
    {
      label: 'Account',
      items: [
        { label: 'Profile', to: '/auditor/profile', icon: ic(<User />) },
        { label: 'Security settings', to: '/auditor/security', icon: ic(<SlidersHorizontal />) },
        { label: 'Help centre', to: '/auditor/help', icon: ic(<BookOpen />) },
      ],
    },
  ];
  return (
    <DashboardShell sections={sections} roleLabel="AUDITOR" homePath="/auditor/dashboard">
      <Outlet />
    </DashboardShell>
  );
}
