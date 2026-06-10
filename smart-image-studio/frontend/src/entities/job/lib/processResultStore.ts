import type { ProcessImageResponse } from '@shared/types/api';
import { normalizeProcessResult } from '@shared/lib/processResult';
import { readSessionJson, writeSessionJson, removeSessionItem } from '@shared/lib/sessionJson';

const KEY = 'smart-image-studio/latest-result';
const LOG = 'processResultStore';

export function saveLatestProcessResult(result: ProcessImageResponse): void {
  writeSessionJson(KEY, normalizeProcessResult(result), LOG);
}

export function readLatestProcessResult(): ProcessImageResponse | null {
  const parsed = readSessionJson<ProcessImageResponse>(KEY, LOG);
  if (parsed !== null && typeof parsed !== 'object') {
    console.error(`[${LOG}] 保存された処理結果の形式が不正です。`);
    removeSessionItem(KEY, LOG);
    return null;
  }
  return parsed;
}

export function clearLatestProcessResult(): void {
  removeSessionItem(KEY, LOG);
}
