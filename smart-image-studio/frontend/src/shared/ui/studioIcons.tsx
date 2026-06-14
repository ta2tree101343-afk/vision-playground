import type { ReactNode, SVGProps } from 'react';

export const NODE_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  grayscale: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 10h14M10 3v14" strokeOpacity="0.5" />
    </svg>
  ),
  blur: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="6" />
      <circle cx="10" cy="10" r="3" strokeOpacity="0.5" />
    </svg>
  ),
  sharpen: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10 3 17 17H3L10 3Z" />
      <path d="M10 7v5" strokeLinecap="round" />
    </svg>
  ),
  denoise: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 7h3l2 3 2-6 2 6 2-3h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h14" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  edge_detection: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M7 3v14M3 7h14" strokeOpacity="0.3" />
    </svg>
  ),
  brightness: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="4" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  ),
  contrast: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 3v14" />
      <path d="M10 3a7 7 0 0 1 0 14" fill="currentColor" fillOpacity="0.4" stroke="none" />
    </svg>
  ),
  background_removal: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10 4 16 16H4L10 4Z" />
      <path d="M3 3l14 14" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  ocr: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="2" y="4" width="16" height="12" rx="1.5" />
      <path d="M5 8h10M5 11h7" strokeLinecap="round" />
    </svg>
  ),
  object_detection: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 6V4h2M17 6V4h-2M3 14v2h2M17 14v2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="7" width="8" height="6" rx="1" />
    </svg>
  ),
  caption_generation: (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M4 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9.5L6 16v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M6.5 8h7M6.5 10.5h4" strokeLinecap="round" />
    </svg>
  ),
};

export const PRESET_ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  'builtin-sns': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-ocr': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="2" width="10" height="13" rx="1.5" />
      <path d="M5 6h6M5 9h4M5 12h5" strokeLinecap="round" />
      <circle cx="15" cy="15" r="3" />
      <path d="M17.1 17.1l1.4 1.4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-portrait': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
    </svg>
  ),
  'builtin-product': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M10 2L17 5.5v9L10 18 3 14.5v-9L10 2Z" strokeLinejoin="round" />
      <path d="M10 18V10M3 5.5l7 4 7-4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-denoise': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 7h3l2 3 2-6 2 6 2-3h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13h14" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  'builtin-scan': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="1.5" />
      <path d="M3 9.5h14" strokeWidth="2" />
      <path d="M6 13h8M6 16h5" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  ),
  'builtin-grayscale': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 10h14M10 3v14" strokeOpacity="0.5" />
    </svg>
  ),
  'builtin-detect': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M3 6V4h2M17 6V4h-2M3 14v2h2M17 14v2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="6" y="7" width="8" height="6" rx="1" />
    </svg>
  ),
  'builtin-caption': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M4 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9.5L6 16v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M6.5 8h7M6.5 10.5h4" strokeLinecap="round" />
    </svg>
  ),
  'builtin-full-analysis': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  ),
  'builtin-lowlight': (p) => (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M15.5 11.5A6.5 6.5 0 0 1 9 5a6.5 6.5 0 1 0 6.5 6.5Z" />
    </svg>
  ),
};
