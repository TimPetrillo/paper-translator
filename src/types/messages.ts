import type { ExtensionSettings, TranslationMode, TranslationRunOptions } from './config';

export type TranslationPhase =
  | 'idle'
  | 'extracting'
  | 'translating'
  | 'completed'
  | 'stopped'
  | 'error';

export interface TranslationStatus {
  phase: TranslationPhase;
  completed: number;
  total: number;
  failed: number;
  message: string;
}

export type RuntimeMessage =
  | { type: 'START_TRANSLATION'; options: TranslationRunOptions }
  | { type: 'STOP_TRANSLATION' }
  | { type: 'RESTORE_PAGE' }
  | { type: 'GET_STATUS' }
  | { type: 'TRANSLATE_TEXT'; taskId: string; text: string; mode: TranslationMode }
  | { type: 'CANCEL_TRANSLATION'; taskId: string }
  | { type: 'STATUS_UPDATE'; status: TranslationStatus }
  | { type: 'TEST_API'; settings: ExtensionSettings }
  | { type: 'COMMAND_TRANSLATE' };

export interface SuccessResponse<T> {
  ok: true;
  data: T;
}

export interface ErrorResponse {
  ok: false;
  error: string;
  code?: string;
}

export type RuntimeResponse<T> = SuccessResponse<T> | ErrorResponse;

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return typeof value.type === 'string';
}
