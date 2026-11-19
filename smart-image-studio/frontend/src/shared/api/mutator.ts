import { env } from '@shared/config/env';
import { ApiError } from '@shared/api/apiClient';
import { parseResponsePayload, buildErrorMessage } from '@shared/api/responsePayload';

const BASE_URL = env.apiBaseUrl.replace(/\/$/, '');

function buildFullUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${BASE_URL}${path}`;
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
    throw new ApiError(buildErrorMessage(response.status, payload), response.status, payload);
  }

  return { data: payload, status: response.status, headers: response.headers } as T;
};
