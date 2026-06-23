import { getSettings } from '../storage/settings';
import { isRuntimeMessage, type RuntimeMessage } from '../types/messages';
import { toErrorMessage } from '../utils/errors';
import { TranslationCoordinator } from './coordinator';

const coordinator = new TranslationCoordinator();

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) return false;

  if (message.type === 'START_TRANSLATION') {
    void coordinator.start(message.options);
    sendResponse({ ok: true, data: coordinator.getStatus() });
    return false;
  }
  if (message.type === 'COMMAND_TRANSLATE') {
    void getSettings()
      .then((settings) =>
        coordinator.start({
          translationMode: settings.translationMode,
          displayMode: settings.displayMode,
          concurrency: settings.concurrency,
        }),
      )
      .catch(() => undefined);
    sendResponse({ ok: true, data: coordinator.getStatus() });
    return false;
  }
  if (message.type === 'STOP_TRANSLATION') {
    coordinator.stop();
    sendResponse({ ok: true, data: coordinator.getStatus() });
    return false;
  }
  if (message.type === 'RESTORE_PAGE') {
    coordinator.restore();
    sendResponse({ ok: true, data: coordinator.getStatus() });
    return false;
  }
  if (message.type === 'GET_STATUS') {
    sendResponse({ ok: true, data: coordinator.getStatus() });
    return false;
  }
  return false;
});

window.addEventListener('pagehide', () => coordinator.stop(), { once: true });

window.addEventListener('error', (event) => {
  const diagnostic: RuntimeMessage = {
    type: 'STATUS_UPDATE',
    status: {
      ...coordinator.getStatus(),
      phase: 'error',
      message: toErrorMessage(event.error),
    },
  };
  void chrome.runtime.sendMessage(diagnostic).catch(() => undefined);
});
