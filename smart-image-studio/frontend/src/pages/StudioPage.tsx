import { useState, type ReactNode, type SVGProps } from 'react';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { ComparisonPanel } from '../components/ComparisonPanel';
import { ErrorBanner } from '../components/ErrorBanner';
import { JobHistoryPanel } from '../components/JobHistoryPanel';
import { JobStatusPanel } from '../components/JobStatusPanel';
import { NaturalLanguagePlanner } from '../components/NaturalLanguagePlanner';
import { PipelineEditor } from '../components/PipelineEditor';
import { builtInPipelinePresets } from '../config/pipelinePresets';
import { getOperationOption, operationLabels, operationOptions } from '../config/imageOperations';
import { useFile } from '../hooks/useFile';
import { usePipeline } from '../hooks/usePipeline';
import { usePlanner } from '../hooks/usePlanner';
import { useJobTracking } from '../hooks/useJobTracking';
import { buildOperationStep } from '../utils/pipeline';
import type { ImageProcessJob, ProcessImageResponse } from '../types/api';
import type { ParameterKey, PipelinePreset, PipelineStepDraft } from '../types/image';
import { navigateTo } from '../utils/navigation';

type StudioSectionId =
  | 'processing'
  | 'pipeline'
  | 'prompt'
  | 'result'
  | 'ai'
  | 'jobs';

interface SectionDefinition {
  id: StudioSectionId;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
}

function PanelFrame({
  title,
  description,
  action,
  headerClassName,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  headerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full flex-col p-0">
      <div
        className={[
          'flex flex-col gap-3 border-b border-[#e4dccf] px-4 pt-4 pb-4 md:flex-row md:items-start md:justify-between xl:min-h-[108px]',
          headerClassName ?? '',
        ].join(' ')}
      >
        <div>
          <h2 className="text-lg font-black tracking-[-0.04em] text-[#1f1f1f]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[#686253]">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4">{children}</div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#dfd8cb] bg-[#fcfbf8] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#938b7f]">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#1f1f1f]">{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#d9d1c4] bg-[#fcfbf8] px-4 py-8 text-sm leading-6 text-[#8c8477]">
      {message}
    </div>
  );
}

function SidebarIconFrame({
  active,
  label,
  expanded,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  expanded: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={[
        'group flex h-11 rounded-2xl border transition',
        expanded ? 'w-full items-center gap-2.5 px-2.5' : 'w-12 items-center justify-center',
        active
          ? 'border-[#b7cff5] bg-[#dfe9fb] text-[#3560b8]'
          : 'border-transparent bg-transparent text-[#6d6558] hover:border-[#e1d9cc] hover:bg-[#f3efe6]',
      ].join(' ')}
    >
      {children}
      {expanded ? <span className="truncate text-base font-medium">{label}</span> : null}
    </button>
  );
}

function SidebarToggleButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={expanded ? 'サイドバーを閉じる' : 'サイドバーを開く'}
        onClick={onToggle}
        className="flex h-10 w-10 items-center justify-center text-[#6d6558] transition hover:text-[#1f1f1f]"
      >
        <ImageLibraryIcon className="h-6 w-6" />
      </button>
      <div className="pointer-events-none absolute left-[55px] top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-full bg-black px-4 py-2 text-sm font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {expanded ? 'サイドバーを閉じる' : 'サイドバーを開く'}
      </div>
    </div>
  );
}

function SidebarDividerIcon({
  className,
  expanded,
}: {
  className?: string;
  expanded: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M11.5 5v14" strokeLinecap="round" />
      {expanded ? (
        <path d="m15 9-2.5 3 2.5 3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="m13 9 2.5 3-2.5 3" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ImageLibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M7.5 15.5 11 12l2.5 2.5 2.5-3 3 4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="m7 9 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15.5v2A2.5 2.5 0 0 0 7.5 20h9A2.5 2.5 0 0 0 19 17.5v-2" strokeLinecap="round" />
    </svg>
  );
}

function PipelineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="5" width="7" height="5" rx="1.5" />
      <rect x="14" y="5" width="7" height="5" rx="1.5" />
      <rect x="8.5" y="14" width="7" height="5" rx="1.5" />
      <path d="M10 7.5h4" />
      <path d="M12 10v4" />
    </svg>
  );
}

function PromptIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15h-5.8L6 19v-4.1A2.5 2.5 0 0 1 5 12.5v-6Z" />
      <path d="M8 8h8" />
      <path d="M8 11h5" />
    </svg>
  );
}

function ResultIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M12 5v14" />
      <path d="M7.5 12h1" />
      <path d="M15.5 12h1" />
    </svg>
  );
}

function AIIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 3.5 15 8l5 .7-3.7 3.6.9 5-5.2-2.8-5.2 2.8.9-5L4 8.7 9 8l3-4.5Z" />
      <circle cx="12" cy="11.5" r="2" />
    </svg>
  );
}

function JobIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 7v5l3 2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

const sectionDefinitions: SectionDefinition[] = [
  { id: 'processing', label: '画像処理', icon: UploadIcon },
  { id: 'pipeline', label: 'パイプライン', icon: PipelineIcon },
  { id: 'prompt', label: '自然言語指示', icon: PromptIcon },
  { id: 'result', label: '結果表示', icon: ResultIcon },
  { id: 'ai', label: 'AI可視化', icon: AIIcon },
  { id: 'jobs', label: 'ジョブ管理', icon: JobIcon },
];

function StudioSidebar({
  activeSection,
  expanded,
  onSelect,
  onToggle,
}: {
  activeSection: StudioSectionId;
  expanded: boolean;
  onSelect: (sectionId: StudioSectionId) => void;
  onToggle: () => void;
}) {
  return (
    <aside
      className={[
        'relative flex flex-col gap-4 border-r border-[#e5ded1] bg-[#f7f3eb] py-4 text-[#1f1f1f] transition-[padding,width]',
        expanded ? 'px-3' : 'items-center px-3',
      ].join(' ')}
    >
      <div className={expanded ? 'flex justify-start' : 'flex justify-center'}>
        <SidebarToggleButton expanded={expanded} onToggle={onToggle} />
      </div>

      <div className={['mt-2 flex flex-col gap-2', expanded ? '' : 'items-center'].join(' ')}>
        {sectionDefinitions.map((section) => {
          const Icon = section.icon;

          return (
            <SidebarIconFrame
              key={section.id}
              active={activeSection === section.id}
              label={section.label}
              expanded={expanded}
              onClick={() => onSelect(section.id)}
            >
              <Icon className="h-5 w-5" />
            </SidebarIconFrame>
          );
        })}
      </div>
    </aside>
  );
}

function ProcessingWorkspace({
  selectedFileName,
  previewUrl,
  afterPreviewUrl,
  previewMode,
  onPreviewModeChange,
  onFileSelect,
  onLoadDemo,
  onAddOperation,
  pipelineSteps,
  builtInPresets,
  savedPresets,
  presetName,
  canSavePipeline,
  hasSavedDraft,
  isProcessing,
  canProcess,
  onPresetNameChange,
  onApplyPreset,
  onSaveDraft,
  onLoadDraft,
  onSavePreset,
  onRemoveStep,
  onProcess,
}: {
  selectedFileName?: string;
  previewUrl: string | null;
  afterPreviewUrl: string | null;
  previewMode: 'before' | 'after';
  onPreviewModeChange: (mode: 'before' | 'after') => void;
  onFileSelect: (file: File | null) => void;
  onLoadDemo: () => void | Promise<void>;
  onAddOperation: (operation: (typeof operationOptions)[number]['value']) => void;
  pipelineSteps: PipelineStepDraft[];
  builtInPresets: PipelinePreset[];
  savedPresets: PipelinePreset[];
  presetName: string;
  canSavePipeline: boolean;
  hasSavedDraft: boolean;
  isProcessing: boolean;
  canProcess: boolean;
  onPresetNameChange: (value: string) => void;
  onApplyPreset: (preset: PipelinePreset) => void;
  onSaveDraft: () => void;
  onLoadDraft: () => void;
  onSavePreset: () => void;
  onRemoveStep: (stepId: string) => void;
  onProcess: () => void | Promise<void>;
}) {
  const displayPreviewUrl =
    previewMode === 'after' ? afterPreviewUrl ?? previewUrl : previewUrl ?? null;

  return (
    <div className="grid h-full min-h-full gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:gap-0 xl:divide-x xl:divide-[#e4dccf]">
      <PanelFrame
        title="画像処理"
        description="アップロード、処理追加、プリセット適用をここで行います。"
        headerClassName="xl:h-[148px]"
      >
        <label className="block cursor-pointer rounded-[18px] border border-dashed border-[#cfc6b7] bg-[#fbfaf7] px-4 py-8 text-center transition hover:border-[#a9bedf] hover:bg-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff4fc] text-[#3560b8]">
            <UploadIcon className="h-6 w-6" />
          </div>
          <div className="mt-4 text-base font-bold text-[#1f1f1f]">クリックまたはドロップ</div>
          <div className="mt-1 text-sm text-[#7f776b]">PNG・JPG・WebP・TIFF</div>
          <input
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-4">
          <div className="text-sm font-semibold text-[#302c26]">処理を追加</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {operationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onAddOperation(option.value)}
                className="rounded-full border border-[#d9d1c4] bg-white px-3 py-1.5 text-sm font-medium text-[#38342d] transition hover:bg-[#f4efe7]"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold text-[#302c26]">プリセット</div>
          <div className="mt-3 space-y-2">
            {builtInPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="block w-full rounded-[14px] border border-[#d9d1c4] bg-white px-4 py-3 text-left text-sm font-medium text-[#38342d] transition hover:bg-[#f4efe7]"
              >
                {preset.name}
              </button>
            ))}
            {savedPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="block w-full rounded-[14px] border border-[#e4dbc9] bg-[#fbfaf7] px-4 py-3 text-left text-sm text-[#4d463c] transition hover:bg-white"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </PanelFrame>

      <PanelFrame
        title="プレビュー"
        description={selectedFileName ? `選択中: ${selectedFileName}` : 'デモ画像も読み込めます。'}
        headerClassName="xl:h-[148px]"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPreviewModeChange('before')}
              className={[
                'rounded-[12px] border px-3 py-2 text-sm font-semibold transition',
                previewMode === 'before'
                  ? 'border-[#1f1f1f] bg-white text-[#1f1f1f]'
                  : 'border-[#d9d1c4] bg-[#fbfaf7] text-[#6f675c]',
              ].join(' ')}
            >
              元画像
            </button>
            <button
              type="button"
              onClick={() => onPreviewModeChange('after')}
              className={[
                'rounded-[12px] border px-3 py-2 text-sm font-semibold transition',
                previewMode === 'after'
                  ? 'border-[#1f1f1f] bg-white text-[#1f1f1f]'
                  : 'border-[#d9d1c4] bg-[#fbfaf7] text-[#6f675c]',
              ].join(' ')}
            >
              処理後
            </button>
          </div>
        }
      >
        <div className="flex h-full min-h-[30rem] flex-col rounded-[18px] border border-[#e6e0d5] bg-[#fbfaf7]">
          <div className="flex-1 overflow-hidden rounded-t-[18px]">
            {displayPreviewUrl ? (
              <img
                src={displayPreviewUrl}
                alt="プレビュー"
                className="h-full w-full object-contain bg-[#f3efe8]"
              />
            ) : (
              <div className="flex h-full min-h-[24rem] items-center justify-center px-6 py-12 text-center text-sm leading-7 text-[#7f776b]">
                画像をアップロードするとここにプレビューが表示されます。
              </div>
            )}
          </div>

          <div className="border-t border-[#e6e0d5] px-4 py-4">
            <button
              type="button"
              onClick={() => void onLoadDemo()}
              className="rounded-[14px] border border-[#d9d1c4] bg-white px-4 py-2.5 text-sm font-semibold text-[#2c2924] transition hover:bg-[#f4efe7]"
            >
              デモを読み込む
            </button>
          </div>
        </div>
      </PanelFrame>

      <PanelFrame
        title="パイプライン"
        description="右側で保存・読込・実行まで行えます。"
        headerClassName="xl:h-[148px]"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={!canSavePipeline}
              className="rounded-[12px] border border-[#d9d1c4] bg-white px-3 py-2 text-sm font-semibold text-[#2c2924] transition hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:bg-[#f4efe7] disabled:text-[#9e978b]"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => void onProcess()}
              disabled={!canProcess || isProcessing}
              className="rounded-[12px] bg-[#1f6a50] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255f4c] disabled:cursor-not-allowed disabled:bg-[#cbc5bb] disabled:text-[#8b8477]"
            >
              {isProcessing ? '実行中...' : '実行'}
            </button>
          </div>
        }
      >
        {pipelineSteps.length > 0 ? (
          <div className="space-y-3">
            {pipelineSteps.map((step, index) => (
              <div
                key={step.id}
                className="rounded-[16px] border border-[#ddd5c8] bg-[#fcfbf8] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f887d]">
                      Step {index + 1}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#1f1f1f]">
                      {operationLabels[step.operation]}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveStep(step.id)}
                    className="rounded-full border border-[#e7c7c7] bg-[#fff4f4] px-3 py-1 text-xs font-semibold text-[#a14d4d] transition hover:bg-[#ffeaea]"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="左のチップをクリックして処理ステップを追加してください。" />
        )}

        <div className="mt-4 space-y-3">
          <button
            type="button"
            onClick={onLoadDraft}
            disabled={!hasSavedDraft}
            className="w-full rounded-[14px] border border-[#d9d1c4] bg-white px-4 py-2.5 text-sm font-semibold text-[#2c2924] transition hover:bg-[#f4efe7] disabled:cursor-not-allowed disabled:bg-[#f4efe7] disabled:text-[#9e978b]"
          >
            保存済みを読み込む
          </button>

          <div className="rounded-[16px] border border-[#ddd5c8] bg-[#fcfbf8] p-3">
            <div className="text-sm font-semibold text-[#302c26]">プリセット保存</div>
            <input
              type="text"
              value={presetName}
              onChange={(event) => onPresetNameChange(event.target.value)}
              placeholder="例: SNS向け補正"
              className="mt-3 w-full rounded-[12px] border border-[#d9d1c4] bg-white px-3 py-2.5 text-sm text-[#1f1f1f] outline-none placeholder:text-[#9e978b]"
            />
            <button
              type="button"
              onClick={onSavePreset}
              disabled={!canSavePipeline || presetName.trim() === ''}
              className="mt-3 w-full rounded-[12px] bg-[#eef5ff] px-4 py-2.5 text-sm font-semibold text-[#2446a3] transition hover:bg-[#e1ecff] disabled:cursor-not-allowed disabled:bg-[#f4efe7] disabled:text-[#9e978b]"
            >
              名前付きで保存
            </button>
          </div>
        </div>
      </PanelFrame>
    </div>
  );
}

function PipelineWorkspace({
  pipelineSteps,
  onAddOperation,
  onMoveStep,
  onRemoveStep,
  onParameterChange,
}: {
  pipelineSteps: PipelineStepDraft[];
  onAddOperation: (operation: (typeof operationOptions)[number]['value']) => void;
  onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
  onRemoveStep: (stepId: string) => void;
  onParameterChange: (stepId: string, key: ParameterKey, value: number) => void;
}) {
  return (
    <div className="space-y-4">
      <PanelFrame
        title="ステップライブラリ"
        description="クリックで追加し、下のフローと編集パネルで順番とパラメータを調整します。"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {operationOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onAddOperation(option.value)}
              className="rounded-[18px] border border-[#ddd5c8] bg-[#fcfbf8] px-4 py-4 text-left transition hover:bg-white"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff4fc] text-sm font-black text-[#3560b8]">
                {option.icon}
              </div>
              <div className="mt-3 text-sm font-bold text-[#1f1f1f]">{option.label}</div>
              <div className="mt-1 text-sm leading-6 text-[#6a6458]">{option.description}</div>
            </button>
          ))}
        </div>
      </PanelFrame>

      <PanelFrame
        title="フロー表示"
        description="ドラッグ操作を想定した並び順を視覚化しています。"
      >
        {pipelineSteps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            {pipelineSteps.map((step, index) => {
              const option = getOperationOption(step.operation);

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div className="rounded-[18px] border border-[#ddd5c8] bg-[#fcfbf8] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f887d]">
                      Step {index + 1}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#1f1f1f]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#eff4fc] text-xs font-black text-[#3560b8]">
                        {option.icon}
                      </span>
                      {operationLabels[step.operation]}
                    </div>
                  </div>
                  {index < pipelineSteps.length - 1 ? (
                    <div className="text-lg text-[#a1988b]">→</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message="ステップを追加すると、ここに視覚的なフローが表示されます。" />
        )}
      </PanelFrame>

      <PipelineEditor
        steps={pipelineSteps}
        onMoveStep={onMoveStep}
        onRemoveStep={onRemoveStep}
        onParameterChange={onParameterChange}
      />
    </div>
  );
}

function ResultWorkspace({
  result,
}: {
  result: ProcessImageResponse | null;
}) {
  return (
    <div className="space-y-4">
      <PanelFrame
        title="結果表示"
        description="同期比較、差分表示、ヒストグラム、ダウンロードをここにまとめています。"
        action={
          result ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={result.original_image_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-[12px] border border-[#d9d1c4] bg-white px-3 py-2 text-sm font-semibold text-[#2c2924] transition hover:bg-[#f4efe7]"
              >
                元画像
              </a>
              <a
                href={result.processed_image_url}
                download={result.processed_filename}
                className="rounded-[12px] bg-[#1f6a50] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#255f4c]"
              >
                加工画像をDL
              </a>
              <button
                type="button"
                onClick={() => navigateTo('/result')}
                className="rounded-[12px] border border-[#d9d1c4] bg-[#eef5ff] px-3 py-2 text-sm font-semibold text-[#2446a3] transition hover:bg-[#e1ecff]"
              >
                結果ページを開く
              </button>
            </div>
          ) : null
        }
      >
        {result ? (
          <ComparisonPanel beforeImageUrl={result.original_image_url} result={result} />
        ) : (
          <EmptyState message="まだ結果がありません。画像処理を実行すると比較ビューとヒストグラムが表示されます。" />
        )}
      </PanelFrame>
    </div>
  );
}

function AIWorkspace({ result }: { result: ProcessImageResponse | null }) {
  const analysis = result?.analysis;
  const detectionCount = analysis?.object_detection?.detections.length ?? 0;
  const ocrCount = analysis?.ocr?.lines.length ?? 0;
  const captionCount = analysis?.captions?.candidates.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Detections" value={`${detectionCount}`} />
        <MetricCard label="OCR Lines" value={`${ocrCount}`} />
        <MetricCard label="Captions" value={`${captionCount}`} />
      </div>

      <PanelFrame
        title="AI可視化"
        description="バウンディングボックス、認識位置、信頼度、キャプション候補を確認できます。"
      >
        {result ? (
          <AnalysisPanel result={result} />
        ) : (
          <EmptyState message="物体検出、OCR、背景除去、キャプション生成を含む結果があるとここに可視化が表示されます。" />
        )}
      </PanelFrame>
    </div>
  );
}

function JobsWorkspace({
  activeJob,
  jobHistory,
  onOpenResult,
}: {
  activeJob: ImageProcessJob | null;
  jobHistory: ImageProcessJob[];
  onOpenResult: (job: ImageProcessJob) => void;
}) {
  const activeCount = jobHistory.filter(
    (job) => job.status === 'queued' || job.status === 'running',
  ).length;
  const completedCount = jobHistory.filter((job) => job.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Active" value={`${activeCount}`} />
        <MetricCard label="Completed" value={`${completedCount}`} />
        <MetricCard label="History" value={`${jobHistory.length}`} />
      </div>

      <div className="space-y-4">
        <JobStatusPanel job={activeJob} />
        <JobHistoryPanel jobs={jobHistory} onOpenResult={onOpenResult} />
      </div>
    </div>
  );
}

export function StudioPage() {
  const [activeSection, setActiveSection] = useState<StudioSectionId>('processing');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('before');

  const file = useFile();
  const pipeline = usePipeline();
  const planner = usePlanner();
  const jobs = useJobTracking({
    onCompleted: () => navigateTo('/result'),
  });

  const canProcess = !!file.selectedFile && pipeline.steps.length > 0;
  const canExecuteInterpretedPipeline =
    !!file.selectedFile &&
    !!planner.plan &&
    (planner.plan.steps.length ?? 0) > 0 &&
    !jobs.isProcessing;
  const canSavePipeline = pipeline.steps.length > 0;
  const hasSavedDraft = pipeline.savedDraftAt !== null;
  const errorMessage =
    file.errorMessage ?? pipeline.errorMessage ?? planner.errorMessage ?? jobs.errorMessage;

  const activeResult = jobs.activeJob?.result ?? null;
  const isProcessingSection = activeSection === 'processing';
  const currentSectionLabel =
    sectionDefinitions.find((section) => section.id === activeSection)?.label ?? '画像処理';

  function renderActiveSection() {
    switch (activeSection) {
      case 'processing':
        return (
          <ProcessingWorkspace
            selectedFileName={file.selectedFile?.name}
            previewUrl={file.previewUrl}
            afterPreviewUrl={activeResult?.processed_image_url ?? null}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
            onFileSelect={file.selectFile}
            onLoadDemo={file.loadDemoImage}
            onAddOperation={pipeline.addStep}
            pipelineSteps={pipeline.steps}
            builtInPresets={builtInPipelinePresets}
            savedPresets={pipeline.savedPresets}
            presetName={pipeline.presetName}
            canSavePipeline={canSavePipeline}
            hasSavedDraft={hasSavedDraft}
            isProcessing={jobs.isProcessing}
            canProcess={canProcess}
            onPresetNameChange={pipeline.setPresetName}
            onApplyPreset={pipeline.applyPreset}
            onSaveDraft={pipeline.saveDraft}
            onLoadDraft={pipeline.loadDraft}
            onSavePreset={pipeline.savePreset}
            onRemoveStep={pipeline.removeStep}
            onProcess={() => {
              if (!file.selectedFile) return;
              void jobs.submitJob(file.selectedFile, pipeline.steps.map(buildOperationStep));
            }}
          />
        );
      case 'pipeline':
        return (
          <PipelineWorkspace
            pipelineSteps={pipeline.steps}
            onAddOperation={pipeline.addStep}
            onMoveStep={pipeline.moveStep}
            onRemoveStep={pipeline.removeStep}
            onParameterChange={pipeline.updateStepParameter}
          />
        );
      case 'prompt':
        return (
          <NaturalLanguagePlanner
            instruction={planner.instruction}
            suggestion={planner.plan}
            isInterpreting={planner.isInterpreting}
            canExecuteSuggestion={canExecuteInterpretedPipeline}
            interpreterMode={planner.mode}
            history={planner.history}
            onInstructionChange={planner.setInstruction}
            onInterpreterModeChange={planner.setMode}
            onGenerateSuggestion={planner.generatePlan}
            onApplySuggestion={() => {
              if (planner.plan) pipeline.applyPlan(planner.plan);
            }}
            onExecuteSuggestion={() => {
              if (!file.selectedFile || !planner.plan) return;
              void jobs.submitPipelinePlan(file.selectedFile, planner.plan);
            }}
            onSelectExample={planner.selectExample}
            onSelectHistory={planner.selectHistory}
          />
        );
      case 'result':
        return <ResultWorkspace result={activeResult} />;
      case 'ai':
        return <AIWorkspace result={activeResult} />;
      case 'jobs':
        return (
          <JobsWorkspace
            activeJob={jobs.activeJob}
            jobHistory={jobs.jobHistory}
            onOpenResult={jobs.openJobResult}
          />
        );
    }
  }

  return (
    <main className="studio-shell min-h-screen bg-[#f3efe6] text-[#1f1f1f]">
      <div
        className={[
          'relative grid min-h-screen overflow-hidden border border-[#ddd5c8] bg-[#fbfaf7] transition-[grid-template-columns]',
          isSidebarExpanded ? 'grid-cols-[216px_minmax(0,1fr)]' : 'grid-cols-[88px_minmax(0,1fr)]',
        ].join(' ')}
      >
        <StudioSidebar
          activeSection={activeSection}
          expanded={isSidebarExpanded}
          onSelect={setActiveSection}
          onToggle={() => setIsSidebarExpanded((current) => !current)}
        />

        <div className="flex min-h-0 flex-col">
          <header className="border-b border-[#e6e0d5] px-5 py-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#8f877b]">
                Smart Image Studio
              </div>
              <h1 className="mt-1 text-[clamp(1.5rem,2.3vw,2rem)] font-black tracking-[-0.05em] text-[#1f1f1f]">
                {currentSectionLabel}
              </h1>
              <p className="mt-1 text-sm leading-6 text-[#686253]">
                左のサイドバーで 6 つのセクションを切り替え、既存 API に接続された機能を整理して確認できます。
              </p>
            </div>
          </header>

          <div
            className={[
              'min-h-0 flex-1 overflow-y-auto',
              isProcessingSection ? 'px-4 py-3 xl:px-0 xl:py-0' : 'px-4 py-3',
            ].join(' ')}
          >
            {errorMessage ? (
              <div className={isProcessingSection ? 'px-4 pt-3 xl:px-4 xl:pt-3' : ''}>
                <ErrorBanner message={errorMessage} />
              </div>
            ) : null}
            <div
              className={[
                errorMessage ? (isProcessingSection ? 'px-4 pt-4 xl:px-0 xl:pt-0' : 'mt-4') : '',
                isProcessingSection ? 'h-full min-h-full' : '',
              ].join(' ')}
            >
              {renderActiveSection()}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
