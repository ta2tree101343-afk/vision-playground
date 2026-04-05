import { env } from '../config/env';
import type { ApiErrorBody } from '../types/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestConfig<TBody = unknown> {
  path: string;
  method?: HttpMethod;
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

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

function normalizeErrorMessage(status: number, payload: unknown): string {
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const detail = (payload as ApiErrorBody).detail;

    if (typeof detail === 'string' && detail.trim() !== '') {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) => item.msg)
        .filter((message): message is string => Boolean(message))
        .join(' / ');
    }
  }

  return `API request failed with status ${status}.`;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function buildFetchBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (body instanceof FormData || body instanceof URLSearchParams) {
    return body;
  }

  return JSON.stringify(body);
}

function toNetworkErrorMessage(baseUrl: string): string {
  return `API に接続できませんでした。backend が起動しているか、接続先 ${baseUrl} が正しいか確認してください。`;
}

class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request<TResponse, TBody = unknown>({
    path,
    method = 'GET',
    body,
    headers,
    signal,
  }: RequestConfig<TBody>): Promise<TResponse> {
    const requestHeaders = new Headers(headers);
    const resolvedBody = buildFetchBody(body);

    if (resolvedBody && !(body instanceof FormData) && !requestHeaders.has('Content-Type')) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    if (!requestHeaders.has('Accept')) {
      requestHeaders.set('Accept', 'application/json');
    }

    let response: Response;

    try {
      response = await fetch(this.buildUrl(path), {
        method,
        headers: requestHeaders,
        body: resolvedBody,
        signal,
      });
    } catch (error) {
      throw new ApiError(
        error instanceof Error && error.name === 'AbortError'
          ? '通信が中断されました。'
          : toNetworkErrorMessage(this.baseUrl),
        0,
        error,
      );
    }

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw new ApiError(normalizeErrorMessage(response.status, payload), response.status, payload);
    }

    return payload as TResponse;
  }

  async download(url: string): Promise<Blob> {
    let response: Response;

    try {
      response = await fetch(this.buildUrl(url));
    } catch (error) {
      throw new ApiError(toNetworkErrorMessage(this.baseUrl), 0, error);
    }

    if (!response.ok) {
      const payload = await parseResponsePayload(response);
      throw new ApiError(normalizeErrorMessage(response.status, payload), response.status, payload);
    }

    return response.blob();
  }

  private buildUrl(path: string): string {
    if (/^https?:\/\//.test(path)) {
      return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }
}

export const apiClient = new ApiClient(env.apiBaseUrl);
