import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, FileText, Search } from 'lucide-react';
import { PublicShell } from '../components/Layout';
import { DocsLayout } from '../components/DocsLayout';
import { Markdown } from '../components/Markdown';
import { Reveal } from '../components/Motion';
import {
  ConsensusDiagram,
  ElectionLifecycle,
  SecurityBoundary,
  SystemArchitecture,
  VotingWorkflow,
  ZkpLifecycle,
} from '../components/Diagrams';
import { Button } from '../components/ui';
import { DOCS, DOC_GROUPS, docHref, extractHeadings, getDoc, type Doc } from '../lib/docs';
import NotFound from './NotFound';

function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="not-prose my-8">
      {children}
      <figcaption className="mt-2 text-[11px] leading-relaxed text-ink/40">{caption}</figcaption>
    </figure>
  );
}

function DiagramFor({ doc }: { doc: Doc }) {
  if (doc.diagram === 'architecture') {
    return (
      <Figure caption="Figure 1 — Components and data flow as implemented in this repository. Select a component to read its responsibility.">
        <SystemArchitecture />
        <div className="mt-3">
          <ElectionLifecycle />
        </div>
      </Figure>
    );
  }
  if (doc.diagram === 'blockchain') {
    return (
      <>
        <Figure caption="Figure 1 — Five validator identities sign one canonical block header; four signatures reach quorum.">
          <ConsensusDiagram />
        </Figure>
        <Figure caption="Figure 2 — Election state transitions. Each transition is audited and written to the ledger.">
          <div className="rounded-card border border-line bg-white p-4">
            <ElectionLifecycle />
          </div>
        </Figure>
      </>
    );
  }
  if (doc.diagram === 'zkp') {
    return (
      <Figure caption="Figure 1 — Private witness inputs stay in the browser. Only the three public signals reach the verifier.">
        <ZkpLifecycle />
      </Figure>
    );
  }
  if (doc.diagram === 'security') {
    return (
      <Figure caption="Figure 1 — Identity and ballot data are separate. No API response joins the two sides.">
        <SecurityBoundary />
      </Figure>
    );
  }
  if (doc.diagram === 'workflow') {
    return (
      <Figure caption="Figure 1 — The eight stages of a ballot, matching the review script below. Select a stage for detail.">
        <VotingWorkflow />
      </Figure>
    );
  }
  return null;
}

export function DocsHome() {
  useEffect(() => {
    document.title = 'Documentation — CRYPTORA';
    return () => {
      document.title = 'CRYPTORA — Secure digital democracy';
    };
  }, []);

  return (
    <PublicShell>
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1200px] px-5 py-14 lg:px-8 lg:py-20">
          <p className="eyebrow">Documentation</p>
          <h1 className="mt-5 max-w-[760px] text-[36px] font-bold leading-[1.06] md:text-[48px]">
            Everything the system does, written down and kept in the application.
          </h1>
          <p className="mt-4 max-w-[620px] text-[14.5px] leading-relaxed text-ink/60">
            Six documents describe the architecture, consensus, proofs, security model and review script. They are
            rendered directly from the repository Markdown, so the site and the source cannot drift apart.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button to="/docs/getting-started" size="lg">
              Start with getting started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button to="/docs/demo-guide" variant="outline" size="lg">
              Open the review script
            </Button>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 text-[11.5px] text-ink/40">
            <Search className="h-3.5 w-3.5" /> Search across all six documents from any documentation page.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-12 lg:px-8 lg:py-16">
        <div className="space-y-10">
          {DOC_GROUPS.map((group) => (
            <div key={group} className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)] md:gap-10">
              <p className="pt-1 text-[11px] font-medium tracking-wide text-ink/35">{group.toUpperCase()}</p>
              <ul className="border-t border-line">
                {DOCS.filter((doc) => doc.group === group).map((doc) => (
                  <Reveal as="li" key={doc.slug} className="border-b border-line">
                    <Link
                      to={docHref(doc.slug)}
                      className="group grid gap-1.5 py-5 transition-[padding] duration-200 ease-out hover:pl-1 sm:grid-cols-[minmax(0,1fr)_240px_20px] sm:items-center sm:gap-6"
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[14.5px] font-semibold">
                          <FileText className="h-3.5 w-3.5 text-ink/30" aria-hidden />
                          {doc.title}
                        </p>
                        <p className="mt-1 max-w-[520px] text-[12.5px] leading-relaxed text-ink/50">{doc.description}</p>
                      </div>
                      <span className="mono text-[10.5px] text-ink/30 sm:text-right">{doc.file}</span>
                      <ArrowRight className="hidden h-4 w-4 text-ink/20 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink/50 sm:block" />
                    </Link>
                  </Reveal>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-start justify-between gap-4 rounded-card border border-line bg-white p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 text-ink/40" />
            <div>
              <p className="text-[13px] font-semibold">Reading during a review</p>
              <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-ink/55">
                Each page has a table of contents, a copy control on every code block and previous/next navigation.
                Long tables scroll inside their own container instead of widening the page.
              </p>
            </div>
          </div>
          <Link to="/docs/getting-started" className="link-quiet">
            Open getting started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}

export default function DocPage() {
  const { slug } = useParams();
  const doc = getDoc(slug);

  useEffect(() => {
    if (doc) document.title = `${doc.title} — CRYPTORA documentation`;
    return () => {
      document.title = 'CRYPTORA — Secure digital democracy';
    };
  }, [doc]);

  if (!doc) return <NotFound />;

  const headings = extractHeadings(doc.source);

  return (
    <PublicShell>
      <DocsLayout doc={doc} headings={headings}>
        <DiagramFor doc={doc} />
        <Markdown source={doc.source} />
      </DocsLayout>
    </PublicShell>
  );
}
