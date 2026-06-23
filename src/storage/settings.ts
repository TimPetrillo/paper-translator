import { DEFAULT_SETTINGS, type ExtensionSettings } from '../types/config';

const STORAGE_KEY = 'paperTranslatorSettings';

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeSettings(value: Partial<ExtensionSettings>): ExtensionSettings {
  return {
    apiKey: value.apiKey?.trim() ?? DEFAULT_SETTINGS.apiKey,
    baseUrl: value.baseUrl?.trim().replace(/\/+$/, '') ?? DEFAULT_SETTINGS.baseUrl,
    model: value.model?.trim() ?? DEFAULT_SETTINGS.model,
    translationMode: value.translationMode ?? DEFAULT_SETTINGS.translationMode,
    displayMode: value.displayMode ?? DEFAULT_SETTINGS.displayMode,
    concurrency: clampInteger(value.concurrency ?? DEFAULT_SETTINGS.concurrency, 1, 8),
    timeoutMs: clampInteger(value.timeoutMs ?? DEFAULT_SETTINGS.timeoutMs, 5_000, 180_000),
  };
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored: unknown = result[STORAGE_KEY];
  if (typeof stored !== 'object' || stored === null) return DEFAULT_SETTINGS;
  return normalizeSettings(stored);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: normalizeSettings(settings) });
}

export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
