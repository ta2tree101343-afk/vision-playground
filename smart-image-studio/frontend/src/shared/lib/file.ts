const acceptedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

const acceptedImageExtensions = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tif',
  'tiff',
]);

export const maxImageFileSizeInBytes = 20 * 1024 * 1024;
export const maxImageFileSizeInMb = 20;

export function validateImageFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const typeOk =
    file.type !== '' ? acceptedImageTypes.has(file.type) : acceptedImageExtensions.has(ext);

  if (!typeOk) {
    return 'JPEG / PNG / WebP / GIF / BMP / TIFF の画像ファイルを選択してください。';
  }

  if (file.size === 0) {
    return '空のファイルはアップロードできません。';
  }

  if (file.size > maxImageFileSizeInBytes) {
    return `${maxImageFileSizeInMb}MB を超える画像はアップロードできません。`;
  }

  return null;
}
