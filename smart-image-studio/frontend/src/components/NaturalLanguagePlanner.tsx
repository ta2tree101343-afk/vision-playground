import { naturalLanguageExamples } from '../config/naturalLanguageExamples';
import { operationLabels } from '../config/imageOperations';
import type { PipelineInterpreterMode, PipelinePlan } from '../types/api';
import type { PlannerHistoryEntry } from '../types/image';

interface NaturalLanguagePlannerProps {
  instruction: string;
  suggestion: PipelinePlan | null;
  isInterpreting: boolean;
  canExecuteSuggestion: boolean;
  interpreterMode: PipelineInterpreterMode;
  history: PlannerHistoryEntry[];
  onInstructionChange: (value: string) => void;
  onInterpreterModeChange: (value: PipelineInterpreterMode) => void;
  onGenerateSuggestion: () => void | Promise<void>;
  onApplySuggestion: () => void;
  onExecuteSuggestion: () => void | Promise<void>;
  onSelectExample: (value: string) => void;
  onSelectHistory: (entryId: string) => void;
}

function confidenceTone(confidence: NonNullable<PipelinePlan>['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'medium':
      return 'border-sky-300 bg-sky-50 text-sky-900';
    case 'low':
      return 'border-amber-300 bg-amber-50 text-amber-900';
  }
}

function confidenceLabel(confidence: NonNullable<PipelinePlan>['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
  }
}

function formatHistoryTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function NaturalLanguagePlanner({
  instruction,
  suggestion,
  isInterpreting,
  canExecuteSuggestion,
  interpreterMode,
  history,
  onInstructionChange,
  onInterpreterModeChange,
  onGenerateSuggestion,
  onApplySuggestion,
  onExecuteSuggestion,
  onSelectExample,
  onSelectHistory,
}: NaturalLanguagePlannerProps) {
  return (
    <section className="space-y-4 p-0">
      <div className="flex items-center gap-4">
        <h2 className="text-[clamp(1.25rem,2vw,1.7rem)] font-black tracking-[-0.04em] text-[#1f1f1f]">
          自然言語指示
        </h2>
        <div className="h-px flex-1 bg-[#e4dfd4]" />
      </div>

      <p className="max-w-3xl text-sm leading-6 text-[#666055]">
        自然文を `PipelinePlan(JSON)` に解釈し、確認してから手動パイプラインへ反映するか、そのまま実行できます。
      </p>

      <div className="rounded-[20px] border border-[#e3ddd2] bg-[#fcfbf8] p-4">
        <div className="flex flex-wrap gap-2">
          {(['rule_based', 'llm'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onInterpreterModeChange(mode)}
              className={[
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                interpreterMode === mode
                  ? 'border-[#4f7cff]/20 bg-[#edf2ff] text-[#2446a3]'
                  : 'border-[#ddd5c8] bg-white text-[#514a3f] hover:bg-[#f5f1ea]',
              ].join(' ')}
            >
              {mode === 'llm' ? 'LLM' : 'Rule Based'}
            </button>
          ))}
        </div>

        <textarea
          value={instruction}
          onChange={(event) => onInstructionChange(event.target.value)}
          rows={4}
          placeholder="例: 背景を削除して人物を目立たせて"
          className="mt-3 w-full rounded-[16px] border border-[#ddd5c8] bg-white px-4 py-3 text-sm leading-7 text-[#1f1f1f] outline-none placeholder:text-[#9d9586] focus:border-[#89a0f0]"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {naturalLanguageExamples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onSelectExample(example)}
              className="rounded-full border border-[#ddd5c8] bg-white px-3 py-1.5 text-xs font-semibold text-[#514a3f] transition hover:bg-[#f5f1ea]"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void onGenerateSuggestion()}
            disabled={instruction.trim() === '' || isInterpreting}
            className="rounded-full bg-[#1f6a50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255f4c] disabled:cursor-not-allowed disabled:bg-[#d8d2c6] disabled:text-[#8b8477]"
          >
            {isInterpreting ? '解釈中...' : '解釈する'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-[20px] border border-[#e3ddd2] bg-[#fcfbf8] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-bold text-[#1f1f1f]">解釈結果</div>
              <div className="mt-1 text-sm leading-6 text-[#666055]">
                {suggestion ? suggestion.summary : 'まだ解釈結果はありません。'}
              </div>
            </div>

            {suggestion ? (
              <div
                className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${confidenceTone(suggestion.confidence)}`}
              >
                {confidenceLabel(suggestion.confidence)}
              </div>
            ) : null}
          </div>

          {suggestion ? (
            <>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-[#2d7b65]">
                interpreter: {suggestion.interpreter}
              </div>

              {suggestion.steps.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {suggestion.steps.map((step, index) => (
                    <div
                      key={`${step.operation}-${index}`}
                      className="rounded-full border border-[#d7e9df] bg-[#edf7f2] px-3 py-1.5 text-xs font-semibold text-[#2d7b65]"
                    >
                      {index + 1}. {operationLabels[step.operation]}
                    </div>
                  ))}
                </div>
              ) : null}

              {suggestion.notes.length > 0 ? (
                <div className="mt-4 rounded-[16px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {suggestion.notes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 rounded-[18px] border border-[#e3ddd2] bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c8477]">
                  JSON Preview
                </div>
                <pre className="mt-3 overflow-x-auto rounded-[14px] bg-[#f3efe8] p-3 text-xs leading-6 text-[#3f3a32]">
                  {JSON.stringify(suggestion, null, 2)}
                </pre>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void onExecuteSuggestion()}
                  disabled={!canExecuteSuggestion}
                  className="rounded-full bg-[#1f6a50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255f4c] disabled:cursor-not-allowed disabled:bg-[#d8d2c6] disabled:text-[#8b8477]"
                >
                  そのまま実行
                </button>
                <button
                  type="button"
                  onClick={onApplySuggestion}
                  disabled={suggestion.steps.length === 0}
                  className="rounded-full border border-[#d7e9df] bg-[#edf7f2] px-4 py-2 text-sm font-semibold text-[#2d7b65] transition hover:bg-[#e3f3ec] disabled:cursor-not-allowed disabled:border-[#ddd5c8] disabled:bg-[#f3efe8] disabled:text-[#8b8477]"
                >
                  手動パイプラインに反映
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-[16px] border border-dashed border-[#ddd5c8] bg-white px-4 py-8 text-sm text-[#8c8477]">
              入力後に「解釈する」を押すと、ここに JSON とステップが表示されます。
            </div>
          )}
        </div>

        <div className="rounded-[20px] border border-[#e3ddd2] bg-[#fcfbf8] p-4">
          <div className="text-sm font-bold text-[#1f1f1f]">解釈履歴</div>
          <div className="mt-1 text-sm text-[#666055]">最近の解釈結果を再表示できます。</div>

          {history.length > 0 ? (
            <div className="mt-4 space-y-3">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectHistory(entry.id)}
                  className="block w-full rounded-[16px] border border-[#ddd5c8] bg-white px-3 py-3 text-left transition hover:bg-[#f5f1ea]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#1f1f1f]">
                      {entry.mode === 'llm' ? 'LLM' : 'Rule Based'}
                    </div>
                    <div className="text-[11px] text-[#8c8477]">
                      {formatHistoryTimestamp(entry.createdAt)}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[#666055]">
                    {entry.instruction}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[16px] border border-dashed border-[#ddd5c8] bg-white px-4 py-6 text-sm text-[#8c8477]">
              まだ履歴はありません。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
