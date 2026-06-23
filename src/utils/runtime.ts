import type { RuntimeMessage, RuntimeResponse } from '../types/messages';

export async function sendRuntimeMessage<T>(message: RuntimeMessage): Promise<T> {
  const raw: unknown = await chrome.runtime.sendMessage(message);
  const response = raw as RuntimeResponse<T> | undefined;
  if (!response) throw new Error('扩展后台没有响应，请重新加载扩展后重试。');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export async function sendTabMessage<T>(tabId: number, message: RuntimeMessage): Promise<T> {
  const raw: unknown = await chrome.tabs.sendMessage(tabId, message);
  const response = raw as RuntimeResponse<T> | undefined;
  if (!response) throw new Error('当前页面未加载扩展脚本，请刷新页面后重试。');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('无法访问当前标签页。');
  if (!tab.url?.startsWith('http://') && !tab.url?.startsWith('https://')) {
    throw new Error('此页面不支持翻译，请打开普通 HTTP/HTTPS 论文网页。');
  }
  return tab.id;
}
