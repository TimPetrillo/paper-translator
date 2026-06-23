import { buildTranslationPrompt } from '../translator/prompts';
import { splitForTokenRetry } from '../translator/chunker';
import type { ApiErrorPayload, ChatCompletionRequest, ChatCompletionResponse } from '../types/api';
import type { ExtensionSettings, TranslationMode } from '../types/config';
import { AppError, isAbortError, toErrorMessage } from '../utils/errors';

const MAX_RETRIES = 3;
const TOKEN_ERROR_PATTERN = /context|token|maximum|max_tokens|too long|length/i;

function buildEndpoint(baseUrl: string): string {
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
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/chat/completions') ? path : `${path}/chat/completions`;
  return url.toString();
}

function isChatCompletionResponse(value: unknown): value is ChatCompletionResponse {
  if (typeof value !== 'object' || value === null || !('choices' in value)) return false;
  const choices = value.choices;
  if (!Array.isArray(choices)) return false;
  const first: unknown = choices[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'message' in first &&
    typeof first.message === 'object' &&
    first.message !== null &&
    'content' in first.message &&
    (typeof first.message.content === 'string' || first.message.content === null)
  );
}

function getApiErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback;
  const payload = value as ApiErrorPayload;
  return payload.error?.message ?? payload.message ?? fallback;
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

export class OpenAICompatibleClient {
  private readonly endpoint: string;

  public constructor(private readonly settings: ExtensionSettings) {
    this.endpoint = buildEndpoint(settings.baseUrl);
    if (!settings.apiKey) throw new AppError('请先填写 API Key。', 'INVALID_CONFIG');
    if (!settings.model) throw new AppError('请先填写 Model Name。', 'INVALID_CONFIG');
  }

  public async translate(
    text: string,
    mode: TranslationMode,
    signal: AbortSignal,
    splitDepth = 0,
  ): Promise<string> {
    const body: ChatCompletionRequest = {
      model: this.settings.model,
      messages: [
        {
          role: 'system',
          content: '你只负责忠实翻译用户提供的学术内容，并严格遵守格式保留要求。',
        },
        { role: 'user', content: buildTranslationPrompt(mode, text) },
      ],
    };

    try {
      return await this.request(body, signal);
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
    const body: ChatCompletionRequest = {
      model: this.settings.model,
      messages: [
        { role: 'system', content: 'You are a concise translation API health check.' },
        {
          role: 'user',
          content:
            'Translate “academic paper” into Simplified Chinese. Output only the translation.',
        },
      ],
    };
    return this.request(body, signal);
  }

  private async request(body: ChatCompletionRequest, parentSignal: AbortSignal): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (parentSignal.aborted) throw new DOMException('请求已取消', 'AbortError');
      const timeout = createTimeoutSignal(parentSignal, this.settings.timeoutMs);
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.settings.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
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
        if (!isChatCompletionResponse(payload)) {
          throw new AppError('API 返回格式不符合 Chat Completions 规范。', 'INVALID_RESPONSE');
        }
        const content = payload.choices[0]?.message.content?.trim();
        if (!content) throw new AppError('API 返回了空译文。', 'EMPTY_RESPONSE');
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
