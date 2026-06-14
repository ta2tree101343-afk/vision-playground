import type { ReactNode } from 'react';

export function SectionShell({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h2
          className="font-sans text-lg font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
        {headerRight}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarGutter: 'stable' }}>{children}</div>
    </div>
  );
}
