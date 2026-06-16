import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PipelinePreset, SavedPipelineDraft } from '@entities/pipeline';
import { defaultParameterState } from '@entities/operation';
import { usePipeline } from '@features/pipeline-edit/model/usePipeline';

vi.mock('@features/pipeline-edit/lib/pipelineStorage', () => ({
  readSavedPipelineDraft: vi.fn(),
  savePipelineDraft: vi.fn(),
  readSavedPipelinePresets: vi.fn(),
  savePipelinePreset: vi.fn(),
  deletePipelinePreset: vi.fn(),
}));

let idSeq = 0;
vi.mock('@shared/lib/id', () => ({
  createId: vi.fn((prefix: string) => `${prefix}-${++idSeq}`),
}));

import {
  readSavedPipelineDraft,
  savePipelineDraft,
  readSavedPipelinePresets,
  savePipelinePreset,
  deletePipelinePreset,
} from '@features/pipeline-edit/lib/pipelineStorage';

const mockReadDraft = vi.mocked(readSavedPipelineDraft);
const mockSaveDraft = vi.mocked(savePipelineDraft);
const mockReadPresets = vi.mocked(readSavedPipelinePresets);
const mockSavePreset = vi.mocked(savePipelinePreset);
const mockDeletePreset = vi.mocked(deletePipelinePreset);

const PRESET: PipelinePreset = {
  id: 'preset-1',
  name: 'My Preset',
  description: '2 steps',
  steps: [
    { operation: 'grayscale', parameters: defaultParameterState },
    { operation: 'blur', parameters: defaultParameterState },
  ],
};

const DRAFT: SavedPipelineDraft = {
  steps: [{ operation: 'grayscale', parameters: defaultParameterState }],
  updatedAt: '2024-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  idSeq = 0;
  mockReadDraft.mockReturnValue(null);
  mockReadPresets.mockReturnValue([]);
});

describe('initial state', () => {
  it('starts with empty steps when no draft is saved', () => {
    const { result } = renderHook(() => usePipeline());
    expect(result.current.steps).toHaveLength(0);
  });

  it('starts with no errorMessage', () => {
    const { result } = renderHook(() => usePipeline());
    expect(result.current.errorMessage).toBeNull();
  });

  it('loads steps from saved draft on mount', () => {
    mockReadDraft.mockReturnValue(DRAFT);
    const { result } = renderHook(() => usePipeline());
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].operation).toBe('grayscale');
  });

  it('sets savedDraftAt from the stored draft', () => {
    mockReadDraft.mockReturnValue(DRAFT);
    const { result } = renderHook(() => usePipeline());
    expect(result.current.savedDraftAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('sets errorMessage when draft read throws', () => {
    mockReadDraft.mockImplementation(() => { throw new Error('storage error'); });
    const { result } = renderHook(() => usePipeline());
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('loads presets on mount', () => {
    mockReadPresets.mockReturnValue([PRESET]);
    const { result } = renderHook(() => usePipeline());
    expect(result.current.savedPresets).toHaveLength(1);
  });
});

describe('addStep', () => {
  it('adds a step to the list', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].operation).toBe('grayscale');
  });

  it('clears errorMessage', () => {
    mockReadDraft.mockImplementation(() => { throw new Error('err'); });
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('blur'); });
    expect(result.current.errorMessage).toBeNull();
  });

  it('accumulates multiple steps', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.addStep('blur'); });
    expect(result.current.steps).toHaveLength(2);
  });
});

describe('removeStep', () => {
  it('removes the step with the matching id', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    const id = result.current.steps[0].id;
    act(() => { result.current.removeStep(id); });
    expect(result.current.steps).toHaveLength(0);
  });

  it('leaves other steps untouched', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.addStep('blur'); });
    const firstId = result.current.steps[0].id;
    act(() => { result.current.removeStep(firstId); });
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].operation).toBe('blur');
  });
});

describe('reorderSteps', () => {
  it('moves step from fromIndex to toIndex', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.addStep('blur'); });
    act(() => { result.current.addStep('sharpen'); });
    act(() => { result.current.reorderSteps(0, 2); });
    expect(result.current.steps[0].operation).toBe('blur');
    expect(result.current.steps[2].operation).toBe('grayscale');
  });

  it('does not change steps when fromIndex equals toIndex', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.addStep('blur'); });
    const before = result.current.steps.map((step) => step.operation);
    act(() => { result.current.reorderSteps(0, 0); });
    expect(result.current.steps.map((step) => step.operation)).toEqual(before);
  });
});

describe('updateStepParameter', () => {
  it('updates the specified parameter on the step', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('blur'); });
    const id = result.current.steps[0].id;
    act(() => { result.current.updateStepParameter(id, 'blurStrength', 11); });
    expect(result.current.steps[0].parameters.blurStrength).toBe(11);
  });

  it('does not modify other steps', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('blur'); });
    act(() => { result.current.addStep('grayscale'); });
    const firstId = result.current.steps[0].id;
    const secondBefore = result.current.steps[1].parameters.brightness;
    act(() => { result.current.updateStepParameter(firstId, 'blurStrength', 9); });
    expect(result.current.steps[1].parameters.brightness).toBe(secondBefore);
  });
});

describe('applyPreset', () => {
  it('replaces steps with preset steps', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.applyPreset(PRESET); });
    expect(result.current.steps).toHaveLength(2);
    expect(result.current.steps[0].operation).toBe('grayscale');
  });

  it('sets presetName to the preset name', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.applyPreset(PRESET); });
    expect(result.current.presetName).toBe('My Preset');
  });

  it('sets activePresetId to the preset id', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.applyPreset(PRESET); });
    expect(result.current.activePresetId).toBe('preset-1');
  });
});

describe('saveDraft', () => {
  it('sets errorMessage when steps are empty', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.saveDraft(); });
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('calls savePipelineDraft with current steps', () => {
    mockSaveDraft.mockReturnValue({ steps: [], updatedAt: '2024-06-01T00:00:00.000Z' });
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.saveDraft(); });
    expect(mockSaveDraft).toHaveBeenCalledOnce();
  });

  it('updates savedDraftAt on success', () => {
    mockSaveDraft.mockReturnValue({ steps: [], updatedAt: '2024-06-01T00:00:00.000Z' });
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.saveDraft(); });
    expect(result.current.savedDraftAt).toBe('2024-06-01T00:00:00.000Z');
  });

  it('sets errorMessage when savePipelineDraft throws', () => {
    mockSaveDraft.mockImplementation(() => { throw new Error('quota exceeded'); });
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.saveDraft(); });
    expect(result.current.errorMessage).toBeTruthy();
  });
});

describe('loadDraft', () => {
  it('sets errorMessage when no draft exists', () => {
    mockReadDraft.mockReturnValue(null);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.loadDraft(); });
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('replaces steps with the saved draft steps', () => {
    mockReadDraft.mockReturnValue(null);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('blur'); });
    mockReadDraft.mockReturnValue(DRAFT);
    act(() => { result.current.loadDraft(); });
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].operation).toBe('grayscale');
  });

  it('sets errorMessage when readSavedPipelineDraft throws', () => {
    mockReadDraft
      .mockReturnValueOnce(null)
      .mockImplementation(() => { throw new Error('storage error'); });
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.loadDraft(); });
    expect(result.current.errorMessage).toBeTruthy();
  });
});

describe('savePreset', () => {
  it('sets errorMessage when presetName is empty', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.savePreset(); });
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('sets errorMessage when steps are empty', () => {
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.setPresetName('My Preset'); });
    act(() => { result.current.savePreset(); });
    expect(result.current.errorMessage).toBeTruthy();
  });

  it('calls savePipelinePreset with a preset object', () => {
    mockSavePreset.mockReturnValue([]);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.setPresetName('My Preset'); });
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.savePreset(); });
    expect(mockSavePreset).toHaveBeenCalledOnce();
    const [saved] = mockSavePreset.mock.calls[0];
    expect(saved.name).toBe('My Preset');
  });

  it('clears presetName after saving', () => {
    mockSavePreset.mockReturnValue([]);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.setPresetName('My Preset'); });
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.savePreset(); });
    expect(result.current.presetName).toBe('');
  });

  it('updates savedPresets with the returned list', () => {
    mockSavePreset.mockReturnValue([PRESET]);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.setPresetName('My Preset'); });
    act(() => { result.current.addStep('grayscale'); });
    act(() => { result.current.savePreset(); });
    expect(result.current.savedPresets).toHaveLength(1);
  });
});

describe('deletePreset', () => {
  it('calls deletePipelinePreset with the preset id', () => {
    mockDeletePreset.mockReturnValue([]);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.deletePreset('preset-1'); });
    expect(mockDeletePreset).toHaveBeenCalledWith('preset-1');
  });

  it('updates savedPresets with the returned list', () => {
    mockReadPresets.mockReturnValue([PRESET]);
    mockDeletePreset.mockReturnValue([]);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.deletePreset('preset-1'); });
    expect(result.current.savedPresets).toHaveLength(0);
  });

  it('clears activePresetId when the deleted preset was active', () => {
    mockDeletePreset.mockReturnValue([]);
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.applyPreset(PRESET); });
    act(() => { result.current.deletePreset('preset-1'); });
    expect(result.current.activePresetId).toBeNull();
  });

  it('sets errorMessage when deletePipelinePreset throws', () => {
    mockDeletePreset.mockImplementation(() => { throw new Error('error'); });
    const { result } = renderHook(() => usePipeline());
    act(() => { result.current.deletePreset('preset-1'); });
    expect(result.current.errorMessage).toBeTruthy();
  });
});
