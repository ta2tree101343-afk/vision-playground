import type { CSSProperties } from 'react';
import type { ImageProcessJob } from '@shared/types/api';

export function formatTimestamp(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

export function statusStyle(status: ImageProcessJob['status']): CSSProperties {
  switch (status) {
    case 'queued':
      return { borderColor: 'var(--tone-warning-border)', background: 'var(--tone-warning-bg)', color: 'var(--tone-warning-text)' };
    case 'running':
      return { borderColor: 'var(--tone-running-border)', background: 'var(--tone-running-bg)', color: 'var(--tone-running-text)' };
    case 'completed':
      return { borderColor: 'var(--tone-info-border)', background: 'var(--tone-info-bg)', color: 'var(--tone-info-text)' };
    case 'failed':
      return { borderColor: 'var(--tone-danger-border)', background: 'var(--tone-danger-bg)', color: 'var(--tone-danger-text)' };
    default: {
      const _: never = status;
      throw new Error(`Unhandled job status: ${_}`);
    }
  }
}

