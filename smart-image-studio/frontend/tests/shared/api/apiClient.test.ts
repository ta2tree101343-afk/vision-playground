import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, downloadBlob } from '@shared/api/apiClient';

vi.mock('@shared/config/env', () => ({
  env: { apiBaseUrl: 'http://api.test' },
}));

function makeResponse(options: {
  ok: boolean;
  status: number;
  contentType?: string;
  body?: string;
}): Response {
  const { ok, status, contentType = 'application/json', body = '' } = options;
  return {
    ok,
    status,
    headers: {
      get: (name: string) => (name === 'content-type' ? contentType : null),
    },
    text: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob([body ?? ''])),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mockFetch = () => vi.mocked(globalThis.fetch);

describe('ApiError', () => {
  it('sets name to "ApiError"', () => {
    const err = new ApiError('msg', 404);
    expect(err.name).toBe('ApiError');
  });

  it('stores status', () => {
    const err = new ApiError('msg', 503);
    expect(err.status).toBe(503);
  });

  it('stores optional payload', () => {
    const payload = { detail: 'oops' };
    const err = new ApiError('msg', 400, payload);
    expect(err.payload).toBe(payload);
  });

  it('extends Error', () => {
    expect(new ApiError('msg', 500)).toBeInstanceOf(Error);
  });
});

describe('downloadBlob', () => {
  it('returns a Blob on success', async () => {
    mockFetch().mockResolvedValue(makeResponse({ ok: true, status: 200, body: 'data' }));
    const result = await downloadBlob('/uploads/file.jpg');
    expect(result).toBeInstanceOf(Blob);
  });

  it('prepends apiBaseUrl to relative paths', async () => {
    mockFetch().mockResolvedValue(makeResponse({ ok: true, status: 200 }));
    await downloadBlob('/uploads/file.jpg');
    expect(mockFetch()).toHaveBeenCalledWith('http://api.test/uploads/file.jpg');
  });

  it('uses absolute URL as-is without prepending base', async () => {
    mockFetch().mockResolvedValue(makeResponse({ ok: true, status: 200 }));
    await downloadBlob('http://cdn.example.com/file.jpg');
    expect(mockFetch()).toHaveBeenCalledWith('http://cdn.example.com/file.jpg');
  });

  it('throws ApiError with status 0 when fetch rejects (network failure)', async () => {
    mockFetch().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(downloadBlob('/file.jpg')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
  });

  it('throws ApiError with the response status on non-OK response', async () => {
    mockFetch().mockResolvedValue(
      makeResponse({ ok: false, status: 404, body: JSON.stringify({ detail: 'not found' }) }),
    );
    await expect(downloadBlob('/file.jpg')).rejects.toMatchObject({ status: 404 });
  });

  it('uses detail string from JSON body as error message', async () => {
    mockFetch().mockResolvedValue(
      makeResponse({ ok: false, status: 422, body: JSON.stringify({ detail: 'invalid param' }) }),
    );
    const err = await downloadBlob('/file.jpg').catch((e: ApiError) => e);
    expect((err as ApiError).message).toBe('invalid param');
  });

  it('joins msg fields when detail is an array', async () => {
    const detail = [{ msg: 'field required' }, { msg: 'value too small' }];
    mockFetch().mockResolvedValue(
      makeResponse({ ok: false, status: 422, body: JSON.stringify({ detail }) }),
    );
    const err = await downloadBlob('/file.jpg').catch((e: ApiError) => e);
    expect((err as ApiError).message).toBe('field required / value too small');
  });

  it('falls back to default message when body is empty', async () => {
    mockFetch().mockResolvedValue(
      makeResponse({ ok: false, status: 500, contentType: 'text/plain', body: '' }),
    );
    const err = await downloadBlob('/file.jpg').catch((e: ApiError) => e);
    expect((err as ApiError).message).toContain('500');
  });

  it('uses plain text body as message when content-type is not JSON', async () => {
    mockFetch().mockResolvedValue(
      makeResponse({ ok: false, status: 503, contentType: 'text/plain', body: 'service unavailable' }),
    );
    const err = await downloadBlob('/file.jpg').catch((e: ApiError) => e);
    expect((err as ApiError).message).toBe('service unavailable');
  });
});
