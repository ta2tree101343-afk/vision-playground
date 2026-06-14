import { env } from '@shared/config/env';
import type { ApiErrorBody } from '@shared/types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const base = env.apiBaseUrl.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function normalizeErrorMessage(status: number, payload: unknown): string {
  if (typeof payload === 'string' && payload.trim() !== '') return payload;
  if (payload && typeof payload === 'object') {
    const detail = (payload as ApiErrorBody).detail;
    if (typeof detail === 'string' && detail.trim() !== '') return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === 'object' && 'msg' in item
            ? (item as { msg?: unknown }).msg
            : null,
        )
        .filter((m): m is string => typeof m === 'string');
      if (messages.length > 0) return messages.join(' / ');
    }
  }
  return `API request failed with status ${status}.`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  const ct = response.headers.get('content-type') ?? '';
  return ct.includes('application/json') || ct.includes('+json') ? JSON.parse(text) : text;
}

export async function downloadBlob(url: string): Promise<Blob> {
  const base = env.apiBaseUrl.replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(buildUrl(url));
  } catch (error) {
    throw new ApiError(
      `API に接続できませんでした。backend が起動しているか、接続先 ${base} が正しいか確認してください。`,
      0,
      error,
    );
  }
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await parseResponsePayload(response);
    } catch (error) {
      throw new ApiError(
        `サーバーのレスポンスを解析できませんでした (status: ${response.status})。`,
        response.status,
        error,
      );
    }
    throw new ApiError(normalizeErrorMessage(response.status, payload), response.status, payload);
  }
  return response.blob();
}
