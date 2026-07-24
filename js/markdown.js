// A small, dependency-free Markdown renderer for note bodies.
//
// WHY HAND-ROLLED: the extension has no build step and a strict CSP — no npm, no CDN.
//
// SECURITY: this renders text the user may have PASTED from anywhere or IMPORTED from a
// file or a Drive backup, so it is treated as untrusted. The order is non-negotiable:
//
//   1. escape ALL of & < > " ' first, so no source character can ever become markup;
//   2. only then apply markdown rules, which emit only tags we construct ourselves;
//   3. link URLs pass a scheme allowlist (http, https, mailto, #fragment) — so
//      javascript:, data:, vbscript: and friends can never reach an href.
//
// Because escaping happens before any tag is emitted, a literal <script> in the source is
// already &lt;script&gt; by the time the rules run — there is no ordering in which raw user
// text becomes an element. The one deliberate exception is <u>/</u> (markdown has no
// underline): it is un-escaped by an exact-match rule that cannot carry attributes, so no
// event handler can ride along.
//
// Emitted HTML is parked in placeholder slots so that later rules can't chew through a tag
// we already built (e.g. an asterisk inside an href turning into an <em>).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// NUL is stripped here so it can serve as an unforgeable slot delimiter below.
export const escapeHtml = (s) => String(s ?? '').replace(/\u0000/g, '').replace(/[&<>"']/g, (c) => ESC[c]);

const SAFE_SCHEME = /^(?:https?:\/\/|mailto:|#)/i;
function safeUrl(raw) {
  // undo the entity for & so the href round-trips, then drop control characters and
  // whitespace, which are the classic way to smuggle "java\tscript:" past a scheme test
  const url = String(raw).trim().replace(/&amp;/g, '&');
  const flat = url.replace(/[\u0000-\u0020\u007f-\u00a0]/g, '');
  return SAFE_SCHEME.test(flat) ? escapeHtml(url) : null;
}

const LINK_ATTRS = 'target="_blank" rel="noopener noreferrer nofollow"';

/* ————————————————————————— inline ————————————————————————— */

// Emphasis only. Runs on already-escaped text with tags parked in slots.
function emphasis(s) {
  return s
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>')
    // exactly <u> and </u> back through — the pattern admits no attributes
    .replace(/&lt;u&gt;/g, '<u>')
    .replace(/&lt;\/u&gt;/g, '</u>');
}

// `src` must already be escaped.
function inline(src) {
  const slots = [];
  const park = (html) => `\u0000${slots.push(html) - 1}\u0000`;
  let s = String(src);

  // code spans first, so markdown inside `backticks` stays literal
  s = s.replace(/`([^`\n]+)`/g, (_, code) => park(`<code>${code}</code>`));

  // [label](url) — the only place a URL becomes an href, always via safeUrl
  s = s.replace(/\[([^\]\n]*)\]\(([^)\s]+)\)/g, (whole, label, url) => {
    const href = safeUrl(url);
    if (!href) return label || whole;          // unsafe scheme → inert text, link dropped
    return park(`<a href="${href}" ${LINK_ATTRS}>${emphasis(label) || href}</a>`);
  });

  // bare http(s) autolink
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) =>
    `${pre}${park(`<a href="${escapeHtml(url)}" ${LINK_ATTRS}>${url}</a>`)}`);

  s = emphasis(s);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)] ?? '');
}

// Inline-only render, for single-line fields (checklist rows, reminder lines) where a
// paragraph/list/heading would make no sense. Same escape-first guarantees.
export function renderInline(src) {
  return inline(escapeHtml(src));
}

// Does this one line use inline markdown? Lines without any are left as a plain editable
// input — no preview swap at all, which keeps the common case simple and directly typable.
export function hasInlineMarkdown(src) {
  const s = String(src ?? '');
  return /\*\*[^*\n]+\*\*|~~[^~\n]+~~|__[^_\n]+__|`[^`\n]+`|<u>[^<]*<\/u>|\[[^\]\n]*\]\([^)\s]+\)/.test(s)
    || /(?:^|[^*\w])\*[^*\n]+\*/.test(s);
}

/* ————————————————————————— blocks ————————————————————————— */

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const QUOTE = /^\s*&gt;\s?(.*)$/;   // ">" is already escaped by this point
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;

// Render markdown to an HTML string. Input is untrusted; the result is safe to assign to
// innerHTML (see the module header for why).
export function renderMarkdown(src) {
  const lines = escapeHtml(src).split('\n');
  const out = [];
  let list = null;    // 'ul' | 'ol' | null
  let quote = false;
  let fence = null;   // lines accumulating inside a ``` fence

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeQuote = () => { if (quote) { out.push('</blockquote>'); quote = false; } };
  const openList = (kind) => { if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; } };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {                       // fenced code — contents stay literal
      if (fence === null) { closeList(); closeQuote(); fence = []; }
      else { out.push(`<pre><code>${fence.join('\n')}</code></pre>`); fence = null; }
      continue;
    }
    if (fence !== null) { fence.push(line); continue; }

    if (!line.trim()) { closeList(); closeQuote(); continue; }
    if (RULE.test(line)) { closeList(); closeQuote(); out.push('<hr>'); continue; }

    const h = line.match(HEADING);
    if (h) { closeList(); closeQuote(); const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }

    const q = line.match(QUOTE);
    if (q) {
      closeList();
      if (!quote) { out.push('<blockquote>'); quote = true; }
      out.push(`<p>${inline(q[1])}</p>`);
      continue;
    }
    closeQuote();

    // "- [ ] thing" renders as a read-only tick — the real, clickable checklist lives on
    // todo cards; this only makes pasted markdown look right.
    const t = line.match(TASK);
    if (t) {
      openList('ul');
      const done = t[1] !== ' ';
      out.push(`<li class="md-task${done ? ' is-done' : ''}"><span class="md-box">${done ? '✓' : ''}</span><span>${inline(t[2])}</span></li>`);
      continue;
    }

    const b = line.match(BULLET);
    if (b) { openList('ul'); out.push(`<li>${inline(b[1])}</li>`); continue; }

    const o = line.match(ORDERED);
    if (o) { openList('ol'); out.push(`<li>${inline(o[1])}</li>`); continue; }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  if (fence !== null) out.push(`<pre><code>${fence.join('\n')}</code></pre>`);  // unclosed fence
  closeList(); closeQuote();
  return out.join('');
}

// True when the text uses markdown we'd render differently from plain text — lets a card
// skip the preview swap for notes that are just prose.
export function hasMarkdown(src) {
  const s = String(src ?? '');
  return /(?:^|\n)[ \t]*(?:#{1,6}[ \t]|[-*+][ \t]|\d+[.)][ \t]|>[ \t]?|```)/.test(s)
    || /\*\*[^*\n]+\*\*|~~[^~\n]+~~|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]*\]\([^)\s]+\)|<u>/.test(s)
    || /(?:^|[^*\w])\*[^*\n]+\*/.test(s);
}
