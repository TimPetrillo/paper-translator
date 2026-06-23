const SENTENCE_BOUNDARY = /(?<=[.!?。！？；;])\s+/u;

function findSplitPoint(text: string, maxLength: number): number {
  const window = text.slice(0, maxLength + 1);
  const candidates = [window.lastIndexOf('\n'), window.lastIndexOf('. '), window.lastIndexOf('; ')];
  const best = Math.max(...candidates);
  if (best >= Math.floor(maxLength * 0.55)) return best + 1;
  const whitespace = window.lastIndexOf(' ');
  return whitespace >= Math.floor(maxLength * 0.55) ? whitespace : maxLength;
}

export function splitText(text: string, maxLength: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLength) return [trimmed];

  const sentences = trimmed.split(SENTENCE_BOUNDARY);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      let remainder = sentence;
      while (remainder.length > maxLength) {
        const splitAt = findSplitPoint(remainder, maxLength);
        chunks.push(remainder.slice(0, splitAt).trim());
        remainder = remainder.slice(splitAt).trim();
      }
      current = remainder;
      continue;
    }

    const combined = current ? `${current} ${sentence}` : sentence;
    if (combined.length <= maxLength) {
      current = combined;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

export function splitForTokenRetry(text: string): [string, string] {
  const midpoint = Math.floor(text.length / 2);
  const tail = text.slice(midpoint);
  const relativeBoundary = tail.search(/[.!?。！？；;]\s+/u);
  const splitAt = relativeBoundary >= 0 ? midpoint + relativeBoundary + 1 : midpoint;
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}
