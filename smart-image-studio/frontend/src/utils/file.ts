const acceptedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

const maxFileSizeInBytes = 20 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!acceptedImageTypes.has(file.type)) {
    return 'JPEG / PNG / WebP / GIF / BMP の画像ファイルを選択してください。';
  }

  if (file.size === 0) {
    return '空のファイルはアップロードできません。';
  }

  if (file.size > maxFileSizeInBytes) {
    return '20MB を超える画像はアップロードできません。';
  }

  return null;
}
