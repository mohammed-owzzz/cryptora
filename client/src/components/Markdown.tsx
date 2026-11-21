import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { DOCS, slugify } from '../lib/docs';

/**
 * Renders the repository's own Markdown at build time (Vite `?raw`), sanitised
 * with DOMPurify before it reaches the DOM. Code blocks get a copy control and
 * headings get stable ids so the table of contents and deep links work.
 */

const FILE_TO_ROUTE: Record<string, string> = Object.fromEntries(
  DOCS.map((doc) => [doc.file.replace(/^\.\//, ''), `/docs/${doc.slug}`]),
);

function routeForHref(href: string): string | null {
  const cleaned = href.replace(/^\.\//, '').split('#')[0];
  if (FILE_TO_ROUTE[cleaned]) return FILE_TO_ROUTE[cleaned];
  if (href.startsWith('/')) return href;
  return null;
}

export function Markdown({ source }: { source: string }) {
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const html = useMemo(() => {
    const raw = marked.parse(source, { gfm: true, async: false }) as string;
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'script'],
      FORBID_ATTR: ['style', 'onsubmit', 'onerror', 'onload'],
    });
  }, [source]);

  useEffect(() => {
    const root = container.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>('h2, h3, h4').forEach((heading) => {
      if (!heading.id) heading.id = slugify(heading.textContent ?? '');
    });

    root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
      if (table.parentElement?.classList.contains('table-scroll')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    root.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
      if (pre.parentElement?.classList.contains('code-shell')) return;
      const shell = document.createElement('div');
      shell.className = 'code-shell';
      pre.parentNode?.insertBefore(shell, pre);

      const head = document.createElement('div');
      head.className = 'code-head';
      shell.appendChild(head);
      shell.appendChild(pre);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy code to clipboard');
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(pre.innerText);
          button.textContent = 'Copied';
          button.dataset.copied = 'true';
          window.setTimeout(() => {
            button.textContent = 'Copy';
            delete button.dataset.copied;
          }, 1600);
        } catch {
          button.textContent = 'Copy failed';
          window.setTimeout(() => {
            button.textContent = 'Copy';
          }, 1600);
        }
      });
      head.appendChild(button);
    });

    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [html, location.hash]);

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;

      if (href.startsWith('#')) {
        const target = root.querySelector<HTMLElement>(`[id="${href.slice(1)}"]`);
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', href);
        }
        return;
      }

      if (/^https?:\/\//i.test(href)) return;

      const route = routeForHref(href);
      if (route) {
        event.preventDefault();
        navigate(route);
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [navigate]);

  return <div ref={container} className="prose-doc" dangerouslySetInnerHTML={{ __html: html }} />;
}
