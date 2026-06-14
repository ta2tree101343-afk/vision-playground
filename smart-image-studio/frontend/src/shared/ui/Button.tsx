import type { CSSProperties, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'accent';
type Size = 'md' | 'xs';

const variantStyle: Record<Variant, CSSProperties> = {
  default: { background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' },
  primary: { background: 'var(--accent-blue)', borderColor: 'transparent', color: 'white' },
  accent: { background: 'var(--accent-blue-bg-mid)', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue-bright)' },
};

const sizeClass: Record<Size, string> = {
  md: 'px-3 py-1.5 text-sm',
  xs: 'px-2.5 py-1 text-xs',
};

export function Button({
  variant = 'default',
  size = 'md',
  disabled,
  onClick,
  type = 'button',
  className = '',
  children,
}: {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
  type?: 'button' | 'submit';
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick ? () => { void onClick(); } : undefined}
      className={`rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${sizeClass[size]} ${className}`.trim()}
      style={variantStyle[variant]}
    >
      {children}
    </button>
  );
}
