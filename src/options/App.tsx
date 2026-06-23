import { useEffect, useState } from 'react';

import { clearSettings, getSettings, saveSettings } from '../storage/settings';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../types/config';
import { toErrorMessage } from '../utils/errors';
import { sendRuntimeMessage } from '../utils/runtime';
import { SettingsForm } from '../popup/SettingsForm';

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    void getSettings()
      .then(setSettings)
      .catch((reason: unknown) => setError(toErrorMessage(reason)));
  }, []);

  const perform = async (work: () => Promise<string>): Promise<void> => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      setMessage(await work());
    } catch (reason) {
      setError(toErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="options-shell">
      <header className="options-header">
        <div className="options-logo">译</div>
        <div>
          <h1>Paper Translator 设置</h1>
          <p>连接任意 OpenAI Compatible Chat Completions API</p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>API 与翻译参数</h2>
            <p>Base URL 示例：服务商文档给出的兼容接口版本路径。</p>
          </div>
        </div>
        <SettingsForm settings={settings} onChange={setSettings} />
        <div className="options-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              perform(async () => {
                await saveSettings(settings);
                return '设置已保存。';
              })
            }
          >
            保存设置
          </button>
          <button
            disabled={busy}
            onClick={() =>
              perform(
                async () =>
                  `API 连接成功：${await sendRuntimeMessage<string>({ type: 'TEST_API', settings })}`,
              )
            }
          >
            测试 API
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() =>
              perform(async () => {
                await clearSettings();
                setSettings(DEFAULT_SETTINGS);
                return '本地配置已清除。';
              })
            }
          >
            清除配置
          </button>
        </div>
        {message && <div className="feedback success">{message}</div>}
        {error && <div className="feedback error">{error}</div>}
      </section>

      <section className="panel privacy-panel">
        <h2>隐私与权限</h2>
        <ul>
          <li>
            API Key 仅写入 <code>chrome.storage.local</code>，不会同步到项目服务器。
          </li>
          <li>只有开始翻译或测试连接时，论文分块才会发送至你配置的 API。</li>
          <li>扩展不包含遥测、广告、账户系统或数据收集代码。</li>
          <li>通配主机权限用于访问当前论文页面和用户自定义 API 地址。</li>
        </ul>
      </section>

      <section className="panel tips-panel">
        <h2>兼容性提示</h2>
        <p>
          兼容端点需接受 <code>POST /chat/completions</code>、Bearer API Key、
          <code>model</code> 与 <code>messages</code> 字段，并返回{' '}
          <code>choices[0].message.content</code>。
        </p>
      </section>
    </main>
  );
}
