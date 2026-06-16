import { useState } from 'react';
import { downloadBlob } from '@shared/api/apiClient';
import type { ProcessImageResponse } from '@shared/types/api';

export function useResultDownload(result: ProcessImageResponse | null) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canDownload = Boolean(result?.processed_image_url);

  async function handleDownload() {
    if (!result) return;

    setErrorMessage(null);

    try {
      const blob = await downloadBlob(result.processed_image_url);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = result.processed_filename || 'processed-image.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('[ResultPage] ダウンロードに失敗しました:', error);
      setErrorMessage(
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : '加工後画像のダウンロードに失敗しました。',
      );
    }
  }

  return { errorMessage, canDownload, handleDownload };
}
