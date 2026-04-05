import { getOperationOption } from '../config/imageOperations';
import { operationLabels } from '../config/imageOperations';
import type { ParameterKey, PipelineStepDraft } from '../types/image';

interface PipelineEditorProps {
  steps: PipelineStepDraft[];
  onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
  onRemoveStep: (stepId: string) => void;
  onParameterChange: (stepId: string, key: ParameterKey, value: number) => void;
}

function formatValue(key: ParameterKey, value: number): string {
  if (key === 'detectionThreshold') {
    return `${value}%`;
  }

  return String(value);
}

export function PipelineEditor({
  steps,
  onMoveStep,
  onRemoveStep,
  onParameterChange,
}: PipelineEditorProps) {
  return (
    <section className="space-y-3 p-0">
      <div className="flex items-center gap-4">
        <h2 className="text-[clamp(1.25rem,2vw,1.7rem)] font-black tracking-[-0.04em] text-[#1f1f1f]">
          パイプライン
        </h2>
        <div className="h-px flex-1 bg-[#e4dfd4]" />
      </div>

      <p className="max-w-3xl text-sm leading-6 text-[#666055]">
        順番変更、削除、各ステップの調整をここで行います。
      </p>

      {steps.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#ddd5c8] bg-[#fcfbf8] px-5 py-6 text-sm leading-7 text-[#8b8477]">
          まだステップがありません。上の処理カードから追加してください。
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => {
            const option = getOperationOption(step.operation);
            const canMoveUp = index > 0;
            const canMoveDown = index < steps.length - 1;

            return (
              <article
                key={step.id}
                className="rounded-[22px] border border-[#ddd5c8] bg-[#fcfbf8] px-4 py-4 md:px-5 md:py-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#d9d1c4] bg-white text-sm font-bold tracking-[0.04em] text-[#3560b8]">
                        {option.icon}
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3560b8]">
                          Step {index + 1}
                        </div>
                        <div className="text-lg font-black tracking-[-0.04em] text-[#1f1f1f]">
                          {operationLabels[step.operation]}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#666055]">{option.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveStep(step.id, 'up')}
                      disabled={!canMoveUp}
                      className="rounded-full border border-[#d9d1c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#38342d] transition hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↑ 上へ
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveStep(step.id, 'down')}
                      disabled={!canMoveDown}
                      className="rounded-full border border-[#d9d1c4] bg-white px-3 py-1.5 text-xs font-semibold text-[#38342d] transition hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↓ 下へ
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveStep(step.id)}
                      className="rounded-full border border-[#e2a8a8] bg-[#fde5e5] px-3 py-1.5 text-xs font-semibold text-[#9f2f2f] transition hover:border-[#d78484] hover:bg-[#fbd4d4]"
                    >
                      削除
                    </button>
                  </div>
                </div>

                {option.parameters.length > 0 ? (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {option.parameters.map((definition) => {
                      const currentValue = step.parameters[definition.key];

                      return (
                        <label
                          key={`${step.id}-${definition.key}`}
                          className="block rounded-[18px] border border-[#ddd5c8] bg-white px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-bold text-[#1f1f1f]">{definition.label}</div>
                              <div className="mt-1 text-xs leading-6 text-[#746d61]">
                                {definition.helpText}
                              </div>
                            </div>
                            <div className="rounded-full border border-[#d7e9df] bg-[#edf7f2] px-3 py-1 text-xs font-semibold text-[#2d7b65]">
                              {formatValue(definition.key, currentValue)}
                            </div>
                          </div>
                          <input
                            className="mt-3 w-full"
                            type="range"
                            min={definition.min}
                            max={definition.max}
                            step={definition.step}
                            value={currentValue}
                            onChange={(event) =>
                              onParameterChange(step.id, definition.key, Number(event.target.value))
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[18px] border border-[#ddd5c8] bg-white px-4 py-3 text-sm text-[#746d61]">
                    このステップは追加パラメータなしで実行されます。
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
