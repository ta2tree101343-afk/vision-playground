interface StatusBannerProps {
  message: string;
  tone?: 'success' | 'error' | 'info' | 'warning';
}

const toneStyles: Record<
  NonNullable<StatusBannerProps['tone']>,
  { background: string; borderColor: string; color: string }
> = {
  success: {
    background: 'var(--tone-success-bg)',
    borderColor: 'var(--tone-success-border)',
    color: 'var(--tone-success-text)',
  },
  error: {
    background: 'var(--tone-danger-bg)',
    borderColor: 'var(--tone-danger-border)',
    color: 'var(--tone-danger-text)',
  },
  info: {
    background: 'var(--tone-info-bg)',
    borderColor: 'var(--tone-info-border)',
    color: 'var(--tone-info-text)',
  },
  warning: {
    background: 'var(--tone-warning-bg)',
    borderColor: 'var(--tone-warning-border)',
    color: 'var(--tone-warning-text)',
  },
};

export function StatusBanner({ message, tone = 'info' }: StatusBannerProps) {
  if (message.trim() === '') {
    return null;
  }

  const style = toneStyles[tone];
  const role = tone === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="rounded-2xl border px-5 py-4 text-sm font-medium"
      style={style}
    >
      {message}
    </div>
  );
}
