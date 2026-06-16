import { type SVGProps } from 'react';
import { NODE_ICONS } from '@shared/ui/studioIcons';
import { getOperationOption } from '@entities/operation';
import type { ParameterDefinition } from '@entities/operation';
import type { ParameterKey, PipelinePreset, PipelineStepDraft } from '@entities/pipeline';
import { InspectorSlider } from './InspectorSlider';
import { InspectorSection } from './InspectorSection';
import { InspectorPresets } from './InspectorPresets';

function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path d="M5.5 3.5 13 8l-7.5 4.5V3.5Z" />
    </svg>
  );
}

export function InspectorPanel({
  selectedStep,
  stepCount,
  builtInPresets,
  isProcessing,
  canProcess,
  activePresetId,
  onParameterChange,
  onApplyPreset,
  onProcess,
}: {
  selectedStep: PipelineStepDraft | null;
  stepCount: number;
  builtInPresets: PipelinePreset[];
  isProcessing: boolean;
  canProcess: boolean;
  activePresetId: string | null;
  onParameterChange: (stepId: string, key: ParameterKey, value: number) => void;
  onApplyPreset: (preset: PipelinePreset) => void;
  onProcess: () => void | Promise<void>;
}) {
  const option = selectedStep ? getOperationOption(selectedStep.operation) : null;

  return (
    <aside
      className="flex flex-col border-l"
      style={{
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
        width: '260px',
        minWidth: '260px',
        maxWidth: '260px',
        flexShrink: 0,
        overflowX: 'hidden',
      }}
    >
      <div
        className="flex gap-2 border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => void onProcess()}
          disabled={!canProcess || isProcessing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white transition-all"
          style={{
            background: !canProcess || isProcessing ? 'var(--bg-input)' : 'var(--accent-green)',
            color: !canProcess || isProcessing ? 'var(--text-muted)' : 'white',
            cursor: !canProcess || isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          <PlayIcon className="h-3 w-3" />
          {isProcessing ? '実行中...' : stepCount > 0 ? `実行 (${stepCount})` : '実行'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedStep && option ? (
          <>
            <div
              className="border-b px-4 py-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-md"
                  style={{ background: 'var(--accent-blue-bg-mid)', color: 'var(--accent-blue-bright)' }}
                >
                  {(() => {
                    const Icon = NODE_ICONS[selectedStep.operation];
                    return Icon ? <Icon className="h-4 w-4" /> : null;
                  })()}
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {option.label}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {option.description}
              </p>
            </div>

            {option.parameters.length > 0 ? (
              <InspectorSection title={option.label} defaultOpen>
                {option.parameters.map((param: ParameterDefinition) => (
                  <InspectorSlider
                    key={param.key}
                    label={param.label}
                    paramKey={param.key}
                    value={selectedStep.parameters[param.key] ?? param.min}
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    onChange={(key, val) => onParameterChange(selectedStep.id, key, val)}
                  />
                ))}
              </InspectorSection>
            ) : (
              <div className="px-4 py-6 text-center">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  このノードに調整可能なパラメータはありません。
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-6 text-center">
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              フロー内のノードをクリックすると
              <br />
              ここにパラメータが表示されます。
            </div>
          </div>
        )}

        <InspectorPresets
          builtInPresets={builtInPresets}
          activePresetId={activePresetId}
          onApplyPreset={onApplyPreset}
        />
      </div>
    </aside>
  );
}
