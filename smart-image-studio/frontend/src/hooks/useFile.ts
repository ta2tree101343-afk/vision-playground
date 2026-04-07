import { useEffect, useState } from 'react';
import { validateImageFile } from '../utils/file';

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

async function createDemoImageFile(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 840;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('デモ画像の描画に失敗しました。');
  }

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#f1efe5');
  background.addColorStop(1, '#d9e9f4');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#1f2937';
  context.fillRect(120, 110, 390, 540);

  context.fillStyle = '#f8fafc';
  context.fillRect(720, 150, 360, 460);

  context.fillStyle = '#0f766e';
  context.beginPath();
  context.arc(860, 330, 120, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#111827';
  context.font = 'bold 82px sans-serif';
  context.fillText('DEMO', 165, 255);
  context.font = '36px sans-serif';
  context.fillText('Smart Image Studio', 165, 320);
  context.fillText('Object / OCR / Pipeline', 165, 378);

  context.strokeStyle = '#ffffff';
  context.lineWidth = 12;
  context.strokeRect(740, 170, 320, 240);
  context.strokeRect(780, 455, 240, 110);

  context.fillStyle = '#ffffff';
  context.font = 'bold 44px sans-serif';
  context.fillText('SAMPLE', 798, 520);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error('デモ画像の生成に失敗しました。'));
        return;
      }
      resolve(nextBlob);
    }, 'image/png');
  });

  return new File([blob], 'smart-image-studio-demo.png', { type: 'image/png' });
}

export function useFile() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMessage(null);
      return;
    }

    const validationError = validateImageFile(file);

    if (validationError) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMessage(validationError);
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMessage(null);
  }

  async function loadDemoImage() {
    try {
      const demo = await createDemoImageFile();
      selectFile(demo);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, 'デモ画像の読み込みに失敗しました。'));
    }
  }

  return { selectedFile, previewUrl, errorMessage, selectFile, loadDemoImage };
}
