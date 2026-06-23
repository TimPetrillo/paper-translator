export type TranslationMode = 'quick' | 'academic' | 'refined';
export type DisplayMode = 'bilingual' | 'replace';
export type ApiProtocol =
  | 'anthropic_messages'
  | 'openai_chat'
  | 'openai_responses'
  | 'gemini_generate_content';

export interface ExtensionSettings {
  apiProtocol: ApiProtocol;
  apiKey: string;
  baseUrl: string;
  model: string;
  translationMode: TranslationMode;
  displayMode: DisplayMode;
  concurrency: number;
  timeoutMs: number;
}

export type TranslationRunOptions = Pick<
  ExtensionSettings,
  'translationMode' | 'displayMode' | 'concurrency'
>;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiProtocol: 'openai_chat',
  apiKey: '',
  baseUrl: '',
  model: '',
  translationMode: 'academic',
  displayMode: 'bilingual',
  concurrency: 3,
  timeoutMs: 45_000,
};

export const API_PROTOCOL_LABELS: Record<ApiProtocol, string> = {
  anthropic_messages: 'Anthropic Messages',
  openai_chat: 'OpenAI Chat Completions',
  openai_responses: 'OpenAI Responses API',
  gemini_generate_content: 'Gemini generateContent',
};

export const API_PROTOCOL_PATH_HINTS: Record<ApiProtocol, string> = {
  anthropic_messages: '自动追加 /messages；官方 Base URL 通常填写到 /v1',
  openai_chat: '自动追加 /chat/completions',
  openai_responses: '自动追加 /responses',
  gemini_generate_content: '自动追加 /models/{model}:generateContent',
};

export const MODE_LABELS: Record<TranslationMode, string> = {
  quick: '快速模式',
  academic: '学术模式',
  refined: '精翻模式',
};

export const DISPLAY_LABELS: Record<DisplayMode, string> = {
  bilingual: '双语显示',
  replace: '原位替换',
};
