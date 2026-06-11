import { useState, type CSSProperties } from 'react';
import type { BoundingBox, DetectedObject, OcrLine, ProcessImageResponse } from '@shared/types/api';

interface AnalysisPanelProps {
  result: ProcessImageResponse | null;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface OverlayEntry {
  id: string;
  label: string;
  score: number;
  boundingBox: BoundingBox;
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

function OverlayPreviewCard({
  title,
  description,
  imageUrl,
  entries,
  accentStyle,
  badgeStyle,
  emptyMessage,
}: {
  title: string;
  description: string;
  imageUrl: string;
  entries: OverlayEntry[];
  accentStyle: CSSProperties;
  badgeStyle: CSSProperties;
  emptyMessage: string;
}) {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);
  const [imgError, setImgError] = useState(false);

  if (!imageUrl.trim()) {
    return (
      <article
        className="rounded-[20px] border p-4"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
      >
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <div
          className="mt-4 rounded-[16px] border border-dashed px-4 py-5 text-sm"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)', color: 'var(--text-muted)' }}
        >
          表示できる画像URLがありません。
        </div>
      </article>
    );
  }

  return (
    <article
      className="rounded-[20px] border p-4"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{description}</p>

      <div
        className="mt-4 rounded-[18px] border p-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
      >
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

        {entries.length > 0 ? (
          <div className="mt-3 space-y-2">
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
          <div
            className="mt-3 rounded-[16px] border border-dashed px-4 py-5 text-sm"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)', color: 'var(--text-muted)' }}
          >
            {emptyMessage}
          </div>
        )}
      </div>
    </article>
  );
}

function BackgroundMaskCard({
  maskImageUrl,
  foregroundRatio,
}: {
  maskImageUrl?: string | null;
  foregroundRatio?: number;
}) {
  return (
    <article
      className="rounded-[20px] border p-4"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Background Mask</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        AI が前景として残した領域をマスク表示します。
      </p>

      <div
        className="mt-4 rounded-[18px] border p-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
      >
        {maskImageUrl ? (
          <img
            src={maskImageUrl}
            alt="背景除去マスク"
            className="w-full rounded-2xl border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)' }}
          />
        ) : (
          <div
            className="rounded-[16px] border border-dashed px-4 py-8 text-sm"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)', color: 'var(--text-muted)' }}
          >
            背景除去マスクはありません。
          </div>
        )}

        <div
          className="mt-3 rounded-2xl border px-3 py-3"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)' }}
        >
          <div className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-label)' }}>Foreground Ratio</div>
          <div className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {typeof foregroundRatio === 'number' ? `${(foregroundRatio * 100).toFixed(1)}%` : '-'}
          </div>
        </div>
      </div>
    </article>
  );
}

function CaptionCandidatesCard({
  candidates,
}: {
  candidates: Array<{ text: string; score: number }>;
}) {
  return (
    <article
      className="rounded-[20px] border p-4"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-panel-raised)' }}
    >
      <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Caption Candidates</h3>
      <p className="mt-1 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        AI 分析から組み立てた説明候補です。
      </p>

      <div
        className="mt-4 space-y-3 rounded-[18px] border p-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel)' }}
      >
        {candidates.length > 0 ? (
          candidates.map((candidate, index) => (
            <div
              key={`${candidate.text}-${index}`}
              className="rounded-2xl border p-3"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>候補 {index + 1}</div>
                <div className="text-xs font-semibold" style={{ color: 'var(--tone-ai-text)' }}>{formatConfidence(candidate.score)}</div>
              </div>
              <div className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{candidate.text}</div>
              <div className="mt-3 h-2 rounded-full" style={{ background: 'var(--border-strong)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: 'var(--tone-ai-accent)',
                    width: `${candidate.score > 0 ? clamp(Math.round(candidate.score * 100), 8, 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <div
            className="rounded-[16px] border border-dashed px-4 py-5 text-sm"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-panel-raised)', color: 'var(--text-muted)' }}
          >
            キャプション候補はまだありません。
          </div>
        )}
      </div>
    </article>
  );
}

export function AnalysisPanel({ result }: AnalysisPanelProps) {
  const analysis = result?.analysis;
  const sourceImageUrl = result?.original_image_url ?? result?.processed_image_url ?? '';

  const detections = analysis?.object_detection?.detections;
  const ocrLines = analysis?.ocr?.lines;

  const detectionEntries: OverlayEntry[] = detections
    ? detections.map((item: DetectedObject, index) => ({
        id: `detection-${index}`,
        label: item.label,
        score: item.confidence,
        boundingBox: item.bounding_box,
      }))
    : [];

  const ocrEntries: OverlayEntry[] = ocrLines
    ? ocrLines.map((line: OcrLine, index) => ({
        id: `ocr-${index}`,
        label: line.text || `Line ${index + 1}`,
        score: line.confidence,
        boundingBox: line.bounding_box,
      }))
    : [];

  const appliedOps = new Set(result?.applied_operations.map((op) => op.operation) ?? []);
  const showObjectDetection = appliedOps.has('object_detection');
  const showOcr = appliedOps.has('ocr');
  const showBackgroundMask = appliedOps.has('background_removal');
  const showCaptions = appliedOps.has('caption_generation');
  const hasAnyInsight = showObjectDetection || showOcr || showBackgroundMask || showCaptions;

  if (!hasAnyInsight || !result) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-black tracking-[-0.05em]" style={{ color: 'var(--text-primary)' }}>AI Insights</h2>
        <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
      </div>

      {(showObjectDetection || showOcr) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {showObjectDetection && (
            <OverlayPreviewCard
              title="Object Detection"
              description="検出した物体の bounding box と信頼度を元画像に重ねます。"
              imageUrl={sourceImageUrl}
              entries={detectionEntries}
              accentStyle={{ borderColor: 'var(--overlay-detection-border)', background: 'var(--overlay-detection-bg)' }}
              badgeStyle={{ background: 'var(--overlay-detection-badge-bg)', color: 'white' }}
              emptyMessage="物体検出の結果はありません。"
            />
          )}
          {showOcr && (
            <OverlayPreviewCard
              title="OCR Position"
              description="認識した文字の位置と信頼度を元画像に重ねます。"
              imageUrl={sourceImageUrl}
              entries={ocrEntries}
              accentStyle={{ borderColor: 'var(--overlay-ocr-border)', background: 'var(--overlay-ocr-bg)' }}
              badgeStyle={{ background: 'var(--overlay-ocr-badge-bg)', color: 'white' }}
              emptyMessage="OCR の結果はありません。"
            />
          )}
        </div>
      )}

      {(showBackgroundMask || showCaptions) && (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          {showBackgroundMask && (
            <BackgroundMaskCard
              maskImageUrl={analysis?.background_removal?.mask_image_url}
              foregroundRatio={analysis?.background_removal?.foreground_ratio}
            />
          )}
          {showCaptions && (
            <CaptionCandidatesCard candidates={analysis?.captions?.candidates ?? []} />
          )}
        </div>
      )}
    </section>
  );
}
