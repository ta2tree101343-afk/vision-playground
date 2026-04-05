import type { PipelinePreset } from '../types/image';

interface PipelinePresetPanelProps {
  builtInPresets: PipelinePreset[];
  savedPresets: PipelinePreset[];
  presetName: string;
  draftSavedAt: string | null;
  hasSavedDraft: boolean;
  canSaveCurrent: boolean;
  onPresetNameChange: (value: string) => void;
  onSaveDraft: () => void;
  onLoadDraft: () => void;
  onSavePreset: () => void;
  onApplyPreset: (preset: PipelinePreset) => void;
  onDeletePreset: (presetId: string) => void;
}

function formatSavedAt(value: string | null): string {
  if (!value) {
    return '未保存';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '未保存';
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function PipelinePresetPanel({
  builtInPresets,
  savedPresets,
  presetName,
  draftSavedAt,
  hasSavedDraft,
  canSaveCurrent,
  onPresetNameChange,
  onSaveDraft,
  onLoadDraft,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: PipelinePresetPanelProps) {
  return (
    <section className="space-y-4 rounded-[26px] border border-white/6 bg-[#0a0b10] p-5 md:p-6">
      <div className="flex items-center gap-4">
        <h2 className="text-[clamp(1.55rem,3vw,2.2rem)] font-black tracking-[-0.05em] text-white">
          保存とプリセット
        </h2>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="rounded-[20px] border border-white/8 bg-[#111217] p-4">
          <div className="text-sm font-bold text-white">作業中パイプライン</div>
          <div className="mt-1 text-sm leading-6 text-zinc-400">
            最後に保存: {formatSavedAt(draftSavedAt)}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={!canSaveCurrent}
              className="rounded-full bg-[#1f7d58] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#249469] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              パイプライン保存
            </button>
            <button
              type="button"
              onClick={onLoadDraft}
              disabled={!hasSavedDraft}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              保存内容を読み込む
            </button>
          </div>
        </div>

        <div className="rounded-[20px] border border-white/8 bg-[#111217] p-4">
          <div className="text-sm font-bold text-white">現在のパイプラインをプリセット化</div>
          <div className="mt-1 text-sm leading-6 text-zinc-400">
            名前を付けて、あとで何度でも呼び出せます。
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={presetName}
              onChange={(event) => onPresetNameChange(event.target.value)}
              placeholder="例: SNS向け補正"
              className="min-w-0 flex-1 rounded-[14px] border border-white/10 bg-[#181920] px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#0ee8b6]/35"
            />
            <button
              type="button"
              onClick={onSavePreset}
              disabled={!canSaveCurrent || presetName.trim() === ''}
              className="rounded-full border border-[#0ee8b6]/25 bg-[#0ee8b6]/10 px-4 py-2.5 text-sm font-semibold text-[#84f7d8] transition hover:bg-[#0ee8b6]/16 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-zinc-500"
            >
              プリセット保存
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-white">標準プリセット</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {builtInPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className="rounded-[20px] border border-white/8 bg-[#111217] px-4 py-4 text-left transition hover:border-[#0ee8b6]/25 hover:bg-[#15161c]"
            >
              <div className="text-sm font-black text-white">{preset.name}</div>
              <div className="mt-2 text-xs leading-6 text-zinc-400">{preset.description}</div>
              <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0ee8b6]">
                {preset.steps.length} steps
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-bold text-white">保存済みプリセット</div>
        {savedPresets.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {savedPresets.map((preset) => (
              <div
                key={preset.id}
                className="rounded-[20px] border border-white/8 bg-[#111217] px-4 py-4"
              >
                <div className="text-sm font-black text-white">{preset.name}</div>
                <div className="mt-2 text-xs leading-6 text-zinc-400">{preset.description}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onApplyPreset(preset)}
                    className="rounded-full bg-[#1f7d58] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#249469]"
                  >
                    読み込む
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePreset(preset.id)}
                    className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/15"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[20px] border border-dashed border-white/10 bg-[#111217] px-5 py-6 text-sm leading-7 text-zinc-400">
            まだ保存済みプリセットはありません。
          </div>
        )}
      </div>
    </section>
  );
}
