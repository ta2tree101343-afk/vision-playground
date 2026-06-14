import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@shared/config/env', () => ({
  env: { apiBaseUrl: 'http://localhost:8000' },
}));

import { customFetch } from './mutator';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/plain' },
  });
}

describe('customFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prepends BASE_URL to relative paths', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {}));
    await customFetch('/api/test', {});
    expect(fetch).toHaveBeenCalledWith('http://localhost:8000/api/test', {});
  });

  it('passes absolute URLs through unchanged', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {}));
    await customFetch('https://other.host.com/data', {});
    expect(fetch).toHaveBeenCalledWith('https://other.host.com/data', {});
  });

  it('returns { data, status, headers } wrapper on success', async () => {
    const body = { id: 'abc' };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, body));
    const result = await customFetch<{ data: typeof body; status: number; headers: Headers }>('/api/test', {});
    expect(result.data).toEqual(body);
    expect(result.status).toBe(200);
    expect(result.headers).toBeInstanceOf(Headers);
  });

  it('throws ApiError with status 0 on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(customFetch('/api/test', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
  });

  it('throws ApiError with HTTP status on 4xx error', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(404, { detail: 'Not found' }));
    await expect(customFetch('/api/test', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Not found',
    });
  });

  it('extracts error message from detail array', async () => {
    const body = { detail: [{ msg: 'field required', type: 'missing' }] };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(422, body));
    await expect(customFetch('/api/test', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      message: 'field required',
    });
  });

  it('joins multiple messages from detail array', async () => {
    const body = { detail: [{ msg: 'too short' }, { msg: 'invalid format' }] };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(422, body));
    await expect(customFetch('/api/test', {})).rejects.toMatchObject({
      message: 'too short / invalid format',
    });
  });

  it('uses fallback message when error shape is unknown', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(503, {}));
    await expect(customFetch('/api/test', {})).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('503'),
    });
  });

  it('returns null data for 204 No Content', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const result = await customFetch<{ data: null }>('/api/test', {});
    expect(result.data).toBeNull();
  });

  it('returns plain text as data for non-JSON responses', async () => {
    vi.mocked(fetch).mockResolvedValue(textResponse(200, 'hello world'));
    const result = await customFetch<{ data: string }>('/api/test', {});
    expect(result.data).toBe('hello world');
  });
});
