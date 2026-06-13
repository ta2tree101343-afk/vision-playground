import { env } from '@shared/config/env';
import { ApiError } from '@shared/api/apiClient';

const BASE_URL = env.apiBaseUrl.replace(/\/$/, '');

function buildFullUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${path}`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  const ct = response.headers.get('content-type') ?? '';
  return ct.includes('application/json') || ct.includes('+json')
    ? (JSON.parse(text) as unknown)
    : text;
}

function toErrorMessage(status: number, payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d: unknown) =>
          d && typeof d === 'object' && 'msg' in d ? (d as { msg?: unknown }).msg : null,
        )
        .filter((m): m is string => typeof m === 'string');
      if (msgs.length) return msgs.join(' / ');
    }
  }
  return `API に接続できませんでした（status: ${status}）。`;
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(buildFullUrl(url), options);
  } catch (error) {
    throw new ApiError(
      `API に接続できませんでした。backend が起動しているか、接続先 ${BASE_URL} が正しいか確認してください。`,
      0,
      error,
    );
  }

  let payload: unknown;
  try {
    payload = await parseResponsePayload(response);
  } catch (error) {
    throw new ApiError(
      `サーバーのレスポンスを解析できませんでした（status: ${response.status}）。`,
      response.status,
      error,
    );
  }

  if (!response.ok) {
    throw new ApiError(toErrorMessage(response.status, payload), response.status, payload);
  }

  return payload as T;
};
