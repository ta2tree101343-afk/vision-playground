import { useState, type CSSProperties } from 'react';
import type { BoundingBox } from '@shared/types/api';
import { EmptyState } from '@shared/ui/EmptyState';

export interface OverlayEntry {
  id: string;
  label: string;
  score: number;
  boundingBox: BoundingBox;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatConfidence(value: number): string {
  const percentage = clamp(value * 100, 0, 100);
  return `${Math.round(percentage)}%`;
}

function overlayStyle(box: BoundingBox, dimensions: ImageDimensions) {
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    return {};
  }

  const x = clamp(box.x, 0, dimensions.width);
  const y = clamp(box.y, 0, dimensions.height);
  const right = clamp(box.x + box.width, 0, dimensions.width);
  const bottom = clamp(box.y + box.height, 0, dimensions.height);

  return {
    left: `${(x / dimensions.width) * 100}%`,
    top: `${(y / dimensions.height) * 100}%`,
    width: `${((right - x) / dimensions.width) * 100}%`,
    height: `${((bottom - y) / dimensions.height) * 100}%`,
  };
}

export function OverlayPreviewCard({
  title,
  description,
  imageUrl,
  entries,
  accentStyle,
  badgeStyle,
  emptyMessage,
  layout = 'stacked',
}: {
  title: string;
  description: string;
  imageUrl: string;
  entries: OverlayEntry[];
  accentStyle: CSSProperties;
  badgeStyle: CSSProperties;
  emptyMessage: string;
  layout?: 'stacked' | 'side-by-side';
}) {
  const horizontal = layout === 'side-by-side';
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [imgError, setImgError] = useState(false);

  if (!imageUrl.trim()) {
    return (
      <article
        className="rounded-2xl border p-4"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
      >
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <div className="mt-4">
          <EmptyState message="表示できる画像URLがありません。" />
        </div>
      </article>
    );
  }

  return (
    <article
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{description}</p>

      <div
        className={`mt-4 rounded-xl border p-3${horizontal ? ' flex items-start gap-3' : ''}`}
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
      >
        <div className={horizontal ? 'min-w-0 flex-1' : undefined}>
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}
          >
            {imgError ? (
              <div
                className="flex items-center justify-center px-4 py-8 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                画像を読み込めませんでした。
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={title}
                className="block w-full"
                onLoad={(event) => {
                  setImgError(false);
                  setDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
                onError={() => setImgError(true)}
              />
            )}
            {dimensions ? (
              <div className="pointer-events-none absolute inset-0">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="absolute border-2"
                    style={{ ...overlayStyle(entry.boundingBox, dimensions), ...accentStyle }}
                  >
                    <div className="absolute left-0 top-0 -translate-y-full rounded-md px-2 py-1 text-[10px] font-bold" style={badgeStyle}>
                      {entry.label} {formatConfidence(entry.score)}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className={horizontal ? 'min-w-0 flex-1' : undefined}>
          {entries.length > 0 ? (
            <div className={horizontal ? 'space-y-2' : 'mt-3 space-y-2'}>
              {entries.map((entry) => (
                <div
                  key={`${entry.id}-summary`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)' }}
                >
                  <div className="min-w-0">
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{entry.label}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      x:{entry.boundingBox.x} y:{entry.boundingBox.y} w:{entry.boundingBox.width} h:
                      {entry.boundingBox.height}
                    </div>
                  </div>
                  <div
                    className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                  >
                    {formatConfidence(entry.score)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={horizontal ? undefined : 'mt-3'}>
              <EmptyState message={emptyMessage} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
