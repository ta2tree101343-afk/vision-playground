import { getSessionStorage } from '@shared/lib/browser';

export function readSessionJson<T>(key: string, logPrefix: string): T | null {
  let rawValue: string | null;
  try {
    rawValue = getSessionStorage()?.getItem(key) ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      throw error;
    }
    console.error(`[${logPrefix}] sessionStorage.getItem failed:`, error);
    return null;
  }
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`[${logPrefix}] Failed to parse JSON from sessionStorage:`, error);
    removeSessionItem(key, logPrefix);
    return null;
  }
}

export function writeSessionJson(key: string, value: unknown, logPrefix: string): boolean {
  try {
    getSessionStorage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[${logPrefix}] Failed to save to sessionStorage:`, error);
    return false;
  }
}

export function removeSessionItem(key: string, logPrefix: string): void {
  try {
    getSessionStorage()?.removeItem(key);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'SecurityError')) {
      console.warn(`[${logPrefix}] removeItem failed:`, error);
    }
  }
}
