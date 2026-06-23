export type TranslationMode = 'quick' | 'academic' | 'refined';
export type DisplayMode = 'bilingual' | 'replace';

export interface ExtensionSettings {
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
  apiKey: '',
  baseUrl: '',
  model: '',
  translationMode: 'academic',
  displayMode: 'bilingual',
  concurrency: 3,
  timeoutMs: 45_000,
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
