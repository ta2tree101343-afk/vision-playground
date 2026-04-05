interface StatusBannerProps {
  message: string;
  tone?: 'success' | 'error' | 'info';
}

const toneMap: Record<NonNullable<StatusBannerProps['tone']>, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  error: 'border-rose-300 bg-rose-50 text-rose-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
};

export function StatusBanner({ message, tone = 'info' }: StatusBannerProps) {
  return (
    <div className={`rounded-[24px] border px-5 py-4 text-sm font-medium shadow-[0_20px_60px_-32px_rgba(0,0,0,0.35)] ${toneMap[tone]}`}>
      {message}
    </div>
  );
}
