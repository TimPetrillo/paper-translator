import { getChunkLimit } from '../translator/prompts';
import { splitText } from '../translator/chunker';
import { runConcurrentQueue } from '../translator/queue';
import type { TranslationRunOptions } from '../types/config';
import type { RuntimeMessage, TranslationStatus } from '../types/messages';
import { isAbortError, toErrorMessage } from '../utils/errors';
import { sendRuntimeMessage } from '../utils/runtime';
import { DomTranslationRenderer } from './domRenderer';
import { extractVisibleEnglishTextNodes } from './extractor';

interface TranslationRecord {
  node: Text;
  chunks: string[];
  translated: string[];
  remaining: number;
  successCount: number;
}

const IDLE_STATUS: TranslationStatus = {
  phase: 'idle',
  completed: 0,
  total: 0,
  failed: 0,
  message: '准备就绪',
};

export class TranslationCoordinator {
  private readonly renderer = new DomTranslationRenderer();
  private controller: AbortController | undefined;
  private taskId: string | undefined;
  private status: TranslationStatus = IDLE_STATUS;

  public getStatus(): TranslationStatus {
    return { ...this.status };
  }

  public async start(options: TranslationRunOptions): Promise<void> {
    this.stop();
    this.renderer.restore();
    const controller = new AbortController();
    const taskId = crypto.randomUUID();
    this.controller = controller;
    this.taskId = taskId;
    const { signal } = controller;

    try {
      this.updateStatus({
        phase: 'extracting',
        completed: 0,
        total: 0,
        failed: 0,
        message: '正在识别论文正文…',
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (signal.aborted) throw new DOMException('翻译已停止', 'AbortError');
      const nodes = extractVisibleEnglishTextNodes();
      if (nodes.length === 0) throw new Error('未找到可翻译的英文论文正文。');

      const maxLength = getChunkLimit(options.translationMode);
      const records: TranslationRecord[] = nodes
        .map((node) => {
          const chunks = splitText(node.data, maxLength);
          return {
            node,
            chunks,
            translated: Array.from({ length: chunks.length }, () => ''),
            remaining: chunks.length,
            successCount: 0,
          };
        })
        .filter((record) => record.chunks.length > 0);
      const tasks = records.flatMap((record, recordIndex) =>
        record.chunks.map((text, chunkIndex) => ({ recordIndex, chunkIndex, text })),
      );
      let failed = 0;
      this.updateStatus({
        phase: 'translating',
        completed: 0,
        total: tasks.length,
        failed,
        message: `正在翻译 0 / ${tasks.length}`,
      });

      await runConcurrentQueue({
        items: tasks,
        concurrency: options.concurrency,
        signal,
        worker: async (task) => {
          try {
            const translated = await sendRuntimeMessage<string>({
              type: 'TRANSLATE_TEXT',
              taskId,
              text: task.text,
              mode: options.translationMode,
            });
            if (signal.aborted) throw new DOMException('翻译已停止', 'AbortError');
            return { translated, succeeded: true };
          } catch (error) {
            if (signal.aborted || isAbortError(error)) throw error;
            failed += 1;
            return { translated: task.text, succeeded: false };
          }
        },
        onResult: (result, task) => {
          if (this.controller !== controller) return;
          const record = records[task.recordIndex];
          if (!record) return;
          record.translated[task.chunkIndex] = result.translated;
          record.remaining -= 1;
          if (result.succeeded) record.successCount += 1;
          if (record.remaining === 0 && record.successCount > 0) {
            this.renderer.apply(record.node, record.translated.join(' '), options.displayMode);
          }
        },
        onProgress: (completed, total) => {
          if (this.controller !== controller) return;
          this.updateStatus({
            phase: 'translating',
            completed,
            total,
            failed,
            message: `正在翻译 ${completed} / ${total}`,
          });
        },
      });

      this.updateStatus({
        phase: failed === tasks.length ? 'error' : 'completed',
        completed: tasks.length,
        total: tasks.length,
        failed,
        message:
          failed > 0
            ? `翻译完成，${failed} 个分块失败并保留原文`
            : `翻译完成，共处理 ${tasks.length} 个分块`,
      });
    } catch (error) {
      if (this.controller !== controller) return;
      if (signal.aborted || isAbortError(error)) {
        this.updateStatus({ ...this.status, phase: 'stopped', message: '翻译已停止' });
      } else {
        this.updateStatus({ ...this.status, phase: 'error', message: toErrorMessage(error) });
      }
    } finally {
      if (this.controller === controller) {
        this.controller = undefined;
        this.taskId = undefined;
      }
    }
  }

  public stop(): void {
    this.controller?.abort();
    if (this.taskId) {
      void sendRuntimeMessage<void>({ type: 'CANCEL_TRANSLATION', taskId: this.taskId }).catch(
        () => undefined,
      );
    }
  }

  public restore(): void {
    this.stop();
    this.renderer.restore();
    this.updateStatus(IDLE_STATUS);
  }

  private updateStatus(status: TranslationStatus): void {
    this.status = { ...status };
    const message: RuntimeMessage = { type: 'STATUS_UPDATE', status: this.getStatus() };
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  }
}
