import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useImageFile } from '@features/image-upload/model/useImageFile';

const createObjectURL = vi.fn(() => 'blob:mock-url');
const revokeObjectURL = vi.fn();
Object.defineProperty(globalThis, 'URL', {
  value: { createObjectURL, revokeObjectURL },
  writable: true,
});

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('useImageFile', () => {
  describe('初期状態', () => {
    it('selectedFile・previewUrl・errorMessage がすべて null', () => {
      const { result } = renderHook(() => useImageFile());
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.errorMessage).toBeNull();
    });
  });

  describe('有効なファイルを選択', () => {
    it('selectedFile がセットされる', () => {
      const { result } = renderHook(() => useImageFile());
      const file = makeFile('photo.png', 'image/png', 1024);

      act(() => result.current.selectFile(file));

      expect(result.current.selectedFile).toBe(file);
    });

    it('previewUrl が URL.createObjectURL の戻り値になる', () => {
      const { result } = renderHook(() => useImageFile());
      const file = makeFile('photo.png', 'image/png', 1024);

      act(() => result.current.selectFile(file));

      expect(result.current.previewUrl).toBe('blob:mock-url');
      expect(createObjectURL).toHaveBeenCalledWith(file);
    });

    it('errorMessage が null のまま', () => {
      const { result } = renderHook(() => useImageFile());
      act(() => result.current.selectFile(makeFile('photo.png', 'image/png', 1024)));
      expect(result.current.errorMessage).toBeNull();
    });
  });

  describe('null を渡す（選択解除）', () => {
    it('すべての状態が null にリセットされる', () => {
      const { result } = renderHook(() => useImageFile());
      act(() => result.current.selectFile(makeFile('photo.png', 'image/png', 1024)));
      act(() => result.current.selectFile(null));

      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
      expect(result.current.errorMessage).toBeNull();
    });
  });

  describe('バリデーションエラー', () => {
    it('非対応形式のファイルは errorMessage をセットし selectedFile を null に保つ', () => {
      const { result } = renderHook(() => useImageFile());
      act(() => result.current.selectFile(makeFile('doc.pdf', 'application/pdf', 1024)));

      expect(result.current.errorMessage).not.toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.previewUrl).toBeNull();
    });

    it('20MB 超のファイルは errorMessage をセットする', () => {
      const { result } = renderHook(() => useImageFile());
      const oversized = makeFile('big.png', 'image/png', 21 * 1024 * 1024);
      act(() => result.current.selectFile(oversized));

      expect(result.current.errorMessage).toContain('20');
    });

    it('空ファイルは errorMessage をセットする', () => {
      const { result } = renderHook(() => useImageFile());
      act(() => result.current.selectFile(makeFile('empty.png', 'image/png', 0)));

      expect(result.current.errorMessage).not.toBeNull();
    });
  });

  describe('エラー後に有効ファイルを選択', () => {
    it('errorMessage がクリアされる', () => {
      const { result } = renderHook(() => useImageFile());
      act(() => result.current.selectFile(makeFile('doc.pdf', 'application/pdf', 1024)));
      expect(result.current.errorMessage).not.toBeNull();

      act(() => result.current.selectFile(makeFile('photo.png', 'image/png', 1024)));
      expect(result.current.errorMessage).toBeNull();
    });
  });
});
