import { env } from '../config/env';
import type { ImageProcessJob, ProcessImageResponse } from '../types/api';

function buildApiAssetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl.replace(/\/$/, '')}${normalizedPath}`;
}

function normalizeAssetUrl(value: string | undefined, fallbackPath?: string): string {
  const trimmedValue = value?.trim() ?? '';

  if (trimmedValue === '') {
    return fallbackPath ? buildApiAssetUrl(fallbackPath) : '';
  }

  try {
    const url = new URL(trimmedValue, window.location.origin);

    if (url.pathname.startsWith('/uploads/')) {
      return buildApiAssetUrl(`${url.pathname}${url.search}${url.hash}`);
    }

    return url.toString();
  } catch {
    if (trimmedValue.startsWith('/uploads/') || trimmedValue.startsWith('uploads/')) {
      return buildApiAssetUrl(trimmedValue);
    }

    return fallbackPath ? buildApiAssetUrl(fallbackPath) : trimmedValue;
  }
}

export function normalizeProcessResult(result: ProcessImageResponse): ProcessImageResponse {
  return {
    ...result,
    original_image_url: normalizeAssetUrl(result.original_image_url),
    processed_image_url: normalizeAssetUrl(
      result.processed_image_url,
      `/uploads/processed/${result.processed_filename}`,
    ),
    analysis: result.analysis
      ? {
          ...result.analysis,
          background_removal: result.analysis.background_removal
            ? {
                ...result.analysis.background_removal,
                mask_image_url: result.analysis.background_removal.mask_image_url
                  ? normalizeAssetUrl(result.analysis.background_removal.mask_image_url)
                  : result.analysis.background_removal.mask_image_url,
              }
            : result.analysis.background_removal,
        }
      : result.analysis,
  };
}

export function normalizeProcessJob(job: ImageProcessJob): ImageProcessJob {
  return {
    ...job,
    result: job.result ? normalizeProcessResult(job.result) : job.result,
  };
}
