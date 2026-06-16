import { beforeEach, describe, expect, it } from 'vitest';
import { defaultParameterState } from '@entities/operation';
import { readSavedPipelineDraft, savePipelineDraft } from '@features/pipeline-edit/lib/pipelineStorage';

const DRAFT_KEY = 'smart-image-studio/pipeline-draft';

describe('savePipelineDraft / readSavedPipelineDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a draft through localStorage', () => {
    const steps = [{ id: 's1', operation: 'grayscale' as const, parameters: defaultParameterState }];
    savePipelineDraft(steps);
    const draft = readSavedPipelineDraft();
    expect(draft).not.toBeNull();
    expect(draft!.steps[0].operation).toBe('grayscale');
    expect(draft!.updatedAt).toBeTruthy();
  });

  it('returns null when storage is empty', () => {
    expect(readSavedPipelineDraft()).toBeNull();
  });

  it('clears and returns null for corrupt JSON', () => {
    localStorage.setItem(DRAFT_KEY, '{not valid json}');
    expect(readSavedPipelineDraft()).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('discards steps missing an operation field', () => {
    const corrupt = JSON.stringify({
      updatedAt: new Date().toISOString(),
      steps: [{ parameters: { blur_strength: 5 } }, { operation: 'grayscale' }],
    });
    localStorage.setItem(DRAFT_KEY, corrupt);
    const draft = readSavedPipelineDraft();
    expect(draft).not.toBeNull();
    expect(draft!.steps).toHaveLength(1);
    expect(draft!.steps[0].operation).toBe('grayscale');
  });

  it('strips non-numeric parameter values from untrusted data', () => {
    const corrupt = JSON.stringify({
      updatedAt: new Date().toISOString(),
      steps: [{ operation: 'blur', parameters: { blurStrength: 'injected', blurSigma: 3 } }],
    });
    localStorage.setItem(DRAFT_KEY, corrupt);
    const draft = readSavedPipelineDraft();
    expect(draft).not.toBeNull();
    // string value is stripped; numeric blurSigma survives and overrides the default
    expect(draft!.steps[0].parameters.blurSigma).toBe(3);
    expect(typeof draft!.steps[0].parameters.blurStrength).toBe('number');
  });
});
