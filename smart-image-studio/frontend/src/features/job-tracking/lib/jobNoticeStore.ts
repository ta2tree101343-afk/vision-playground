import { readSessionJson, writeSessionJson, removeSessionItem } from '@shared/lib/sessionJson';

export interface JobNotice {
  tone: 'success' | 'error';
  message: string;
}

const KEY = 'smart-image-studio/latest-job-notice';
const LOG = 'jobNoticeStore';

export function saveJobNotice(notice: JobNotice): void {
  writeSessionJson(KEY, notice, LOG);
}

export function readJobNotice(): JobNotice | null {
  return readSessionJson<JobNotice>(KEY, LOG);
}

export function clearJobNotice(): void {
  removeSessionItem(KEY, LOG);
}
