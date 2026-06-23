import type { DisplayMode } from '../types/config';

const TRANSLATION_ATTRIBUTE = 'data-paper-translator';

function preserveOuterWhitespace(original: string, translated: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function shouldDisplayAsBlock(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  const significantChildren = Array.from(parent.childNodes).filter(
    (child) => child.nodeType !== Node.TEXT_NODE || Boolean(child.textContent?.trim()),
  );
  if (significantChildren.length !== 1) return false;
  const display = getComputedStyle(parent).display;
  return ['block', 'list-item', 'table-cell', 'flex', 'grid'].includes(display);
}

export class DomTranslationRenderer {
  private readonly originals = new Map<Text, string>();

  public apply(node: Text, translated: string, mode: DisplayMode): void {
    if (!node.isConnected || !translated.trim()) return;
    if (!this.originals.has(node)) this.originals.set(node, node.data);

    if (mode === 'replace') {
      node.data = preserveOuterWhitespace(this.originals.get(node) ?? node.data, translated);
      return;
    }

    const span = document.createElement('span');
    span.setAttribute(TRANSLATION_ATTRIBUTE, 'translation');
    span.setAttribute('lang', 'zh-CN');
    span.className = shouldDisplayAsBlock(node)
      ? 'paper-translator-translation paper-translator-translation--block'
      : 'paper-translator-translation paper-translator-translation--inline';
    span.textContent = translated;
    node.parentNode?.insertBefore(span, node.nextSibling);
  }

  public restore(): void {
    document.querySelectorAll(`[${TRANSLATION_ATTRIBUTE}]`).forEach((element) => element.remove());
    for (const [node, original] of this.originals) {
      if (node.isConnected) node.data = original;
    }
    this.originals.clear();
  }
}
