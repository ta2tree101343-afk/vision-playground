import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

vi.mock('@shared/api/apiClient', () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from '@shared/api/apiClient';
import type { ProcessImageResponse } from '@shared/types/api';
import { useResultDownload } from '@pages/result/useResultDownload';

const mockDownloadBlob = vi.mocked(downloadBlob);

const createObjectURL = vi.fn(() => 'blob:download-url');
const revokeObjectURL = vi.fn();
Object.defineProperty(globalThis, 'URL', {
  value: { createObjectURL, revokeObjectURL },
  writable: true,
});

function makeResult(overrides?: Partial<ProcessImageResponse>): ProcessImageResponse {
  return {
    message: 'Success',
    original_image_url: 'http://localhost:8000/uploads/originals/orig.png',
    processed_image_url: 'http://localhost:8000/uploads/processed/out.png',
    processed_filename: 'out.png',
    applied_operations: [],
    analysis: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockDownloadBlob.mockClear();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();

  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
  vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useResultDownload', () => {
  describe('canDownload', () => {
    it('result が null のとき false', () => {
      const { result } = renderHook(() => useResultDownload(null));
      expect(result.current.canDownload).toBe(false);
    });

    it('processed_image_url がある result のとき true', () => {
      const { result } = renderHook(() => useResultDownload(makeResult()));
      expect(result.current.canDownload).toBe(true);
    });
  });

  describe('handleDownload', () => {
    it('result が null のとき downloadBlob を呼ばない', async () => {
      const { result } = renderHook(() => useResultDownload(null));
      await act(async () => { await result.current.handleDownload(); });
      expect(mockDownloadBlob).not.toHaveBeenCalled();
    });

    it('成功時に downloadBlob を processed_image_url で呼ぶ', async () => {
      mockDownloadBlob.mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
      const res = makeResult();
      const { result } = renderHook(() => useResultDownload(res));

      await act(async () => { await result.current.handleDownload(); });

      expect(mockDownloadBlob).toHaveBeenCalledWith(res.processed_image_url);
    });

    it('成功時に errorMessage は null のまま', async () => {
      mockDownloadBlob.mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
      const { result } = renderHook(() => useResultDownload(makeResult()));

      await act(async () => { await result.current.handleDownload(); });

      expect(result.current.errorMessage).toBeNull();
    });

    it('成功時に URL.createObjectURL → revokeObjectURL を呼ぶ', async () => {
      mockDownloadBlob.mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
      const { result } = renderHook(() => useResultDownload(makeResult()));

      await act(async () => { await result.current.handleDownload(); });

      expect(createObjectURL).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:download-url');
    });

    it('downloadBlob が Error を throw すると errorMessage にメッセージが入る', async () => {
      mockDownloadBlob.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useResultDownload(makeResult()));

      await act(async () => { await result.current.handleDownload(); });

      await waitFor(() => expect(result.current.errorMessage).toBe('Network error'));
    });

    it('空メッセージの Error はデフォルトメッセージにフォールバック', async () => {
      mockDownloadBlob.mockRejectedValue(new Error('   '));
      const { result } = renderHook(() => useResultDownload(makeResult()));

      await act(async () => { await result.current.handleDownload(); });

      await waitFor(() =>
        expect(result.current.errorMessage).toBe('加工後画像のダウンロードに失敗しました。')
      );
    });

    it('Error でないオブジェクトが throw されるとデフォルトメッセージ', async () => {
      mockDownloadBlob.mockRejectedValue('string error');
      const { result } = renderHook(() => useResultDownload(makeResult()));

      await act(async () => { await result.current.handleDownload(); });

      await waitFor(() =>
        expect(result.current.errorMessage).toBe('加工後画像のダウンロードに失敗しました。')
      );
    });

    it('再試行前に errorMessage がリセットされる', async () => {
      mockDownloadBlob.mockRejectedValueOnce(new Error('fail'));
      mockDownloadBlob.mockResolvedValueOnce(new Blob(['img']));
      const { result } = renderHook(() => useResultDownload(makeResult()));

      await act(async () => { await result.current.handleDownload(); });
      await waitFor(() => expect(result.current.errorMessage).not.toBeNull());

      await act(async () => { await result.current.handleDownload(); });
      await waitFor(() => expect(result.current.errorMessage).toBeNull());
    });
  });
});
