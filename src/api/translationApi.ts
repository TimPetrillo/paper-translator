import { splitForTokenRetry } from '../translator/chunker';
import { buildTranslationPrompt } from '../translator/prompts';
import {
  API_PROTOCOL_LABELS,
  type ApiProtocol,
  type ExtensionSettings,
  type TranslationMode,
} from '../types/config';
import { AppError, isAbortError, toErrorMessage } from '../utils/errors';

const MAX_RETRIES = 3;
const MAX_OUTPUT_TOKENS = 4_096;
const TOKEN_ERROR_PATTERN = /context|token|maximum|max_tokens|too long|length/i;
const SYSTEM_INSTRUCTION = '你只负责忠实翻译用户提供的学术内容，并严格遵守格式保留要求。';

interface RequestSpec {
  endpoint: string;
  headers: Record<string, string>;
  body: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBaseUrl(baseUrl: string): URL {
  if (!baseUrl) throw new AppError('请先填写 Base URL。', 'INVALID_CONFIG');
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new AppError('Base URL 格式无效。', 'INVALID_CONFIG');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError('Base URL 必须使用 HTTP 或 HTTPS。', 'INVALID_CONFIG');
  }
  return url;
}

function appendPath(url: URL, suffix: string): URL {
  const path = url.pathname.replace(/\/+$/, '');
  if (!path.endsWith(suffix)) url.pathname = `${path}${suffix}`;
  return url;
}

function buildEndpoint(settings: ExtensionSettings): string {
  const url = parseBaseUrl(settings.baseUrl);
  const path = url.pathname.replace(/\/+$/, '');

  switch (settings.apiProtocol) {
    case 'anthropic_messages':
      return appendPath(url, '/messages').toString();
    case 'openai_chat':
      return appendPath(url, '/chat/completions').toString();
    case 'openai_responses':
      return appendPath(url, '/responses').toString();
    case 'gemini_generate_content': {
      if (path.endsWith(':generateContent')) return url.toString();
      if (/\/models\/[^/]+$/u.test(path)) {
        url.pathname = `${path}:generateContent`;
        return url.toString();
      }
      const model = settings.model.replace(/^models\//u, '');
      url.pathname = `${path}/models/${encodeURIComponent(model)}:generateContent`;
      return url.toString();
    }
  }
}

function buildRequest(settings: ExtensionSettings, prompt: string): RequestSpec {
  const endpoint = buildEndpoint(settings);
  const commonHeaders = { 'Content-Type': 'application/json' };

  switch (settings.apiProtocol) {
    case 'anthropic_messages':
      return {
        endpoint,
        headers: {
          ...commonHeaders,
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: {
          model: settings.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_INSTRUCTION,
          messages: [{ role: 'user', content: prompt }],
        },
      };
    case 'openai_chat':
      return {
        endpoint,
        headers: { ...commonHeaders, Authorization: `Bearer ${settings.apiKey}` },
        body: {
          model: settings.model,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: prompt },
          ],
        },
      };
    case 'openai_responses':
      return {
        endpoint,
        headers: { ...commonHeaders, Authorization: `Bearer ${settings.apiKey}` },
        body: {
          model: settings.model,
          instructions: SYSTEM_INSTRUCTION,
          input: prompt,
        },
      };
    case 'gemini_generate_content':
      return {
        endpoint,
        headers: { ...commonHeaders, 'x-goog-api-key': settings.apiKey },
        body: {
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        },
      };
  }
}

function collectTextParts(parts: unknown): string | undefined {
  if (!Array.isArray(parts)) return undefined;
  const texts = parts
    .map((part: unknown) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean);
  return texts.length > 0 ? texts.join('') : undefined;
}

function extractOpenAIChatText(payload: unknown): string | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return undefined;
  const choice: unknown = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return undefined;
  const content = choice.message.content;
  return typeof content === 'string' ? content : collectTextParts(content);
}

function extractOpenAIResponsesText(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.output_text === 'string') return payload.output_text;
  if (!Array.isArray(payload.output)) return undefined;
  const texts = payload.output.flatMap((item: unknown) => {
    if (!isRecord(item)) return [];
    const text = collectTextParts(item.content);
    return text ? [text] : [];
  });
  return texts.length > 0 ? texts.join('') : undefined;
}

function extractAnthropicText(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  return collectTextParts(payload.content);
}

function extractGeminiText(payload: unknown): string | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return undefined;
  const candidate: unknown = payload.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content)) return undefined;
  return collectTextParts(candidate.content.parts);
}

function extractResponseText(protocol: ApiProtocol, payload: unknown): string | undefined {
  switch (protocol) {
    case 'anthropic_messages':
      return extractAnthropicText(payload);
    case 'openai_chat':
      return extractOpenAIChatText(payload);
    case 'openai_responses':
      return extractOpenAIResponsesText(payload);
    case 'gemini_generate_content':
      return extractGeminiText(payload);
  }
}

function getApiErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  if (isRecord(value.error) && typeof value.error.message === 'string') {
    return value.error.message;
  }
  return typeof value.message === 'string' ? value.message : fallback;
}

function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1_000) : undefined;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('请求已取消', 'AbortError'));
      },
      { once: true },
    );
  });
}

function createTimeoutSignal(
  parent: AbortSignal,
  timeoutMs: number,
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('请求超时', 'TimeoutError')),
    timeoutMs,
  );
  const abortFromParent = (): void => controller.abort(parent.reason);
  parent.addEventListener('abort', abortFromParent, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parent.removeEventListener('abort', abortFromParent);
    },
  };
}

export class TranslationApiClient {
  public constructor(private readonly settings: ExtensionSettings) {
    if (!settings.apiKey) throw new AppError('请先填写 API Key。', 'INVALID_CONFIG');
    if (!settings.model) throw new AppError('请先填写 Model Name。', 'INVALID_CONFIG');
    buildEndpoint(settings);
  }

  public async translate(
    text: string,
    mode: TranslationMode,
    signal: AbortSignal,
    splitDepth = 0,
  ): Promise<string> {
    try {
      return await this.request(buildTranslationPrompt(mode, text), signal);
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === 'TOKEN_LIMIT' &&
        text.length >= 300 &&
        splitDepth < 3
      ) {
        const [left, right] = splitForTokenRetry(text);
        if (!left || !right) throw error;
        const first = await this.translate(left, mode, signal, splitDepth + 1);
        const second = await this.translate(right, mode, signal, splitDepth + 1);
        return `${first} ${second}`;
      }
      throw error;
    }
  }

  public async test(signal: AbortSignal): Promise<string> {
    return this.request(
      'Translate “academic paper” into Simplified Chinese. Output only the translation.',
      signal,
    );
  }

  private async request(prompt: string, parentSignal: AbortSignal): Promise<string> {
    const spec = buildRequest(this.settings, prompt);
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (parentSignal.aborted) throw new DOMException('请求已取消', 'AbortError');
      const timeout = createTimeoutSignal(parentSignal, this.settings.timeoutMs);
      try {
        const response = await fetch(spec.endpoint, {
          method: 'POST',
          headers: spec.headers,
          body: JSON.stringify(spec.body),
          signal: timeout.signal,
        });
        const payload: unknown = await response.json().catch(() => undefined);
        if (!response.ok) {
          const message = getApiErrorMessage(payload, `API 请求失败（HTTP ${response.status}）`);
          if (response.status === 400 && TOKEN_ERROR_PATTERN.test(message)) {
            throw new AppError(message, 'TOKEN_LIMIT', response.status);
          }
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < MAX_RETRIES) {
            const retryAfter = parseRetryAfter(response);
            const backoff = retryAfter ?? 1_000 * 2 ** attempt + Math.random() * 350;
            await delay(backoff, parentSignal);
            continue;
          }
          throw new AppError(
            message,
            response.status === 429 ? 'RATE_LIMIT' : 'API_ERROR',
            response.status,
          );
        }

        const content = extractResponseText(this.settings.apiProtocol, payload)?.trim();
        if (!content) {
          throw new AppError(
            `API 返回格式不符合 ${API_PROTOCOL_LABELS[this.settings.apiProtocol]} 规范，或返回了空内容。`,
            'INVALID_RESPONSE',
          );
        }
        return content;
      } catch (error) {
        if (isAbortError(error) || parentSignal.aborted) throw error;
        if (error instanceof AppError) throw error;
        lastError = error;
        if (attempt < MAX_RETRIES) {
          await delay(1_000 * 2 ** attempt + Math.random() * 350, parentSignal);
          continue;
        }
      } finally {
        timeout.cleanup();
      }
    }
    throw new AppError(`网络请求失败：${toErrorMessage(lastError)}`, 'NETWORK_ERROR');
  }
}
