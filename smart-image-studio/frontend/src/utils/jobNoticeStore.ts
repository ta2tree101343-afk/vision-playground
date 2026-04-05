export interface JobNotice {
  tone: 'success' | 'error';
  message: string;
}

const latestJobNoticeKey = 'smart-image-studio/latest-job-notice';

export function saveJobNotice(notice: JobNotice): void {
  window.sessionStorage.setItem(latestJobNoticeKey, JSON.stringify(notice));
}

export function readJobNotice(): JobNotice | null {
  const rawValue = window.sessionStorage.getItem(latestJobNoticeKey);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as JobNotice;
  } catch {
    window.sessionStorage.removeItem(latestJobNoticeKey);
    return null;
  }
}

export function clearJobNotice(): void {
  window.sessionStorage.removeItem(latestJobNoticeKey);
}
