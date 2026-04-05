import { useMemo, useState } from 'react';
import type { BoundingBox, DetectedObject, OcrLine, ProcessImageResponse } from '../types/api';

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

function EmptyAnalysisState() {
  return (
    <div className="rounded-[20px] border border-[#d9d1c4] bg-white p-4 text-sm leading-6 text-[#6a6458] shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
      OCR、物体検出、背景除去の可視化結果を表示します。
    </div>
  );
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function overlayStyle(box: BoundingBox, dimensions: ImageDimensions) {
  return {
    left: `${(box.x / dimensions.width) * 100}%`,
    top: `${(box.y / dimensions.height) * 100}%`,
    width: `${(box.width / dimensions.width) * 100}%`,
    height: `${(box.height / dimensions.height) * 100}%`,
  };
}

function OverlayPreviewCard({
  title,
  description,
  imageUrl,
  entries,
  accentClassName,
  badgeClassName,
  emptyMessage,
}: {
  title: string;
  description: string;
  imageUrl: string;
  entries: OverlayEntry[];
  accentClassName: string;
  badgeClassName: string;
  emptyMessage: string;
}) {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);

  return (
    <article className="rounded-[20px] border border-[#d9d1c4] bg-white p-4 shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
      <h3 className="text-base font-semibold text-[#1f1f1f]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#6a6458]">{description}</p>

      <div className="mt-4 rounded-[18px] border border-[#e5ded1] bg-[#fcfbf8] p-3">
        <div className="relative overflow-hidden rounded-2xl border border-[#e5ded1] bg-[#f3efe8]">
          <img
            src={imageUrl}
            alt={title}
            className="block w-full"
            onLoad={(event) =>
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
          {dimensions ? (
            <div className="pointer-events-none absolute inset-0">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`absolute border-2 ${accentClassName}`}
                  style={overlayStyle(entry.boundingBox, dimensions)}
                >
                  <div className={`absolute left-0 top-0 -translate-y-full rounded-md px-2 py-1 text-[10px] font-bold ${badgeClassName}`}>
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
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#ddd5c8] bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#1f1f1f]">{entry.label}</div>
                  <div className="text-xs text-[#7f776b]">
                    x:{entry.boundingBox.x} y:{entry.boundingBox.y} w:{entry.boundingBox.width} h:
                    {entry.boundingBox.height}
                  </div>
                </div>
                <div className="rounded-full border border-[#d9d1c4] bg-[#fcfbf8] px-2.5 py-1 text-xs font-semibold text-[#1f1f1f]">
                  {formatConfidence(entry.score)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[16px] border border-dashed border-[#ddd5c8] bg-white px-4 py-5 text-sm text-[#7f776b]">
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
    <article className="rounded-[20px] border border-[#d9d1c4] bg-white p-4 shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
      <h3 className="text-base font-semibold text-[#1f1f1f]">Background Mask</h3>
      <p className="mt-1 text-sm leading-6 text-[#6a6458]">
        AI が前景として残した領域をマスク表示します。
      </p>

      <div className="mt-4 rounded-[18px] border border-[#e5ded1] bg-[#fcfbf8] p-3">
        {maskImageUrl ? (
          <img
            src={maskImageUrl}
            alt="背景除去マスク"
            className="w-full rounded-2xl border border-[#e5ded1] bg-white"
          />
        ) : (
          <div className="rounded-[16px] border border-dashed border-[#ddd5c8] bg-white px-4 py-8 text-sm text-[#7f776b]">
            背景除去マスクはありません。
          </div>
        )}

        <div className="mt-3 rounded-2xl border border-[#ddd5c8] bg-white px-3 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-[#8f887d]">Foreground Ratio</div>
          <div className="mt-1 text-lg font-semibold text-[#1f1f1f]">
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
    <article className="rounded-[20px] border border-[#d9d1c4] bg-white p-4 shadow-[0_10px_25px_-20px_rgba(40,40,40,0.25)]">
      <h3 className="text-base font-semibold text-[#1f1f1f]">Caption Candidates</h3>
      <p className="mt-1 text-sm leading-6 text-[#6a6458]">
        AI 分析から組み立てた説明候補です。
      </p>

      <div className="mt-4 space-y-3 rounded-[18px] border border-[#e5ded1] bg-[#fcfbf8] p-3">
        {candidates.length > 0 ? (
          candidates.map((candidate, index) => (
            <div key={`${candidate.text}-${index}`} className="rounded-2xl border border-[#ddd5c8] bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-[#1f1f1f]">候補 {index + 1}</div>
                <div className="text-xs font-semibold text-[#2d7b65]">{formatConfidence(candidate.score)}</div>
              </div>
              <div className="mt-2 text-sm leading-6 text-[#514a3f]">{candidate.text}</div>
              <div className="mt-3 h-2 rounded-full bg-[#e7e1d6]">
                <div
                  className="h-full rounded-full bg-[#19e39d]"
                  style={{ width: `${Math.max(8, Math.round(candidate.score * 100))}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[16px] border border-dashed border-[#ddd5c8] bg-white px-4 py-5 text-sm text-[#7f776b]">
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

  const detectionEntries = useMemo<OverlayEntry[]>(() => {
    if (!analysis?.object_detection) {
      return [];
    }

    return analysis.object_detection.detections.map((item: DetectedObject, index) => ({
      id: `detection-${index}`,
      label: item.label,
      score: item.confidence,
      boundingBox: item.bounding_box,
    }));
  }, [analysis?.object_detection]);

  const ocrEntries = useMemo<OverlayEntry[]>(() => {
    if (!analysis?.ocr) {
      return [];
    }

    return analysis.ocr.lines.map((line: OcrLine, index) => ({
      id: `ocr-${index}`,
      label: line.text || `Line ${index + 1}`,
      score: line.confidence,
      boundingBox: line.bounding_box,
    }));
  }, [analysis?.ocr]);

  if (!analysis || !result) {
    return <EmptyAnalysisState />;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-black tracking-[-0.05em] text-[#1f1f1f]">AI Insights</h2>
        <div className="h-px flex-1 bg-[#e4dfd4]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OverlayPreviewCard
          title="Object Detection"
          description="検出した物体の bounding box と信頼度を元画像に重ねます。"
          imageUrl={sourceImageUrl}
          entries={detectionEntries}
          accentClassName="border-sky-400/90 bg-sky-500/5"
          badgeClassName="bg-sky-500 text-white"
          emptyMessage="物体検出の結果はありません。"
        />
        <OverlayPreviewCard
          title="OCR Position"
          description="認識した文字の位置と信頼度を元画像に重ねます。"
          imageUrl={sourceImageUrl}
          entries={ocrEntries}
          accentClassName="border-emerald-400/90 bg-emerald-500/5"
          badgeClassName="bg-emerald-500 text-black"
          emptyMessage="OCR の結果はありません。"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <BackgroundMaskCard
          maskImageUrl={analysis.background_removal?.mask_image_url}
          foregroundRatio={analysis.background_removal?.foreground_ratio}
        />
        <CaptionCandidatesCard candidates={analysis.captions?.candidates ?? []} />
      </div>
    </section>
  );
}
