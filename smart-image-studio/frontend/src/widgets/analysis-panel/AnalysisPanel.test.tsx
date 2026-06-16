import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ProcessImageResponse } from '@shared/types/api';
import { AnalysisPanel } from './AnalysisPanel';

afterEach(cleanup);

// Stub child cards to focus on AnalysisPanel's conditional rendering logic.
vi.mock('./OverlayPreviewCard', () => ({
  OverlayPreviewCard: ({ title, entries }: { title: string; entries: unknown[] }) => (
    <div data-testid={`overlay-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {title} ({entries.length} entries)
    </div>
  ),
}));

vi.mock('./BackgroundMaskCard', () => ({
  BackgroundMaskCard: ({ foregroundRatio }: { foregroundRatio?: number }) => (
    <div data-testid="background-mask">
      foreground: {foregroundRatio ?? 'n/a'}
    </div>
  ),
}));

vi.mock('./CaptionCandidatesCard', () => ({
  CaptionCandidatesCard: ({
    candidates,
    errorMessage,
  }: {
    candidates: Array<{ text: string }>;
    errorMessage?: string | null;
  }) => (
    <div data-testid="caption-candidates">
      {errorMessage ?? `${candidates.length} candidates`}
    </div>
  ),
}));

function makeResult(overrides: Partial<ProcessImageResponse> = {}): ProcessImageResponse {
  return {
    message: 'OK',
    original_image_url: 'http://localhost:8000/uploads/originals/test.jpg',
    processed_image_url: 'http://localhost:8000/uploads/processed/test.jpg',
    processed_filename: 'test.jpg',
    applied_operations: [],
    analysis: null,
    ...overrides,
  };
}

describe('AnalysisPanel', () => {
  it('renders nothing when result is null', () => {
    const { container } = render(<AnalysisPanel result={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no AI operations are applied', () => {
    const { container } = render(
      <AnalysisPanel result={makeResult({ applied_operations: [{ operation: 'grayscale' }] })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "AI Insights" heading when an AI operation is present', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'object_detection' }],
          analysis: { object_detection: { model: 'ssd', threshold: 0.5, detections: [] } },
        })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'AI Insights' })).toBeInTheDocument();
  });

  it('renders OverlayPreviewCard for object_detection results', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'object_detection' }],
          analysis: {
            object_detection: {
              model: 'ssd',
              threshold: 0.5,
              detections: [
                { label: 'cat', confidence: 0.9, bounding_box: { x: 10, y: 20, width: 100, height: 80 } },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByTestId('overlay-object-detection')).toBeInTheDocument();
    expect(screen.getByText('Object Detection (1 entries)')).toBeInTheDocument();
  });

  it('renders OverlayPreviewCard for OCR results', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'ocr' }],
          analysis: {
            ocr: {
              full_text: 'hello',
              lines: [
                { text: 'hello', confidence: 0.95, bounding_box: { x: 5, y: 5, width: 50, height: 15 } },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByTestId('overlay-ocr-position')).toBeInTheDocument();
    expect(screen.getByText('OCR Position (1 entries)')).toBeInTheDocument();
  });

  it('renders BackgroundMaskCard for background_removal', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'background_removal' }],
          analysis: {
            background_removal: { foreground_ratio: 0.6 },
          },
        })}
      />,
    );
    expect(screen.getByTestId('background-mask')).toBeInTheDocument();
    expect(screen.getByText('foreground: 0.6')).toBeInTheDocument();
  });

  it('renders CaptionCandidatesCard with candidates', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'caption_generation' }],
          analysis: {
            captions: {
              candidates: [
                { text: 'a cat sitting on a mat' },
                { text: 'a pet resting indoors' },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByTestId('caption-candidates')).toBeInTheDocument();
    expect(screen.getByText('2 candidates')).toBeInTheDocument();
  });

  it('passes error message to CaptionCandidatesCard when no candidates', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'caption_generation' }],
          analysis: { captions: { candidates: [], error_message: 'LLM unavailable' } },
        })}
      />,
    );
    expect(screen.getByText('LLM unavailable')).toBeInTheDocument();
  });

  it('shows fallback error when candidates are empty and no explicit error', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'caption_generation' }],
          analysis: { captions: { candidates: [] } },
        })}
      />,
    );
    expect(screen.getByText(/キャプション生成結果がありません/)).toBeInTheDocument();
  });

  it('renders both object_detection and OCR side by side', () => {
    render(
      <AnalysisPanel
        result={makeResult({
          applied_operations: [{ operation: 'object_detection' }, { operation: 'ocr' }],
          analysis: {
            object_detection: { model: 'ssd', threshold: 0.5, detections: [] },
            ocr: { full_text: '', lines: [] },
          },
        })}
      />,
    );
    expect(screen.getByTestId('overlay-object-detection')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-ocr-position')).toBeInTheDocument();
  });
});
