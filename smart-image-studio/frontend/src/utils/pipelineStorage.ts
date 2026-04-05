import type { PipelinePreset, PipelineStepDraft, SavedPipelineDraft } from '../types/image';
import { clonePipelineTemplates, toPipelineTemplates } from './pipeline';

const pipelineDraftKey = 'smart-image-studio/pipeline-draft';
const pipelinePresetsKey = 'smart-image-studio/pipeline-presets';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readJson<T>(key: string): T | null {
  if (!isBrowser()) {
    return null;
  }

  let rawValue: string | null;

  try {
    rawValue = window.localStorage.getItem(key);
  } catch {
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return null;
    }
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readSavedPipelineDraft(): SavedPipelineDraft | null {
  const draft = readJson<SavedPipelineDraft>(pipelineDraftKey);

  if (!draft || !Array.isArray(draft.steps)) {
    return null;
  }

  return {
    ...draft,
    steps: toPipelineTemplates(clonePipelineTemplates(draft.steps)),
  };
}

export function savePipelineDraft(steps: PipelineStepDraft[]): SavedPipelineDraft {
  const draft: SavedPipelineDraft = {
    steps: toPipelineTemplates(steps),
    updatedAt: new Date().toISOString(),
  };

  writeJson(pipelineDraftKey, draft);
  return draft;
}

export function readSavedPipelinePresets(): PipelinePreset[] {
  const presets = readJson<PipelinePreset[]>(pipelinePresetsKey);

  if (!Array.isArray(presets)) {
    return [];
  }

  return presets.filter((preset) => Array.isArray(preset.steps));
}

export function savePipelinePreset(preset: PipelinePreset): PipelinePreset[] {
  const currentPresets = readSavedPipelinePresets().filter((item) => item.id !== preset.id);
  const nextPresets = [
    ...currentPresets,
    {
      ...preset,
      builtIn: false,
      steps: toPipelineTemplates(clonePipelineTemplates(preset.steps)),
    },
  ];

  writeJson(pipelinePresetsKey, nextPresets);
  return nextPresets;
}

export function deletePipelinePreset(presetId: string): PipelinePreset[] {
  const nextPresets = readSavedPipelinePresets().filter((preset) => preset.id !== presetId);
  writeJson(pipelinePresetsKey, nextPresets);
  return nextPresets;
}
