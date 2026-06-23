import { TranslationApiClient } from '../api/translationApi';
import { getSettings, normalizeSettings } from '../storage/settings';
import type { TranslationRunOptions } from '../types/config';
import {
  isRuntimeMessage,
  type ErrorResponse,
  type RuntimeMessage,
  type RuntimeResponse,
} from '../types/messages';
import { AppError, toErrorMessage } from '../utils/errors';

const activeRequests = new Map<string, Set<AbortController>>();

function success<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

function failure(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: false, error: toErrorMessage(error) };
}

function registerController(taskId: string): AbortController {
  const controller = new AbortController();
  const group = activeRequests.get(taskId) ?? new Set<AbortController>();
  group.add(controller);
  activeRequests.set(taskId, group);
  return controller;
}

function unregisterController(taskId: string, controller: AbortController): void {
  const group = activeRequests.get(taskId);
  group?.delete(controller);
  if (group?.size === 0) activeRequests.delete(taskId);
}

function cancelTask(taskId: string): void {
  const group = activeRequests.get(taskId);
  group?.forEach((controller) => controller.abort());
  activeRequests.delete(taskId);
}

async function translateText(message: Extract<RuntimeMessage, { type: 'TRANSLATE_TEXT' }>) {
  const controller = registerController(message.taskId);
  try {
    const settings = await getSettings();
    const client = new TranslationApiClient(settings);
    return success(await client.translate(message.text, message.mode, controller.signal));
  } catch (error) {
    return failure(error);
  } finally {
    unregisterController(message.taskId, controller);
  }
}

async function testApi(message: Extract<RuntimeMessage, { type: 'TEST_API' }>) {
  const controller = new AbortController();
  try {
    const client = new TranslationApiClient(normalizeSettings(message.settings));
    return success(await client.test(controller.signal));
  } catch (error) {
    return failure(error);
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) return false;
  if (message.type === 'TRANSLATE_TEXT') {
    void translateText(message).then(sendResponse);
    return true;
  }
  if (message.type === 'CANCEL_TRANSLATION') {
    cancelTask(message.taskId);
    sendResponse(success(undefined));
    return false;
  }
  if (message.type === 'TEST_API') {
    void testApi(message).then(sendResponse);
    return true;
  }
  return false;
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'translate-current-page') return;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;
    const settings = await getSettings();
    const options: TranslationRunOptions = {
      translationMode: settings.translationMode,
      displayMode: settings.displayMode,
      concurrency: settings.concurrency,
    };
    await chrome.tabs.sendMessage(tab.id, {
      type: 'START_TRANSLATION',
      options,
    } satisfies RuntimeMessage);
  })().catch(() => undefined);
});
