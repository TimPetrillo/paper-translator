import { useEffect, useMemo, useState } from 'react';

import { getSettings } from '../storage/settings';
import {
  API_PROTOCOL_LABELS,
  DEFAULT_SETTINGS,
  DISPLAY_LABELS,
  MODE_LABELS,
  type ExtensionSettings,
} from '../types/config';
import { isRuntimeMessage, type TranslationStatus } from '../types/messages';
import { toErrorMessage } from '../utils/errors';
import { getActiveTabId, sendTabMessage } from '../utils/runtime';

const INITIAL_STATUS: TranslationStatus = {
  phase: 'idle',
  completed: 0,
  total: 0,
  failed: 0,
  message: '准备就绪',
};

function validate(settings: ExtensionSettings): void {
  if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.model.trim()) {
    throw new Error('请先打开网页版设置并完成 API 配置。');
  }
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
  const configured = Boolean(settings.apiKey && settings.baseUrl && settings.model);

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

  const handleTranslate = (): Promise<void> =>
    run(async () => {
      validate(settings);
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
          <p>论文翻译控制面板</p>
        </div>
      </header>

      <section className="config-card">
        <div className="config-card__header">
          <span>API 配置</span>
          <span
            className={`config-badge ${configured ? 'config-badge--ok' : 'config-badge--warn'}`}
          >
            {configured ? '已配置' : '未配置'}
          </span>
        </div>
        {configured ? (
          <>
            <strong className="model-name">{settings.model}</strong>
            <p>
              {API_PROTOCOL_LABELS[settings.apiProtocol]}
              <br />
              {MODE_LABELS[settings.translationMode]} · {DISPLAY_LABELS[settings.displayMode]} ·
              并发 {settings.concurrency}
            </p>
          </>
        ) : (
          <p>请先在网页版设置中填写 API Key、地址和模型。</p>
        )}
        <button className="settings-link" onClick={() => void chrome.runtime.openOptionsPage()}>
          打开配置
        </button>
      </section>

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
          disabled={busy || translating || !configured}
          onClick={handleTranslate}
        >
          翻译当前页面
        </button>
        <button
          className="button button--danger"
          disabled={busy || !translating}
          onClick={handleStop}
        >
          停止
        </button>
      </div>
      <button
        className="button button--ghost restore-button"
        disabled={busy}
        onClick={handleRestore}
      >
        恢复页面原文
      </button>

      <footer>API Key 仅保存在本机浏览器</footer>
    </main>
  );
}
