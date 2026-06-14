import { useEffect, useState } from 'react';
import { validateImageFile } from '@shared/lib/file';

export function useImageFile() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(file: File | null) {
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

  return { selectedFile, previewUrl, errorMessage, selectFile };
}
