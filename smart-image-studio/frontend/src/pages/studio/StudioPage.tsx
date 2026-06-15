import { useState } from 'react';
import { ErrorBanner } from '@shared/ui/ErrorBanner';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { Topbar } from '@widgets/studio-topbar';
import { StudioSidebar } from '@widgets/studio-sidebar';
import type { StudioSectionId } from '@widgets/studio-sidebar';
import { NodeFlowCanvas } from '@widgets/node-flow-canvas';
import { InspectorPanel } from '@widgets/inspector-panel';
import { ComparisonStrip } from '@widgets/comparison-strip';
import { JobsSection } from '@widgets/jobs-section';
import { PipelineSection } from '@widgets/pipeline-section';
import { builtInPipelinePresets, usePipeline, buildOperationStep } from '@features/pipeline-edit';
import { useImageFile } from '@features/image-upload';
import { useJobTracking } from '@features/job-tracking';
import { navigateTo } from '@shared/lib/navigation';
import type { OperationStep } from '@shared/types/api';

function SectionErrorFallback() {
  return (
    <div
      role="alert"
      className="flex h-full items-center justify-center text-sm"
      style={{ color: 'var(--text-muted)' }}
    >
      このセクションの表示中にエラーが発生しました。ページを再読み込みしてください。
    </div>
  );
}

export function StudioPage() {
  const [activeSection, setActiveSection] = useState<StudioSectionId>('processing');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const file = useImageFile();
  const pipeline = usePipeline();
  const jobs = useJobTracking({
    onCompleted: () => {
      navigateTo('/result');
    },
  });

  const canProcess = !!file.selectedFile && pipeline.steps.length > 0;
  const activeJobCount = jobs.jobHistory.filter(
    (j) => j.status === 'queued' || j.status === 'running',
  ).length;
  const selectedStep = pipeline.steps.find((s) => s.id === selectedNodeId) ?? null;
  const isProcessingView = activeSection === 'processing';

  function handleProcess() {
    if (!file.selectedFile) return;
    let ops: OperationStep[];
    try {
      ops = pipeline.steps.map(buildOperationStep);
    } catch (error) {
      console.error('[StudioPage] Failed to build operation steps:', error);
      pipeline.setErrorMessage(error instanceof Error ? error.message : 'パイプラインのビルドに失敗しました。');
      return;
    }
    void jobs.submitJob(file.selectedFile, ops);
  }

  function renderCenterContent() {
    if (isProcessingView) {
      return (
        <div className="flex h-full flex-col" style={{ minHeight: 0 }}>
          <ComparisonStrip
            beforeUrl={file.previewUrl}
            selectedFileName={file.selectedFile?.name}
            onFileSelect={file.selectFile}
          />
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <NodeFlowCanvas
              steps={pipeline.steps}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
              onAddOperation={pipeline.addStep}
              onRemoveStep={pipeline.removeStep}
              onReorderSteps={pipeline.reorderSteps}
            />
          </div>
        </div>
      );
    }

    switch (activeSection) {
      case 'pipeline':
        return (
          <ErrorBoundary fallback={<SectionErrorFallback />}>
            <PipelineSection
              pipelineSteps={pipeline.steps}
              onAddOperation={pipeline.addStep}
              onMoveStep={pipeline.moveStep}
              onRemoveStep={pipeline.removeStep}
              onParameterChange={pipeline.updateStepParameter}
            />
          </ErrorBoundary>
        );
      case 'jobs':
        return (
          <ErrorBoundary fallback={<SectionErrorFallback />}>
            <JobsSection
              activeJob={jobs.activeJob}
              jobHistory={jobs.jobHistory}
              onOpenResult={jobs.openJobResult}
            />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="studio-dark flex min-h-screen flex-col"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <Topbar />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <StudioSidebar
          activeSection={activeSection}
          jobBadge={activeJobCount}
          onSelect={(id) => {
            setActiveSection(id);
            setSelectedNodeId(null);
          }}
        />

        <div className="flex flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
          {(file.errorMessage || pipeline.errorMessage || jobs.errorMessage) && (
            <div className="flex-shrink-0 flex flex-col gap-2 px-4 pt-3">
              {file.errorMessage && <ErrorBanner message={file.errorMessage} />}
              {pipeline.errorMessage && <ErrorBanner message={pipeline.errorMessage} />}
              {jobs.errorMessage && <ErrorBanner message={jobs.errorMessage} />}
            </div>
          )}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {renderCenterContent()}
          </div>
        </div>

        {isProcessingView && (
          <InspectorPanel
            selectedStep={selectedStep}
            stepCount={pipeline.steps.length}
            builtInPresets={builtInPipelinePresets}
            isProcessing={jobs.isProcessing}
            canProcess={canProcess}
            onParameterChange={pipeline.updateStepParameter}
            onApplyPreset={pipeline.applyPreset}
            onProcess={handleProcess}
            activePresetId={pipeline.activePresetId}
          />
        )}
      </div>
    </div>
  );
}
