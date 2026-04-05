import type { ProcessImageResponse } from '../types/api';
import { normalizeProcessResult } from './processResult';

const latestProcessResultKey = 'smart-image-studio/latest-result';

export function saveLatestProcessResult(result: ProcessImageResponse): void {
  window.sessionStorage.setItem(
    latestProcessResultKey,
    JSON.stringify(normalizeProcessResult(result)),
  );
}

export function readLatestProcessResult(): ProcessImageResponse | null {
  const rawValue = window.sessionStorage.getItem(latestProcessResultKey);

  if (!rawValue) {
    return null;
  }

  try {
    return normalizeProcessResult(JSON.parse(rawValue) as ProcessImageResponse);
  } catch {
    window.sessionStorage.removeItem(latestProcessResultKey);
    return null;
  }
}

export function clearLatestProcessResult(): void {
  window.sessionStorage.removeItem(latestProcessResultKey);
}
