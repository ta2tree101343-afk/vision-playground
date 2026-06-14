import { useState } from 'react';
import type { OperationType } from '@shared/types/api';
import { asUIThreshold, type ParameterKey, type PipelinePreset, type PipelineStepDraft } from '@entities/pipeline/model/pipeline.types';
import {
  clonePipelineTemplates,
  createPipelineStep,
  movePipelineStep,
  toPipelineTemplates,
} from '@features/pipeline-edit/lib/pipeline';
import {
  deletePipelinePreset,
  readSavedPipelineDraft,
  readSavedPipelinePresets,
  savePipelineDraft,
  savePipelinePreset,
} from '@features/pipeline-edit/lib/pipelineStorage';
import { toErrorMessage } from '@shared/lib/error';
import { createId } from '@shared/lib/id';

export function usePipeline() {
  const [{ initialSteps, initialSavedDraftAt, initialPresets, initError }] = useState(() => {
    let initError: string | null = null;
    let initialSteps: PipelineStepDraft[] = [];
    let initialSavedDraftAt: string | null = null;
    let initialPresets: PipelinePreset[] = [];

    try {
      const draft = readSavedPipelineDraft();
      initialSteps = draft ? clonePipelineTemplates(draft.steps) : [];
      initialSavedDraftAt = draft?.updatedAt ?? null;
    } catch (error) {
      console.error('[usePipeline] Failed to restore draft on mount:', error);
      initError = '保存済みパイプラインの復元に失敗しました。';
    }

    try {
      initialPresets = readSavedPipelinePresets();
    } catch (error) {
      console.error('[usePipeline] Failed to restore presets on mount:', error);
      if (!initError) initError = 'プリセットの読み込みに失敗しました。';
    }

    return { initialSteps, initialSavedDraftAt, initialPresets, initError };
  });
  const [steps, setSteps] = useState<PipelineStepDraft[]>(initialSteps);
  const [savedPresets, setSavedPresets] = useState<PipelinePreset[]>(initialPresets);
  const [presetName, setPresetName] = useState('');
  const [savedDraftAt, setSavedDraftAt] = useState<string | null>(initialSavedDraftAt);
  const [errorMessage, setErrorMessage] = useState<string | null>(initError);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  function addStep(operation: OperationType) {
    setSteps((current) => [...current, createPipelineStep(operation)]);
    setActivePresetId(null);
    setErrorMessage(null);
  }

  function removeStep(stepId: string) {
    setSteps((current) => current.filter((s) => s.id !== stepId));
    setActivePresetId(null);
    setErrorMessage(null);
  }

  function moveStep(stepId: string, direction: 'up' | 'down') {
    setSteps((current) => movePipelineStep(current, stepId, direction));
    setActivePresetId(null);
    setErrorMessage(null);
  }

  function reorderSteps(fromIndex: number, toIndex: number) {
    setSteps((current) => {
      if (
        fromIndex < 0 || fromIndex >= current.length ||
        toIndex < 0 || toIndex >= current.length ||
        fromIndex === toIndex
      ) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setActivePresetId(null);
    setErrorMessage(null);
  }

  function updateStepParameter(stepId: string, key: ParameterKey, value: number) {
    const typedValue = key === 'detectionThreshold' ? asUIThreshold(value) : value;
    setSteps((current) =>
      current.map((s) =>
        s.id === stepId ? { ...s, parameters: { ...s.parameters, [key]: typedValue } } : s,
      ),
    );
    setActivePresetId(null);
  }

  function applyPreset(preset: PipelinePreset) {
    setSteps(clonePipelineTemplates(preset.steps));
    setPresetName(preset.name);
    setActivePresetId(preset.id);
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
      console.error('[usePipeline] saveDraft failed:', error);
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
      setActivePresetId(null);
      setErrorMessage(null);
    } catch (error) {
      console.error('[usePipeline] loadDraft failed:', error);
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
      const nextPresets = savePipelinePreset(preset);
      setSavedPresets(nextPresets);
      setActivePresetId(preset.id);
      setPresetName('');
      setErrorMessage(null);
    } catch (error) {
      console.error('[usePipeline] savePreset failed:', error);
      setErrorMessage(toErrorMessage(error, 'プリセットの保存に失敗しました。'));
    }
  }

  function deletePreset(presetId: string) {
    try {
      setSavedPresets(deletePipelinePreset(presetId));
      setActivePresetId((current) => (current === presetId ? null : current));
      setErrorMessage(null);
    } catch (error) {
      console.error('[usePipeline] deletePreset failed:', error);
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
    setErrorMessage,
    addStep,
    removeStep,
    moveStep,
    updateStepParameter,
    applyPreset,
    saveDraft,
    loadDraft,
    savePreset,
    deletePreset,
    reorderSteps,
    activePresetId,
  };
}
