import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createProcessJob,
  fetchProcessJob,
  fetchProcessJobs,
} from '../api/imageApi';
import { interpretPipeline, processPipelineImage } from '../api/pipelineApi';
import type {
  ImageOperationType,
  ImageProcessJob,
  PipelinePlan,
  PipelineInterpreterMode,
  ProcessImageResponse,
} from '../types/api';
import type {
  PlannerHistoryEntry,
  ParameterKey,
  PipelinePreset,
  StudioViewState,
} from '../types/image';
import { validateImageFile } from '../utils/file';
import { saveJobNotice } from '../utils/jobNoticeStore';
import {
  buildOperationStep,
  clonePipelineTemplates,
  createPipelineStep,
  movePipelineStep,
  pipelinePlanToTemplates,
  toPipelineTemplates,
} from '../utils/pipeline';
import {
  deletePipelinePreset,
  readSavedPipelineDraft,
  readSavedPipelinePresets,
  savePipelineDraft,
  savePipelinePreset,
} from '../utils/pipelineStorage';
import { saveLatestProcessResult } from '../utils/processResultStore';

interface UseImageStudioOptions {
  onProcessCompleted?: (result: ProcessImageResponse) => void;
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallbackMessage;
}

function createPresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createPlannerHistoryId(): string {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createDemoImageFile(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 840;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('デモ画像の描画に失敗しました。');
  }

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, '#f1efe5');
  background.addColorStop(1, '#d9e9f4');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#1f2937';
  context.fillRect(120, 110, 390, 540);

  context.fillStyle = '#f8fafc';
  context.fillRect(720, 150, 360, 460);

  context.fillStyle = '#0f766e';
  context.beginPath();
  context.arc(860, 330, 120, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#111827';
  context.font = 'bold 82px sans-serif';
  context.fillText('DEMO', 165, 255);
  context.font = '36px sans-serif';
  context.fillText('Smart Image Studio', 165, 320);
  context.fillText('Object / OCR / Pipeline', 165, 378);

  context.strokeStyle = '#ffffff';
  context.lineWidth = 12;
  context.strokeRect(740, 170, 320, 240);
  context.strokeRect(780, 455, 240, 110);

  context.fillStyle = '#ffffff';
  context.font = 'bold 44px sans-serif';
  context.fillText('SAMPLE', 798, 520);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error('デモ画像の生成に失敗しました。'));
        return;
      }

      resolve(nextBlob);
    }, 'image/png');
  });

  return new File([blob], 'smart-image-studio-demo.png', {
    type: 'image/png',
  });
}

export function useImageStudio(options: UseImageStudioOptions = {}) {
  const initialDraft = readSavedPipelineDraft();
  const onProcessCompletedRef = useRef(options.onProcessCompleted);
  const handledTerminalJobsRef = useRef<Set<string>>(new Set());

  const [state, setState] = useState<StudioViewState>({
    selectedFile: null,
    previewUrl: null,
    pipelineSteps: initialDraft ? clonePipelineTemplates(initialDraft.steps) : [],
    result: null,
    activeJob: null,
    jobHistory: [],
    isProcessing: false,
    errorMessage: null,
  });
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(initialDraft?.updatedAt ?? null);
  const [savedPresets, setSavedPresets] = useState<PipelinePreset[]>(() => readSavedPipelinePresets());
  const [presetName, setPresetName] = useState('');
  const [naturalLanguageInstruction, setNaturalLanguageInstruction] = useState('');
  const [pipelineSuggestion, setPipelineSuggestion] = useState<PipelinePlan | null>(null);
  const [isInterpretingPipeline, setIsInterpretingPipeline] = useState(false);
  const [plannerMode, setPlannerMode] = useState<PipelineInterpreterMode>('rule_based');
  const [plannerHistory, setPlannerHistory] = useState<PlannerHistoryEntry[]>([]);

  useEffect(() => {
    onProcessCompletedRef.current = options.onProcessCompleted;
  }, [options.onProcessCompleted]);

  useEffect(() => {
    return () => {
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }
    };
  }, [state.previewUrl]);

  const pipelineStepCount = state.pipelineSteps.length;
  const canProcess = Boolean(state.selectedFile) && pipelineStepCount > 0;
  const canExecuteInterpretedPipeline =
    Boolean(state.selectedFile) &&
    Boolean(pipelineSuggestion) &&
    (pipelineSuggestion?.steps.length ?? 0) > 0 &&
    !state.isProcessing;
  const hasSavedDraft = savedDraftAt !== null;
  const canSavePipeline = pipelineStepCount > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadInitialJobs() {
      const processJobsResult = await Promise.allSettled([fetchProcessJobs()]);

      if (cancelled) {
        return;
      }

      const jobsResult = processJobsResult[0];
      setState((current) => {
        const nextState: StudioViewState = {
          ...current,
          jobHistory:
            jobsResult.status === 'fulfilled' ? jobsResult.value : current.jobHistory,
          activeJob:
            current.activeJob ??
            (jobsResult.status === 'fulfilled'
              ? jobsResult.value.find((job) => job.status === 'queued' || job.status === 'running') ?? null
              : current.activeJob),
          isProcessing:
            current.isProcessing ||
            (jobsResult.status === 'fulfilled'
              ? jobsResult.value.some((job) => job.status === 'queued' || job.status === 'running')
              : false),
          errorMessage: current.errorMessage,
        };

        if (jobsResult.status === 'rejected') {
          nextState.errorMessage = '単体処理のジョブ履歴取得に失敗しました。';
        }

        return nextState;
      });
    }

    void loadInitialJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const activeJobId = state.activeJob?.job_id;
    const activeJobStatus = state.activeJob?.status;

    if (!activeJobId || !activeJobStatus || !['queued', 'running'].includes(activeJobStatus)) {
      return;
    }

    const pollingJobId = activeJobId;
    let cancelled = false;

    async function pollActiveJob() {
      try {
        const [job, jobs] = await Promise.all([fetchProcessJob(pollingJobId), fetchProcessJobs()]);

        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          activeJob: job,
          jobHistory: jobs,
          isProcessing: job.status === 'queued' || job.status === 'running',
        }));

        if (handledTerminalJobsRef.current.has(job.job_id)) {
          return;
        }

        if (job.status === 'completed') {
          handledTerminalJobsRef.current.add(job.job_id);

          if (!job.result) {
            setState((current) => ({
              ...current,
              isProcessing: false,
              errorMessage: 'ジョブは完了しましたが、結果を取得できませんでした。',
            }));
            return;
          }

          saveLatestProcessResult(job.result);
          saveJobNotice({
            tone: 'success',
            message: `ジョブ ${job.job_id.slice(0, 8)} が完了しました。`,
          });

          setState((current) => ({
            ...current,
            result: job.result ?? null,
            isProcessing: false,
            errorMessage: null,
          }));

          onProcessCompletedRef.current?.(job.result);
        }

        if (job.status === 'failed') {
          handledTerminalJobsRef.current.add(job.job_id);
          setState((current) => ({
            ...current,
            isProcessing: false,
            errorMessage: job.error_message ?? '画像処理ジョブが失敗しました。',
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            isProcessing: false,
            errorMessage: toErrorMessage(error, 'ジョブ状態の取得に失敗しました。'),
          }));
        }
      }
    }

    void pollActiveJob();
    const intervalId = window.setInterval(() => {
      void pollActiveJob();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [state.activeJob?.job_id, state.activeJob?.status]);

  function setPreviewForFile(file: File | null) {
    setState((current) => {
      if (current.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return {
        ...current,
        selectedFile: file,
        previewUrl: file ? URL.createObjectURL(file) : null,
        result: null,
      };
    });
  }

  function handleFileSelection(file: File | null) {
    if (!file) {
      setPreviewForFile(null);
      setState((current) => ({ ...current, errorMessage: null }));
      return;
    }

    const validationMessage = validateImageFile(file);

    if (validationMessage) {
      setPreviewForFile(null);
      setState((current) => ({ ...current, errorMessage: validationMessage }));
      return;
    }

    setPreviewForFile(file);
    setState((current) => ({ ...current, errorMessage: null }));
  }

  async function handleLoadDemoImage() {
    try {
      const demoFile = await createDemoImageFile();
      handleFileSelection(demoFile);
    } catch (error) {
      setState((current) => ({
        ...current,
        errorMessage: toErrorMessage(error, 'デモ画像の読み込みに失敗しました。'),
      }));
    }
  }

  function handleAddOperation(operation: ImageOperationType) {
    setState((current) => ({
      ...current,
      pipelineSteps: [...current.pipelineSteps, createPipelineStep(operation)],
      errorMessage: null,
    }));
  }

  function handleStepParameterChange(stepId: string, key: ParameterKey, value: number) {
    setState((current) => ({
      ...current,
      pipelineSteps: current.pipelineSteps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              parameters: {
                ...step.parameters,
                [key]: value,
              },
            }
          : step,
      ),
    }));
  }

  function handleMoveStep(stepId: string, direction: 'up' | 'down') {
    setState((current) => ({
      ...current,
      pipelineSteps: movePipelineStep(current.pipelineSteps, stepId, direction),
    }));
  }

  function handleRemoveStep(stepId: string) {
    setState((current) => ({
      ...current,
      pipelineSteps: current.pipelineSteps.filter((step) => step.id !== stepId),
      errorMessage: null,
    }));
  }

  function applyPipelinePreset(preset: PipelinePreset) {
    setState((current) => ({
      ...current,
      pipelineSteps: clonePipelineTemplates(preset.steps),
      result: null,
      errorMessage: null,
    }));
  }

  function handleApplyPreset(preset: PipelinePreset) {
    applyPipelinePreset(preset);
    setPresetName(preset.name);
  }

  function handleSavePipelineDraft() {
    if (state.pipelineSteps.length === 0) {
      setState((current) => ({
        ...current,
        errorMessage: '保存する前に 1 つ以上のステップを追加してください。',
      }));
      return;
    }

    try {
      const savedDraft = savePipelineDraft(state.pipelineSteps);
      setSavedDraftAt(savedDraft.updatedAt);
      setState((current) => ({ ...current, errorMessage: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        errorMessage: toErrorMessage(error, 'パイプラインの保存に失敗しました。'),
      }));
    }
  }

  function handleLoadSavedPipeline() {
    try {
      const savedDraft = readSavedPipelineDraft();

      if (!savedDraft) {
        setState((current) => ({
          ...current,
          errorMessage: '保存済みパイプラインがありません。',
        }));
        return;
      }

      setSavedDraftAt(savedDraft.updatedAt);
      setState((current) => ({
        ...current,
        pipelineSteps: clonePipelineTemplates(savedDraft.steps),
        result: null,
        errorMessage: null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        errorMessage: toErrorMessage(error, '保存済みパイプラインの読み込みに失敗しました。'),
      }));
    }
  }

  function handlePresetNameChange(value: string) {
    setPresetName(value);
  }

  function handleSavePreset() {
    const trimmedName = presetName.trim();

    if (trimmedName === '') {
      setState((current) => ({
        ...current,
        errorMessage: 'プリセット名を入力してください。',
      }));
      return;
    }

    if (state.pipelineSteps.length === 0) {
      setState((current) => ({
        ...current,
        errorMessage: '保存する前に 1 つ以上のステップを追加してください。',
      }));
      return;
    }

    const preset: PipelinePreset = {
      id: createPresetId(),
      name: trimmedName,
      description: `${state.pipelineSteps.length} ステップのカスタムプリセット`,
      steps: toPipelineTemplates(state.pipelineSteps),
    };

    try {
      const nextPresets = savePipelinePreset(preset);
      setSavedPresets(nextPresets);
      setPresetName('');
      setState((current) => ({ ...current, errorMessage: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        errorMessage: toErrorMessage(error, 'プリセットの保存に失敗しました。'),
      }));
    }
  }

  function handleDeletePreset(presetId: string) {
    try {
      const nextPresets = deletePipelinePreset(presetId);
      setSavedPresets(nextPresets);
      setState((current) => ({ ...current, errorMessage: null }));
    } catch (error) {
      setState((current) => ({
        ...current,
        errorMessage: toErrorMessage(error, 'プリセットの削除に失敗しました。'),
      }));
    }
  }

  const processingOperations = useMemo(
    () => state.pipelineSteps.map(buildOperationStep),
    [state.pipelineSteps],
  );

  function handleNaturalLanguageInstructionChange(value: string) {
    setNaturalLanguageInstruction(value);
  }

  function handleSelectNaturalLanguageExample(value: string) {
    setNaturalLanguageInstruction(value);
    setPipelineSuggestion(null);
  }

  function handlePlannerModeChange(mode: PipelineInterpreterMode) {
    setPlannerMode(mode);
  }

  async function handleGeneratePipelineSuggestion() {
    if (naturalLanguageInstruction.trim() === '') {
      setState((current) => ({
        ...current,
        errorMessage: '自然言語の指示を入力してください。',
      }));
      return;
    }

    setIsInterpretingPipeline(true);

    try {
      const response = await interpretPipeline({
        instruction: naturalLanguageInstruction.trim(),
        mode: plannerMode,
      });
      setPipelineSuggestion(response.plan);
      setPlannerHistory((current) =>
        [
          {
            id: createPlannerHistoryId(),
            createdAt: new Date().toISOString(),
            mode: response.plan.interpreter,
            instruction: naturalLanguageInstruction.trim(),
            plan: response.plan,
          },
          ...current,
        ].slice(0, 6),
      );
      setState((current) => ({
        ...current,
        errorMessage:
          response.plan.steps.length === 0
            ? '解釈結果に実行可能な step がありません。'
            : null,
      }));
    } catch (error) {
      setPipelineSuggestion(null);
      setState((current) => ({
        ...current,
        errorMessage: toErrorMessage(error, '自然文の解釈に失敗しました。'),
      }));
    } finally {
      setIsInterpretingPipeline(false);
    }
  }

  function handleSelectPlannerHistory(entryId: string) {
    const historyEntry = plannerHistory.find((entry) => entry.id === entryId);

    if (!historyEntry) {
      return;
    }

    setNaturalLanguageInstruction(historyEntry.instruction);
    setPlannerMode(historyEntry.mode);
    setPipelineSuggestion(historyEntry.plan);
  }

  function handleApplyPipelineSuggestion() {
    if (!pipelineSuggestion || pipelineSuggestion.steps.length === 0) {
      setState((current) => ({
        ...current,
        errorMessage: '適用できる提案がありません。',
      }));
      return;
    }

    setState((current) => ({
      ...current,
      pipelineSteps: clonePipelineTemplates(pipelinePlanToTemplates(pipelineSuggestion)),
      result: null,
      errorMessage: null,
    }));
  }

  async function handleProcessPipelineSuggestion() {
    if (!pipelineSuggestion || pipelineSuggestion.steps.length === 0) {
      setState((current) => ({
        ...current,
        errorMessage: '実行できる PipelinePlan がありません。',
      }));
      return;
    }

    if (!state.selectedFile) {
      setState((current) => ({
        ...current,
        errorMessage: '先に画像を選択してください。',
      }));
      return;
    }

    setState((current) => ({
      ...current,
      isProcessing: true,
      errorMessage: null,
    }));

    try {
      const result = await processPipelineImage({
        file: state.selectedFile,
        plan: pipelineSuggestion,
      });

      saveLatestProcessResult(result);
      setState((current) => ({
        ...current,
        result,
        isProcessing: false,
        errorMessage: null,
      }));
      onProcessCompletedRef.current?.(result);
    } catch (error) {
      setState((current) => ({
        ...current,
        isProcessing: false,
        errorMessage: toErrorMessage(error, 'PipelinePlan の実行に失敗しました。'),
      }));
    }
  }

  async function handleProcessImage() {
    if (!state.selectedFile) {
      setState((current) => ({
        ...current,
        errorMessage: '先に画像を選択してください。',
      }));
      return;
    }

    if (state.pipelineSteps.length === 0) {
      setState((current) => ({
        ...current,
        errorMessage: '先に 1 つ以上の処理を追加してください。',
      }));
      return;
    }

    setState((current) => ({
      ...current,
      isProcessing: true,
      errorMessage: null,
    }));

    try {
      const job = await createProcessJob({
        file: state.selectedFile,
        operations: processingOperations,
      });

      setState((current) => ({
        ...current,
        activeJob: job,
        jobHistory: [job, ...current.jobHistory.filter((item) => item.job_id !== job.job_id)],
        isProcessing: true,
        errorMessage: null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isProcessing: false,
        errorMessage: toErrorMessage(error, 'ジョブの作成に失敗しました。'),
      }));
    }
  }

  function handleOpenJobResult(job: ImageProcessJob) {
    if (!job.result) {
      setState((current) => ({
        ...current,
        errorMessage: 'このジョブには表示できる結果がありません。',
      }));
      return;
    }

    saveLatestProcessResult(job.result);
    onProcessCompletedRef.current?.(job.result);
  }

  return {
    state,
    savedDraftAt,
    savedPresets,
    presetName,
    naturalLanguageInstruction,
    pipelineSuggestion,
    isInterpretingPipeline,
    plannerMode,
    plannerHistory,
    canProcess,
    canExecuteInterpretedPipeline,
    canSavePipeline,
    hasSavedDraft,
    pipelineStepCount,
    handleFileSelection,
    handleLoadDemoImage,
    handleAddOperation,
    handleStepParameterChange,
    handleMoveStep,
    handleRemoveStep,
    handleApplyPreset,
    handleSavePipelineDraft,
    handleLoadSavedPipeline,
    handlePresetNameChange,
    handleSavePreset,
    handleDeletePreset,
    handleNaturalLanguageInstructionChange,
    handlePlannerModeChange,
    handleSelectNaturalLanguageExample,
    handleSelectPlannerHistory,
    handleGeneratePipelineSuggestion,
    handleApplyPipelineSuggestion,
    handleProcessPipelineSuggestion,
    handleProcessImage,
    handleOpenJobResult,
  };
}
