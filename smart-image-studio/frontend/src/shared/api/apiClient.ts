import { env } from '@shared/config/env';
import { parseResponsePayload, buildErrorMessage } from '@shared/api/responsePayload';

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
    throw new ApiError(buildErrorMessage(response.status, payload), response.status, payload);
  }
  return response.blob();
}
