import { useState } from 'react';
import type { OperationType, PipelinePlan } from '../types/api';
import type { ParameterKey, PipelinePreset, PipelineStepDraft } from '../types/image';
import {
  clonePipelineTemplates,
  createId,
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

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

export function usePipeline() {
  const initialDraft = readSavedPipelineDraft();

  const [steps, setSteps] = useState<PipelineStepDraft[]>(
    initialDraft ? clonePipelineTemplates(initialDraft.steps) : [],
  );
  const [savedPresets, setSavedPresets] = useState<PipelinePreset[]>(() => readSavedPipelinePresets());
  const [presetName, setPresetName] = useState('');
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(initialDraft?.updatedAt ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function addStep(operation: OperationType) {
    setSteps((current) => [...current, createPipelineStep(operation)]);
    setErrorMessage(null);
  }

  function removeStep(stepId: string) {
    setSteps((current) => current.filter((s) => s.id !== stepId));
    setErrorMessage(null);
  }

  function moveStep(stepId: string, direction: 'up' | 'down') {
    setSteps((current) => movePipelineStep(current, stepId, direction));
  }

  function updateStepParameter(stepId: string, key: ParameterKey, value: number) {
    setSteps((current) =>
      current.map((s) =>
        s.id === stepId ? { ...s, parameters: { ...s.parameters, [key]: value } } : s,
      ),
    );
  }

  function applyPreset(preset: PipelinePreset) {
    setSteps(clonePipelineTemplates(preset.steps));
    setPresetName(preset.name);
    setErrorMessage(null);
  }

  function applyPlan(plan: PipelinePlan) {
    setSteps(clonePipelineTemplates(pipelinePlanToTemplates(plan)));
    setErrorMessage(null);
  }

  function saveDraft() {
    if (steps.length === 0) {
      setErrorMessage('保存する前に 1 つ以上のステップを追加してください。');
      return;
    }
    try {
      const draft = savePipelineDraft(steps);
      setSavedDraftAt(draft.updatedAt);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, 'パイプラインの保存に失敗しました。'));
    }
  }

  function loadDraft() {
    try {
      const draft = readSavedPipelineDraft();
      if (!draft) {
        setErrorMessage('保存済みパイプラインがありません。');
        return;
      }
      setSteps(clonePipelineTemplates(draft.steps));
      setSavedDraftAt(draft.updatedAt);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, '保存済みパイプラインの読み込みに失敗しました。'));
    }
  }

  function savePreset() {
    if (presetName.trim() === '') {
      setErrorMessage('プリセット名を入力してください。');
      return;
    }
    if (steps.length === 0) {
      setErrorMessage('保存する前に 1 つ以上のステップを追加してください。');
      return;
    }
    const preset: PipelinePreset = {
      id: createId('preset'),
      name: presetName.trim(),
      description: `${steps.length} ステップのカスタムプリセット`,
      steps: toPipelineTemplates(steps),
    };
    try {
      setSavedPresets(savePipelinePreset(preset));
      setPresetName('');
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, 'プリセットの保存に失敗しました。'));
    }
  }

  function deletePreset(presetId: string) {
    try {
      setSavedPresets(deletePipelinePreset(presetId));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toErrorMessage(error, 'プリセットの削除に失敗しました。'));
    }
  }

  return {
    steps,
    savedPresets,
    presetName,
    setPresetName,
    savedDraftAt,
    errorMessage,
    addStep,
    removeStep,
    moveStep,
    updateStepParameter,
    applyPreset,
    applyPlan,
    saveDraft,
    loadDraft,
    savePreset,
    deletePreset,
  };
}
