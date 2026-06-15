import { SectionShell } from '@shared/ui/SectionShell';
import { PipelineEditor } from '@features/pipeline-edit';
import { operationOptions } from '@entities/operation';
import type { OperationOption } from '@entities/operation';
import type { ParameterKey, PipelineStepDraft } from '@entities/pipeline';

export function PipelineSection({
  pipelineSteps,
  onAddOperation,
  onMoveStep,
  onRemoveStep,
  onParameterChange,
}: {
  pipelineSteps: PipelineStepDraft[];
  onAddOperation: (op: (typeof operationOptions)[number]['value']) => void;
  onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
  onRemoveStep: (stepId: string) => void;
  onParameterChange: (stepId: string, key: ParameterKey, value: number) => void;
}) {
  return (
    <SectionShell title="パイプライン">
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          処理を追加
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {operationOptions.map((opt: OperationOption) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onAddOperation(opt.value)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <PipelineEditor
        steps={pipelineSteps}
        onMoveStep={onMoveStep}
        onRemoveStep={onRemoveStep}
        onParameterChange={onParameterChange}
      />
    </SectionShell>
  );
}
