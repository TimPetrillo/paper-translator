import type { ProtectedInlineSegment } from './extractor';

const TRANSLATION_ATTRIBUTE = 'data-paper-translator';

function preserveOuterWhitespace(original: string, translated: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

export class DomTranslationRenderer {
  private readonly originals = new Map<Text, string>();

  public applyReplacement(node: Text, translated: string): void {
    if (!node.isConnected || !translated.trim()) return;
    if (!this.originals.has(node)) this.originals.set(node, node.data);
    node.data = preserveOuterWhitespace(this.originals.get(node) ?? node.data, translated);
  }

  public applyBilingualBlock(
    element: HTMLElement,
    translated: string,
    protectedSegments: readonly ProtectedInlineSegment[],
  ): void {
    if (!element.isConnected || !translated.trim()) return;

    const shouldAppendInside = ['LI', 'TD', 'TH'].includes(element.tagName);
    const translation = document.createElement(shouldAppendInside ? 'span' : 'div');
    const sourceStyle = getComputedStyle(element);
    translation.setAttribute(TRANSLATION_ATTRIBUTE, 'translation');
    translation.setAttribute('lang', 'zh-CN');
    translation.className = 'paper-translator-translation paper-translator-translation--block';
    translation.style.setProperty('--paper-translator-font-size', sourceStyle.fontSize);
    translation.style.setProperty('--paper-translator-font-weight', sourceStyle.fontWeight);
    translation.append(this.renderProtectedContent(translated, protectedSegments));

    if (shouldAppendInside) {
      element.append(translation);
    } else {
      element.insertAdjacentElement('afterend', translation);
    }
  }

  private renderProtectedContent(
    translated: string,
    protectedSegments: readonly ProtectedInlineSegment[],
  ): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const segmentMap = new Map(
      protectedSegments.map((segment) => [segment.token, segment.element]),
    );
    for (const part of translated.split(/(⟦PT_\d+⟧)/gu)) {
      const sourceElement = segmentMap.get(part);
      if (!sourceElement) {
        fragment.append(document.createTextNode(part));
        continue;
      }
      const clone = sourceElement.cloneNode(true);
      if (clone instanceof Element) {
        clone.removeAttribute('id');
        clone.querySelectorAll('[id]').forEach((descendant) => descendant.removeAttribute('id'));
      }
      fragment.append(clone);
    }
    return fragment;
  }

  public restore(): void {
    document.querySelectorAll(`[${TRANSLATION_ATTRIBUTE}]`).forEach((element) => element.remove());
    for (const [node, original] of this.originals) {
      if (node.isConnected) node.data = original;
    }
    this.originals.clear();
  }
}
