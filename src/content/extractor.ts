const EXCLUDED_SELECTOR = [
  'script',
  'style',
  'noscript',
  'svg',
  'canvas',
  'code',
  'pre',
  'kbd',
  'samp',
  'math',
  'mjx-container',
  '.MathJax',
  '.MathJax_Display',
  '.katex',
  '.katex-display',
  '[data-mathml]',
  '[aria-hidden="true"]',
  '[hidden]',
  '[data-paper-translator]',
].join(',');

const REFERENCE_SELECTOR = [
  '#references',
  '#bibliography',
  '.references',
  '.reference-list',
  '.ref-list',
  '.bibliography',
  '[role="doc-bibliography"]',
  '[class~="references"]',
].join(',');

const METADATA_SELECTOR = [
  '.authors',
  '.author-list',
  '.author-group',
  '.affiliations',
  '.affiliation',
  '.institutions',
  '.institution',
  '[class*="Author"]',
  '[class*="author-name"]',
  '[class*="affiliation"]',
  '[rel="author"]',
  '[itemprop="author"]',
  '[itemprop="affiliation"]',
].join(',');

const COMPLETE_URL = /^(?:https?:\/\/|www\.)\S+$/i;
const COMPLETE_EMAIL = /^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/;
const COMPLETE_DOI = /^(?:doi\s*:\s*)?10\.\d{4,9}\/\S+$/i;
const FIGURE_NUMBER =
  /^(?:fig(?:ure)?|table|algorithm|scheme|chart)\s*[.:]?\s*[A-Z]?\d+[A-Za-z]?\.?$/i;
const EQUATION_NUMBER = /^(?:eq(?:uation)?\s*[.:]?\s*)?\(?\d+(?:\.\d+)*[A-Za-z]?\)?$/i;
const LATEX_FORMULA =
  /^(?:\$\$?[\s\S]*\$\$?|\\\([\s\S]*\\\)|\\\[[\s\S]*\\\]|\\begin\{[^}]+\}[\s\S]*\\end\{[^}]+\})$/;
const PERSON_NAME = /^(?:[A-Z][A-Za-z'’-]+(?:\s+|,\s*)){1,4}[A-Z][A-Za-z'’-]+\d*$/;
const INSTITUTION =
  /\b(?:university|institute|laboratory|laboratories|college|school of|department of|academy of|research center|research centre)\b/i;

const SITE_ROOTS: Array<[RegExp, readonly string[]]> = [
  [/arxiv\.org$/i, ['article.ltx_document', '.ltx_page_main', 'main']],
  [/ieee\.org$/i, ['article', '#article', '.document-main', 'main']],
  [/acm\.org$/i, ['.article__body', '#pb-page-content', 'article', 'main']],
  [/springer\.com$/i, ['article', '.c-article-body', 'main']],
  [/nature\.com$/i, ['.article__body', 'article', 'main']],
  [/sciencedirect\.com$/i, ['article', '#body', '.Body', 'main']],
];

function findContentRoot(): HTMLElement {
  const selectors = SITE_ROOTS.find(([host]) => host.test(location.hostname))?.[1] ?? [
    'article',
    'main',
    '[role="main"]',
  ];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) return element;
  }
  return document.body;
}

function isVisible(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  const style = getComputedStyle(parent);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getClientRects().length > 0;
}

function isInsideReferenceSection(parent: Element): boolean {
  if (parent.closest(REFERENCE_SELECTOR)) return true;
  const section = parent.closest('section');
  const heading = section?.querySelector(':scope > h1, :scope > h2, :scope > h3');
  return heading
    ? /^(references|bibliography|literature cited)$/i.test(heading.textContent?.trim() ?? '')
    : false;
}

function isProtectedContent(text: string, parent: Element): boolean {
  if (parent.closest(EXCLUDED_SELECTOR)) return true;
  if (parent.closest(METADATA_SELECTOR)) return true;
  if (isInsideReferenceSection(parent)) return true;
  if (COMPLETE_URL.test(text) || COMPLETE_EMAIL.test(text) || COMPLETE_DOI.test(text)) return true;
  if (FIGURE_NUMBER.test(text) || EQUATION_NUMBER.test(text) || LATEX_FORMULA.test(text))
    return true;
  if (text.length < 80 && (PERSON_NAME.test(text) || INSTITUTION.test(text))) return true;
  return false;
}

export function extractVisibleEnglishTextNodes(): Text[] {
  const root = findContentRoot();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT;
      const text = node.data.trim();
      const parent = node.parentElement;
      if (!parent || text.length < 2 || !/[A-Za-z]{2}/.test(text)) return NodeFilter.FILTER_REJECT;
      if (isProtectedContent(text, parent) || !isVisible(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) nodes.push(current);
    current = walker.nextNode();
  }
  return nodes;
}
