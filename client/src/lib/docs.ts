import readme from '../../../README.md?raw';
import architecture from '../../../docs/ARCHITECTURE.md?raw';
import blockchain from '../../../docs/BLOCKCHAIN.md?raw';
import zkp from '../../../docs/ZKP.md?raw';
import security from '../../../docs/SECURITY.md?raw';
import demoGuide from '../../../docs/DEMO_GUIDE.md?raw';

export type DocGroup = 'Start' | 'Concepts' | 'Assurance';

export interface Doc {
  slug: string;
  file: string;
  title: string;
  navTitle: string;
  description: string;
  group: DocGroup;
  source: string;
  diagram?: 'architecture' | 'blockchain' | 'zkp' | 'security' | 'workflow';
}

export const DOCS: Doc[] = [
  {
    slug: 'getting-started',
    file: 'README.md',
    title: 'Getting started',
    navTitle: 'Getting started',
    description: 'Setup, demonstration dataset, architecture at a glance and the honest limitations of this build.',
    group: 'Start',
    source: readme,
  },
  {
    slug: 'architecture',
    file: 'docs/ARCHITECTURE.md',
    title: 'Architecture',
    navTitle: 'Architecture',
    description: 'Components, data model, election lifecycle and the ballot acceptance pipeline.',
    group: 'Concepts',
    source: architecture,
    diagram: 'architecture',
  },
  {
    slug: 'blockchain',
    file: 'docs/BLOCKCHAIN.md',
    title: 'Consortium blockchain',
    navTitle: 'Consensus and ledger',
    description: 'Block format, transaction types, validator behaviour, quorum and full-chain verification.',
    group: 'Concepts',
    source: blockchain,
    diagram: 'blockchain',
  },
  {
    slug: 'zkp',
    file: 'docs/ZKP.md',
    title: 'Zero-knowledge proofs',
    navTitle: 'Zero-knowledge proofs',
    description: 'The eligibility claim, the Circom circuit, witness construction, proving and verification.',
    group: 'Concepts',
    source: zkp,
    diagram: 'zkp',
  },
  {
    slug: 'security',
    file: 'docs/SECURITY.md',
    title: 'Security model',
    navTitle: 'Security model',
    description: 'Assets, threat model, separation of identity and ballot, cryptographic parameters and audit trail.',
    group: 'Assurance',
    source: security,
    diagram: 'security',
  },
  {
    slug: 'demo-guide',
    file: 'docs/DEMO_GUIDE.md',
    title: 'Demonstration guide',
    navTitle: 'Demonstration guide',
    description: 'A fifteen-minute review script with the expected output of every step.',
    group: 'Assurance',
    source: demoGuide,
    diagram: 'workflow',
  },
];

export const DOC_GROUPS: DocGroup[] = ['Start', 'Concepts', 'Assurance'];

export function getDoc(slug?: string): Doc | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}

export function docHref(slug: string) {
  return slug === 'getting-started' ? '/docs/getting-started' : `/docs/${slug}`;
}

/* --------------------------------- Headings -------------------------------- */

export interface Heading {
  id: string;
  text: string;
  level: number;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function stripInline(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let fenced = false;
  const seen = new Map<string, number>();
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = stripInline(match[2]);
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    headings.push({ id: count ? `${base}-${count}` : base, text, level: match[1].length });
  }
  return headings;
}

/* ---------------------------------- Search --------------------------------- */

export interface SearchEntry {
  slug: string;
  docTitle: string;
  heading: string;
  anchor: string;
  text: string;
}

function buildSearchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const doc of DOCS) {
    const lines = doc.source.split('\n');
    let fenced = false;
    let heading = doc.title;
    let anchor = '';
    let buffer: string[] = [];
    let currentLevel = 0;

    const push = () => {
      const text = stripInline(buffer.join(' '));
      if (text.length > 0) {
        entries.push({
          slug: doc.slug,
          docTitle: doc.title,
          heading,
          anchor,
          text: text.slice(0, 260),
        });
      }
      buffer = [];
    };

    for (const line of lines) {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
      if (match) {
        push();
        const level = match[1].length;
        if (level <= 2 || !anchor) {
          heading = stripInline(match[2]) || doc.title;
          anchor = level === 1 ? '' : slugify(heading);
          currentLevel = level;
        }
        continue;
      }
      if (line.trim()) buffer.push(line.trim());
    }
    push();
  }
  return entries;
}

export const SEARCH_INDEX: SearchEntry[] = buildSearchIndex();

export function searchDocs(query: string, limit = 12): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/);
  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of SEARCH_INDEX) {
    const haystack = `${entry.docTitle} ${entry.heading} ${entry.text}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) continue;
    let score = 0;
    if (entry.heading.toLowerCase().includes(q)) score += 6;
    if (entry.docTitle.toLowerCase().includes(q)) score += 3;
    score += terms.filter((term) => entry.text.toLowerCase().includes(term)).length;
    scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}
