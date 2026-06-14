import { downloadBlob } from '@shared/api/apiClient';

export async function downloadProcessedImage(imageUrl: string): Promise<Blob> {
  return downloadBlob(imageUrl);
}
