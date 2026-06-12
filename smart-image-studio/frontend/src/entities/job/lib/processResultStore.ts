import type { ProcessImageResponse } from '@shared/types/api';
import { normalizeProcessResult } from '@shared/lib/processResult';
import { readSessionJson, writeSessionJson, removeSessionItem } from '@shared/lib/sessionJson';

const KEY = 'smart-image-studio/latest-result';
const LOG = 'processResultStore';

export type ReadProcessResult =
  | { status: 'ok'; value: ProcessImageResponse }
  | { status: 'error' }
  | { status: 'empty' };

export function saveLatestProcessResult(result: ProcessImageResponse): boolean {
  return writeSessionJson(KEY, normalizeProcessResult(result), LOG);
}

export function readLatestProcessResult(): ReadProcessResult {
  let parsed: ProcessImageResponse | null;
  try {
    parsed = readSessionJson<ProcessImageResponse>(KEY, LOG);
  } catch {
    return { status: 'error' };
  }
  if (parsed === null) return { status: 'empty' };
  if (typeof parsed !== 'object') {
    console.error(`[${LOG}] 保存された処理結果の形式が不正です。`);
    removeSessionItem(KEY, LOG);
    return { status: 'error' };
  }
  return { status: 'ok', value: parsed };
}

export function clearLatestProcessResult(): void {
  removeSessionItem(KEY, LOG);
}
