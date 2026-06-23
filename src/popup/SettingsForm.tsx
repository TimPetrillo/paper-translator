import type { ChangeEvent } from 'react';

import {
  DISPLAY_LABELS,
  MODE_LABELS,
  type DisplayMode,
  type ExtensionSettings,
  type TranslationMode,
} from '../types/config';

interface SettingsFormProps {
  settings: ExtensionSettings;
  onChange: (settings: ExtensionSettings) => void;
  compact?: boolean;
}

export function SettingsForm({ settings, onChange, compact = false }: SettingsFormProps) {
  const update = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]): void => {
    onChange({ ...settings, [key]: value });
  };

  const onNumber =
    (key: 'concurrency' | 'timeoutMs', multiplier = 1) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      update(key, Number(event.target.value) * multiplier);
    };

  return (
    <div className={`settings-grid${compact ? ' settings-grid--compact' : ''}`}>
      <label className="field field--wide">
        <span>API Key</span>
        <input
          type="password"
          value={settings.apiKey}
          onChange={(event) => update('apiKey', event.target.value)}
          placeholder="sk-…"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label className="field field--wide">
        <span>Base URL</span>
        <input
          type="url"
          value={settings.baseUrl}
          onChange={(event) => update('baseUrl', event.target.value)}
          placeholder="https://api.example.com/v1"
          spellCheck={false}
        />
        {!compact && <small>填写到版本路径，插件会自动追加 /chat/completions</small>}
      </label>

      <label className="field field--wide">
        <span>Model Name</span>
        <input
          value={settings.model}
          onChange={(event) => update('model', event.target.value)}
          placeholder="填写服务商提供的模型 ID"
          spellCheck={false}
        />
      </label>

      <label className="field">
        <span>翻译模式</span>
        <select
          value={settings.translationMode}
          onChange={(event) => update('translationMode', event.target.value as TranslationMode)}
        >
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>显示方式</span>
        <select
          value={settings.displayMode}
          onChange={(event) => update('displayMode', event.target.value as DisplayMode)}
        >
          {Object.entries(DISPLAY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>并发数量</span>
        <input
          type="number"
          min="1"
          max="8"
          value={settings.concurrency}
          onChange={onNumber('concurrency')}
        />
      </label>

      <label className="field">
        <span>超时时间（秒）</span>
        <input
          type="number"
          min="5"
          max="180"
          value={settings.timeoutMs / 1_000}
          onChange={onNumber('timeoutMs', 1_000)}
        />
      </label>
    </div>
  );
}
