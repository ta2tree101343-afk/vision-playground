import type { SVGProps } from 'react';

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M10 13V5" strokeLinecap="round" />
      <path d="m6 8 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" />
    </svg>
  );
}

export function ComparisonStrip({
  beforeUrl,
  selectedFileName,
  onFileSelect,
}: {
  beforeUrl: string | null;
  selectedFileName?: string;
  onFileSelect: (file: File | null) => void;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: '220px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-shell)',
      }}
    >
      {beforeUrl ? (
        <>
          <img
            src={beforeUrl}
            alt="元画像"
            className="h-full w-full object-contain"
            style={{ filter: 'brightness(0.95)' }}
          />
          <div className="absolute left-3 top-3 z-10 flex items-baseline gap-2">
            <span
              className="font-sans text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--text-primary)' }}
            >
              Before
            </span>
            <span className="font-mono-val text-[10px]" style={{ color: 'var(--text-muted)' }}>
              元画像
            </span>
          </div>
          {selectedFileName && (
            <div
              className="absolute bottom-3 left-3 font-mono-val text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              {selectedFileName}
            </div>
          )}
        </>
      ) : (
        <label
          className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2"
          style={{ background: 'var(--bg-shell)' }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
          >
            <UploadIcon className="h-5 w-5" />
          </div>
          <div className="text-center">
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              クリックして画像を選択
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              PNG · JPG · WebP · TIFF
            </div>
          </div>
          <input
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}
