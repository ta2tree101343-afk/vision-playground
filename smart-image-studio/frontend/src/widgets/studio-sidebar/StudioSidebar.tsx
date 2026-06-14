import type { ReactNode, SVGProps } from 'react';

export type StudioSectionId = 'processing' | 'pipeline' | 'jobs';

function ImageProcessingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="2" y="4" width="16" height="12" rx="2" />
      <path d="M6 13.5 9.5 10l2.5 2.5 2-2.5 2 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PipelineNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="2" y="4" width="5" height="4" rx="1" />
      <rect x="13" y="4" width="5" height="4" rx="1" />
      <rect x="7.5" y="12" width="5" height="4" rx="1" />
      <path d="M7 6h3M13 6h-3" strokeLinecap="round" />
      <path d="M10 8v4" strokeLinecap="round" />
    </svg>
  );
}

function JobNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface NavItem {
  id: StudioSectionId;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
}

const navItems: NavItem[] = [
  { id: 'processing', label: '画像処理', Icon: ImageProcessingIcon },
  { id: 'pipeline', label: 'パイプライン', Icon: PipelineNavIcon },
  { id: 'jobs', label: '処理履歴', Icon: JobNavIcon },
];

export function StudioSidebar({
  activeSection,
  jobBadge,
  onSelect,
}: {
  activeSection: StudioSectionId;
  jobBadge: number;
  onSelect: (id: StudioSectionId) => void;
}) {
  return (
    <aside
      className="flex flex-col border-r py-4"
      style={{
        width: '200px',
        flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
      }}
    >
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map(({ id, label, Icon }) => {
          const active = activeSection === id;
          const badge = id === 'jobs' && jobBadge > 0 ? jobBadge : 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all${!active ? ' hover-bg-sidebar hover-text-primary' : ''}`}
              style={{
                background: active ? 'var(--sidebar-item-active)' : 'transparent',
                border: active
                  ? '1px solid var(--sidebar-item-active-border)'
                  : '1px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <Icon
                className="h-4 w-4 flex-shrink-0"
                style={{ color: active ? 'var(--accent-blue-bright)' : 'inherit' }}
              />
              <span className="text-sm font-medium">{label}</span>
              {badge > 0 && (
                <span
                  className="ml-auto flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--accent-blue)', color: 'white' }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
