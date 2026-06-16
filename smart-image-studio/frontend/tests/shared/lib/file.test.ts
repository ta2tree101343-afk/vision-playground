import { describe, it, expect } from 'vitest';
import { validateImageFile, maxImageFileSizeInBytes } from '@shared/lib/file';

function makeFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('validateImageFile', () => {
  describe('有効なファイル', () => {
    it.each([
      ['image/jpeg', 'photo.jpg'],
      ['image/png', 'photo.png'],
      ['image/webp', 'photo.webp'],
      ['image/gif', 'photo.gif'],
      ['image/bmp', 'photo.bmp'],
      ['image/tiff', 'photo.tiff'],
    ])('type=%s は null を返す', (type, name) => {
      expect(validateImageFile(makeFile(name, type, 1024))).toBeNull();
    });

    it('type が空でも拡張子が png なら null を返す', () => {
      expect(validateImageFile(makeFile('photo.png', '', 1024))).toBeNull();
    });

    it('type が空でも拡張子が jpg なら null を返す', () => {
      expect(validateImageFile(makeFile('photo.jpg', '', 1024))).toBeNull();
    });

    it('type が空でも拡張子が tif なら null を返す', () => {
      expect(validateImageFile(makeFile('photo.tif', '', 1024))).toBeNull();
    });
  });

  describe('非対応の形式', () => {
    it('PDF はエラーメッセージを返す', () => {
      expect(validateImageFile(makeFile('doc.pdf', 'application/pdf', 1024))).not.toBeNull();
    });

    it('type が空で拡張子も非対応ならエラー', () => {
      expect(validateImageFile(makeFile('file.txt', '', 1024))).not.toBeNull();
    });

    it('エラーメッセージに対応形式が含まれる', () => {
      const msg = validateImageFile(makeFile('doc.pdf', 'application/pdf', 1024));
      expect(msg).toContain('PNG');
    });
  });

  describe('空ファイル', () => {
    it('サイズ 0 のファイルはエラーを返す', () => {
      expect(validateImageFile(makeFile('empty.png', 'image/png', 0))).not.toBeNull();
    });
  });

  describe('サイズ上限', () => {
    it('上限ちょうどは有効', () => {
      expect(validateImageFile(makeFile('limit.png', 'image/png', maxImageFileSizeInBytes))).toBeNull();
    });

    it('上限+1 バイトはエラー', () => {
      expect(validateImageFile(makeFile('big.png', 'image/png', maxImageFileSizeInBytes + 1))).not.toBeNull();
    });

    it('エラーメッセージに MB 数が含まれる', () => {
      const msg = validateImageFile(makeFile('big.png', 'image/png', maxImageFileSizeInBytes + 1));
      expect(msg).toContain('20');
    });
  });
});
