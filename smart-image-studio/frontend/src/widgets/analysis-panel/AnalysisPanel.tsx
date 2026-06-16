import type { DetectedObject, OcrLine, ProcessImageResponse } from '@shared/types/api';
import { OverlayPreviewCard, type OverlayEntry } from './OverlayPreviewCard';
import { BackgroundMaskCard } from './BackgroundMaskCard';
import { CaptionCandidatesCard } from './CaptionCandidatesCard';

interface AnalysisPanelProps {
  result: ProcessImageResponse | null;
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
  const captionCandidates = analysis?.captions?.candidates ?? [];
  const captionErrorMessage =
    analysis?.captions?.error_message ??
    (showCaptions && captionCandidates.length === 0
      ? 'キャプション生成結果がありません。LM Studio のモデル状態を確認してください。'
      : undefined);

  if (!hasAnyInsight || !result) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-4">
        <h2
          className="shrink-0 font-sans text-xl font-bold leading-normal pb-[0.05rem]"
          style={{ color: 'var(--text-primary)' }}
        >
          AI Insights
        </h2>
        <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
      </div>

      {(showObjectDetection || showOcr) && (
        <div className={`grid gap-4${showObjectDetection && showOcr ? ' xl:grid-cols-2' : ''}`}>
          {showObjectDetection && (
            <OverlayPreviewCard
              title="Object Detection"
              description="検出した物体の bounding box と信頼度を元画像に重ねます。"
              imageUrl={sourceImageUrl}
              entries={detectionEntries}
              accentStyle={{
                borderColor: 'var(--overlay-detection-border)',
                background: 'var(--overlay-detection-bg)',
              }}
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
              accentStyle={{
                borderColor: 'var(--overlay-ocr-border)',
                background: 'var(--overlay-ocr-bg)',
              }}
              badgeStyle={{ background: 'var(--overlay-ocr-badge-bg)', color: 'white' }}
              emptyMessage="OCR の結果はありません。"
              layout="side-by-side"
            />
          )}
        </div>
      )}

      {(showBackgroundMask || showCaptions) && (
        <div
          className={`grid gap-4${showBackgroundMask && showCaptions ? ' xl:grid-cols-[1.2fr_0.8fr]' : ''}`}
        >
          {showBackgroundMask && (
            <BackgroundMaskCard
              maskImageUrl={analysis?.background_removal?.mask_image_url}
              foregroundRatio={analysis?.background_removal?.foreground_ratio}
            />
          )}
          {showCaptions && (
            <CaptionCandidatesCard
              candidates={captionCandidates}
              errorMessage={captionErrorMessage}
              imageUrl={sourceImageUrl}
            />
          )}
        </div>
      )}
    </section>
  );
}
