import { useEffect, useMemo, useState } from 'react';

import { getSettings, saveSettings } from '../storage/settings';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../types/config';
import { isRuntimeMessage, type TranslationStatus } from '../types/messages';
import { toErrorMessage } from '../utils/errors';
import { getActiveTabId, sendRuntimeMessage, sendTabMessage } from '../utils/runtime';
import { SettingsForm } from './SettingsForm';

const INITIAL_STATUS: TranslationStatus = {
  phase: 'idle',
  completed: 0,
  total: 0,
  failed: 0,
  message: '准备就绪',
};

function validate(settings: ExtensionSettings): void {
  if (!settings.apiKey.trim()) throw new Error('请填写 API Key。');
  if (!settings.baseUrl.trim()) throw new Error('请填写 Base URL。');
  if (!settings.model.trim()) throw new Error('请填写 Model Name。');
}

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<TranslationStatus>(INITIAL_STATUS);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    void getSettings()
      .then(setSettings)
      .catch((reason: unknown) => setError(toErrorMessage(reason)));
    void getActiveTabId()
      .then((tabId) => sendTabMessage<TranslationStatus>(tabId, { type: 'GET_STATUS' }))
      .then(setStatus)
      .catch(() => undefined);

    const listener = (message: unknown): void => {
      if (isRuntimeMessage(message) && message.type === 'STATUS_UPDATE') {
        setStatus(message.status);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const progress = useMemo(
    () => (status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0),
    [status.completed, status.total],
  );
  const translating = status.phase === 'extracting' || status.phase === 'translating';

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (reason) {
      setError(toErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const handleSave = (): Promise<void> =>
    run(async () => {
      await saveSettings(settings);
      setNotice('配置已保存在本机浏览器中。');
    });

  const handleTest = (): Promise<void> =>
    run(async () => {
      validate(settings);
      const result = await sendRuntimeMessage<string>({ type: 'TEST_API', settings });
      setNotice(`连接成功：${result}`);
    });

  const handleTranslate = (): Promise<void> =>
    run(async () => {
      validate(settings);
      await saveSettings(settings);
      const tabId = await getActiveTabId();
      const next = await sendTabMessage<TranslationStatus>(tabId, {
        type: 'START_TRANSLATION',
        options: {
          translationMode: settings.translationMode,
          displayMode: settings.displayMode,
          concurrency: settings.concurrency,
        },
      });
      setStatus(next);
    });

  const handleStop = (): Promise<void> =>
    run(async () => {
      const tabId = await getActiveTabId();
      await sendTabMessage<TranslationStatus>(tabId, { type: 'STOP_TRANSLATION' });
      setStatus((current) => ({ ...current, phase: 'stopped', message: '翻译已停止' }));
    });

  const handleRestore = (): Promise<void> =>
    run(async () => {
      const tabId = await getActiveTabId();
      const next = await sendTabMessage<TranslationStatus>(tabId, { type: 'RESTORE_PAGE' });
      setStatus(next);
      setNotice('已恢复页面原文。');
    });

  return (
    <main className="popup-shell">
      <header className="brand">
        <div className="brand-mark" aria-hidden="true">
          译
        </div>
        <div>
          <h1>Paper Translator</h1>
          <p>专注英文学术论文的中文翻译</p>
        </div>
      </header>

      <SettingsForm settings={settings} onChange={setSettings} compact />

      <section className={`status-card status-card--${status.phase}`} aria-live="polite">
        <div className="status-row">
          <strong>{status.message}</strong>
          {status.total > 0 && <span>{progress}%</span>}
        </div>
        <div className="progress-track">
          <div className="progress-value" style={{ width: `${progress}%` }} />
        </div>
        {status.failed > 0 && <small>{status.failed} 个分块保留了原文</small>}
      </section>

      {notice && <div className="notice notice--success">{notice}</div>}
      {error && <div className="notice notice--error">{error}</div>}

      <div className="primary-actions">
        <button
          className="button button--primary"
          disabled={busy || translating}
          onClick={handleTranslate}
        >
          翻译当前页面
        </button>
        <button
          className="button button--danger"
          disabled={busy || !translating}
          onClick={handleStop}
        >
          停止翻译
        </button>
      </div>
      <div className="secondary-actions">
        <button className="button button--secondary" disabled={busy} onClick={handleSave}>
          保存配置
        </button>
        <button className="button button--secondary" disabled={busy} onClick={handleTest}>
          测试 API
        </button>
        <button className="button button--ghost" disabled={busy} onClick={handleRestore}>
          恢复原文
        </button>
      </div>

      <footer>
        <span>API Key 仅保存在本机</span>
        <button className="link-button" onClick={() => void chrome.runtime.openOptionsPage()}>
          高级设置
        </button>
      </footer>
    </main>
  );
}
