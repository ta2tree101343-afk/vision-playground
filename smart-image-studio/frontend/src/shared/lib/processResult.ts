import { env } from '@shared/config/env';
import type { ImageProcessJob, ProcessImageResponse } from '@shared/types/api';

function buildApiAssetUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.apiBaseUrl.replace(/\/$/, '')}${normalizedPath}`;
}

function normalizeAssetUrl(value: string | null | undefined, fallbackPath?: string): string {
  const trimmedValue = value?.trim() ?? '';

  if (trimmedValue === '') {
    return fallbackPath ? buildApiAssetUrl(fallbackPath) : '';
  }

  try {
    const baseOrigin =
      typeof window !== 'undefined' ? window.location.origin : env.apiBaseUrl;
    const url = new URL(trimmedValue, baseOrigin);

    if (url.pathname.startsWith('/uploads/')) {
      return buildApiAssetUrl(`${url.pathname}${url.search}${url.hash}`);
    }

    return url.toString();
  } catch (error) {
    console.error('[normalizeAssetUrl] Failed to parse URL value:', trimmedValue, error);

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
      result.processed_filename
        ? `/uploads/processed/${result.processed_filename}`
        : undefined,
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
  if (job.status !== 'completed') return job;
  const { job_id, result } = job;
  if (!result) {
    console.error('[normalizeProcessJob] Completed job missing result field:', job_id);
    return job;
  }
  return { ...job, result: normalizeProcessResult(result) };
}
