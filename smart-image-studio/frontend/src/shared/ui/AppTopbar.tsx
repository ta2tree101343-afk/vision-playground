import type { ReactNode } from 'react';

export function AppTopbar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between border-b px-5 py-3"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="font-sans text-base font-bold tracking-[0.04em]"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </span>
        {subtitle && (
          <span
            className="ml-1 text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {children && <div className="flex gap-2">{children}</div>}
    </header>
  );
}
