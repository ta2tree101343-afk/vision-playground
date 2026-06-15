import type { ParameterKey, PipelinePreset, PipelineStepDraft, SavedPipelineDraft } from '@entities/pipeline';
import { clonePipelineTemplates, toPipelineTemplates } from './pipeline';
import { parameterConstraints, sanitizeParameter } from '@entities/operation';
import { isBrowser } from '@shared/lib/browser';
import { OperationType as operationTypeSchema } from '@shared/api/__generated__/api.schemas';

const pipelineDraftKey = 'smart-image-studio/pipeline-draft';
const pipelinePresetsKey = 'smart-image-studio/pipeline-presets';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPipelineStepLike(value: unknown): value is PipelinePreset['steps'][number] {
  return isObject(value) && operationTypeSchema.safeParse(value.operation).success;
}

const PARAMETER_KEYS = new Set(Object.keys(parameterConstraints));

function sanitizeParameters(params: unknown): Record<string, number> {
  if (!isObject(params)) return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (PARAMETER_KEYS.has(key)) {
      result[key] = sanitizeParameter(key as ParameterKey, value);
    }
  }
  return result;
}

function readJson<T>(key: string): T | null {
  if (!isBrowser()) {
    return null;
  }

  let rawValue: string | null;

  try {
    rawValue = window.localStorage.getItem(key);
  } catch (error) {
    console.error('[pipelineStorage] localStorage.getItem failed for key:', key, error);
    return null;
  }

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (parseError) {
    console.error('[pipelineStorage] JSON.parse failed for key:', key, parseError);
    try {
      window.localStorage.removeItem(key);
    } catch (removeError) {
      console.error('[pipelineStorage] localStorage.removeItem failed for key:', key, removeError);
    }
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) {
    return;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new Error(
      `[pipelineStorage] Failed to serialize data for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  try {
    window.localStorage.setItem(key, serialized);
  } catch (error) {
    throw new Error(
      `[pipelineStorage] Failed to write to localStorage for key "${key}". Storage may be full or access may be blocked. Original error: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export function readSavedPipelineDraft(): SavedPipelineDraft | null {
  const draft = readJson<SavedPipelineDraft>(pipelineDraftKey);

  if (!draft || !Array.isArray(draft.steps)) {
    return null;
  }

  const validSteps = (draft.steps as unknown[])
    .filter(isPipelineStepLike)
    .map((step) => {
      const raw = step as unknown as { parameters?: unknown };
      return { ...step, parameters: sanitizeParameters(raw.parameters) as unknown as typeof step.parameters };
    });
  return {
    ...draft,
    steps: toPipelineTemplates(clonePipelineTemplates(validSteps)),
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

  return presets
    .filter((preset) => isObject(preset) && Array.isArray(preset.steps))
    .map((preset) => ({
      ...(preset as PipelinePreset),
      steps: (preset as { steps: unknown[] }).steps
        .filter(isPipelineStepLike)
        .map((step) => {
          const raw = step as unknown as { parameters?: unknown };
          return { ...step, parameters: sanitizeParameters(raw.parameters) as unknown as typeof step.parameters };
        }),
    }));
}

export function savePipelinePreset(preset: PipelinePreset): PipelinePreset[] {
  if (preset.id.startsWith('builtin-')) {
    throw new Error('組み込みプリセットIDは保存済みプリセットとして使用できません。');
  }

  const savedPreset = {
    ...preset,
    builtIn: false,
    steps: toPipelineTemplates(clonePipelineTemplates(preset.steps)),
  };

  const currentPresets = readSavedPipelinePresets();
  const existingIndex = currentPresets.findIndex((item) => item.id === preset.id);

  const nextPresets =
    existingIndex === -1
      ? [...currentPresets, savedPreset]
      : currentPresets.map((item) => (item.id === preset.id ? savedPreset : item));

  writeJson(pipelinePresetsKey, nextPresets);
  return nextPresets;
}

export function deletePipelinePreset(presetId: string): PipelinePreset[] {
  const nextPresets = readSavedPipelinePresets().filter((preset) => preset.id !== presetId);
  writeJson(pipelinePresetsKey, nextPresets);
  return nextPresets;
}
