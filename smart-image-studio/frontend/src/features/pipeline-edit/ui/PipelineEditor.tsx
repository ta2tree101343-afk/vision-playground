import type React from 'react';
import { getOperationOption } from '@entities/operation';
import type { ParameterKey, PipelineStepDraft } from '@entities/pipeline';

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
      {steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-input)] px-5 py-6 text-sm leading-7 text-[var(--text-muted)]">
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
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-panel)] px-4 py-4 md:px-5 md:py-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-panel-raised)] text-sm font-bold tracking-[0.04em] text-[var(--accent-blue-bright)]">
                        {option.icon}
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-blue-bright)]">
                          Step {index + 1}
                        </div>
                        <div className="font-sans text-lg font-bold text-[var(--text-primary)]">
                          {option.label}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                      {option.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveStep(step.id, 'up')}
                      disabled={!canMoveUp}
                      className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-panel-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↑ 上へ
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveStep(step.id, 'down')}
                      disabled={!canMoveDown}
                      className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-panel-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↓ 下へ
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveStep(step.id)}
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none"
                      style={{
                        background: 'var(--tone-danger-bg)',
                        borderColor: 'var(--tone-danger-border)',
                        color: 'var(--tone-danger-text)',
                      }}
                    >
                      削除
                    </button>
                  </div>
                </div>

                {option.parameters.length > 0 ? (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {option.parameters.map((definition) => {
                      const currentValue = step.parameters[definition.key] ?? definition.min;

                      return (
                        <label
                          key={`${step.id}-${definition.key}`}
                          className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-bold text-[var(--text-primary)]">
                                {definition.label}
                              </div>
                              <div className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                                {definition.helpText}
                              </div>
                            </div>
                            <div className="rounded-full border border-accent-teal/20 bg-[var(--accent-teal-dim)] px-3 py-1 text-xs font-semibold text-accent-teal">
                              {formatValue(definition.key, currentValue)}
                            </div>
                          </div>
                          <input
                            aria-label={`${option.label} ${definition.label}`}
                            className="mt-3 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/40"
                            type="range"
                            min={definition.min}
                            max={definition.max}
                            step={definition.step}
                            value={currentValue}
                            style={
                              {
                                ['--range-fill' as string]: `${((currentValue - definition.min) / (definition.max - definition.min)) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(event) =>
                              onParameterChange(step.id, definition.key, Number(event.target.value))
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-raised)] px-4 py-3 text-sm text-[var(--text-secondary)]">
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
