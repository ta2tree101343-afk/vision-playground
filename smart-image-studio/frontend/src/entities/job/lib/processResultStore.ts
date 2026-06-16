import type { ProcessImageResponse } from '@shared/types/api';
import { readSessionJson, writeSessionJson, removeSessionItem } from '@shared/lib/sessionJson';
import { ProcessImageResponse as processImageResponseSchema } from '@shared/api/__generated__/api.schemas';

const KEY = 'smart-image-studio/latest-result';
const LOG = 'processResultStore';

export type ReadProcessResult =
  | { status: 'ok'; value: ProcessImageResponse }
  | { status: 'error' }
  | { status: 'empty' };

export function saveLatestProcessResult(result: ProcessImageResponse): boolean {
  return writeSessionJson(KEY, result, LOG);
}

export function readLatestProcessResult(): ReadProcessResult {
  let parsed: ProcessImageResponse | null;
  try {
    parsed = readSessionJson<ProcessImageResponse>(KEY, LOG);
  } catch {
    return { status: 'error' };
  }
  if (parsed === null) return { status: 'empty' };
  const validation = processImageResponseSchema.safeParse(parsed);
  if (!validation.success) {
    console.error(
      '[processResultStore] 保存された処理結果の形式が不正です。',
      validation.error.issues,
    );
    removeSessionItem(KEY, LOG);
    return { status: 'error' };
  }
  return { status: 'ok', value: validation.data as ProcessImageResponse };
}
