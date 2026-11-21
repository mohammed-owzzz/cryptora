import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, FileText, Search } from 'lucide-react';
import { DOCS, DOC_GROUPS, docHref, searchDocs, type Doc, type Heading } from '../lib/docs';

function SearchBox({ onNavigate, autoFocus = false }: { onNavigate?: () => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const results = searchDocs(query);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (slug: string, anchor: string) => {
    setQuery('');
    setOpen(false);
    navigate(`${docHref(slug)}${anchor ? `#${anchor}` : ''}`);
    onNavigate?.();
  };

  return (
    <div ref={box} className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
      <input
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
          if (e.key === 'Enter' && results[0]) go(results[0].slug, results[0].anchor);
        }}
        placeholder="Search documentation"
        aria-label="Search documentation"
        className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-2.5 text-[12px] text-ink placeholder:text-ink/35 transition-[border-color,box-shadow] duration-200 focus:border-ink/25 focus:outline-none focus:ring-2 focus:ring-ink/10"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-[320px] overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lift scrollbar-thin">
          {results.length === 0 && <p className="px-3 py-2.5 text-[11.5px] text-ink/45">No matches in the six documents.</p>}
          {results.map((result) => (
            <button
              key={`${result.slug}-${result.anchor}-${result.heading}`}
              onClick={() => go(result.slug, result.anchor)}
              className="block w-full px-3 py-2 text-left transition-colors duration-150 hover:bg-surface"
            >
              <span className="block text-[11px] text-ink/40">{result.docTitle}</span>
              <span className="mt-0.5 block text-[12px] font-medium text-ink/80">{result.heading}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocsSidebar() {
  return (
    <div className="space-y-5">
      <SearchBox />
      <nav aria-label="Documentation" className="space-y-5">
        {DOC_GROUPS.map((group) => (
          <div key={group}>
            <p className="px-2 text-[10.5px] font-medium tracking-wide text-ink/35">{group.toUpperCase()}</p>
            <ul className="mt-1.5 space-y-0.5">
              {DOCS.filter((doc) => doc.group === group).map((doc) => (
                <li key={doc.slug}>
                  <NavLink
                    to={docHref(doc.slug)}
                    end
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2 rounded-md px-2 py-[6px] text-[12.5px] transition-[background-color,color] duration-200 ${
                        isActive ? 'bg-surface font-medium text-ink' : 'text-ink/55 hover:bg-surface/70 hover:text-ink'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`absolute inset-y-1 left-0 w-[2px] rounded-full bg-ink transition-transform duration-300 ${
                            isActive ? 'scale-y-100' : 'scale-y-0'
                          }`}
                          aria-hidden
                        />
                        <span className="truncate">{doc.navTitle}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="rounded-lg border border-line bg-surface/50 px-2.5 py-2">
        <p className="text-[10.5px] font-medium text-ink/50">Source of truth</p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-ink/40">
          Rendered at build time from the repository Markdown. Nothing here is a rewritten copy.
        </p>
      </div>
    </div>
  );
}

function Toc({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? '');

  useEffect(() => {
    if (headings.length === 0) return;
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-[11.5px]">
      <p className="text-[10.5px] font-medium tracking-wide text-ink/35">ON THIS PAGE</p>
      <ul className="mt-2 space-y-1 border-l border-line">
        {headings
          .filter((heading) => heading.level <= 3)
          .map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  const target = document.getElementById(heading.id);
                  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  history.replaceState(null, '', `#${heading.id}`);
                  setActive(heading.id);
                }}
                className={`-ml-px block border-l py-1 leading-snug transition-[color,border-color,padding] duration-200 ${
                  heading.level === 3 ? 'pl-5' : 'pl-3'
                } ${
                  active === heading.id
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink/45 hover:border-ink/30 hover:text-ink/75'
                }`}
              >
                {heading.text}
              </a>
            </li>
          ))}
      </ul>
    </nav>
  );
}

export function DocsLayout({
  doc,
  headings,
  children,
}: {
  doc: Doc;
  headings: Heading[];
  children: ReactNode;
}) {
  const location = useLocation();
  const index = DOCS.findIndex((item) => item.slug === doc.slug);
  const previous = index > 0 ? DOCS[index - 1] : null;
  const next = index >= 0 && index < DOCS.length - 1 ? DOCS[index + 1] : null;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[212px_minmax(0,1fr)] xl:grid-cols-[212px_minmax(0,1fr)_196px] xl:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-9 pr-2 scrollbar-thin">
            <DocsSidebar />
          </div>
        </aside>

        <article className="min-w-0 py-8 lg:py-10">
          <div className="lg:hidden">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] font-medium transition-colors duration-200 hover:bg-surface"
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-ink/40" /> Documentation menu
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-ink/40 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="mt-2 rounded-lg border border-line bg-white p-3">
                <DocsSidebar />
              </div>
            )}
            {headings.length > 1 && (
              <details className="group mt-2 rounded-lg border border-line bg-white px-3 py-2">
                <summary className="cursor-pointer list-none text-[12px] font-medium text-ink/65 marker:hidden">
                  On this page ({headings.filter((heading) => heading.level <= 3).length})
                </summary>
                <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
                  {headings
                    .filter((heading) => heading.level <= 3)
                    .map((heading) => (
                      <li key={heading.id}>
                        <a href={`#${heading.id}`} className="block text-[12px] text-ink/50 hover:text-ink">
                          {heading.text}
                        </a>
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </div>

          <nav aria-label="Breadcrumb" className="mt-6 flex items-center gap-2 text-[11.5px] text-ink/40 lg:mt-0">
            <Link to="/docs" className="transition-colors duration-150 hover:text-ink">
              Documentation
            </Link>
            <span aria-hidden>/</span>
            <span className="text-ink/65">{doc.title}</span>
          </nav>

          <header className="mt-3 border-b border-line pb-6">
            <h1 className="text-[30px] font-bold leading-[1.12] md:text-[36px]">{doc.title}</h1>
            <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink/55">{doc.description}</p>
            <p className="mono mt-3 text-[10.5px] text-ink/35">{doc.file}</p>
          </header>

          <div className="mt-7 min-w-0">{children}</div>

          <nav aria-label="Documentation pagination" className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
            {previous ? (
              <Link
                to={docHref(previous.slug)}
                className="group rounded-card border border-line bg-white p-4 transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-lift"
              >
                <span className="flex items-center gap-1.5 text-[11px] text-ink/40">
                  <ArrowLeft className="h-3 w-3 transition-transform duration-200 group-hover:-translate-x-0.5" /> Previous
                </span>
                <span className="mt-1 block text-[13px] font-medium">{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                to={docHref(next.slug)}
                className="group rounded-card border border-line bg-white p-4 text-right transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-lift sm:col-start-2"
              >
                <span className="flex items-center justify-end gap-1.5 text-[11px] text-ink/40">
                  Next <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-[13px] font-medium">{next.title}</span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-10 scrollbar-thin">
            <Toc headings={headings} />
          </div>
        </aside>
      </div>
    </div>
  );
}
