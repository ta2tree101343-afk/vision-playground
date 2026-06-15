import type { OperationType } from '@shared/types/api';
import type { OperationOption } from '@entities/operation/model/operation.types';
import { asUIThreshold, type ParameterKey, type ParameterState } from '@entities/pipeline';

export const defaultParameterState: ParameterState = {
  blurStrength: 5,
  blurSigma: 0,
  brightness: 20,
  contrast: 20,
  sharpenStrength: 1,
  denoiseStrength: 8,
  detectionThreshold: asUIThreshold(45),
};

type ParameterConstraint = {
  min: number;
  max: number;
  integer: boolean;
  odd?: true;
};

export const parameterConstraints: Record<ParameterKey, ParameterConstraint> = {
  blurStrength:       { min: 1,    max: 25,  integer: true, odd: true },
  blurSigma:          { min: 0,    max: 10,  integer: false },
  brightness:         { min: -100, max: 100, integer: false },
  contrast:           { min: -100, max: 100, integer: false },
  sharpenStrength:    { min: 1,    max: 5,   integer: true },
  denoiseStrength:    { min: 1,    max: 30,  integer: true },
  detectionThreshold: { min: 10,   max: 95,  integer: true },
};

export function sanitizeParameter(key: ParameterKey, value: unknown): number {
  const { min, max, integer, odd } = parameterConstraints[key];
  const def = defaultParameterState[key];
  if (typeof value !== 'number' || !isFinite(value)) return def;
  if (value < min || value > max) return def;
  if (integer && !Number.isInteger(value)) return def;
  if (odd && value % 2 === 0) {
    const snapped = value + 1;
    return snapped <= max ? snapped : def;
  }
  return value;
}

export const operationLabels: Record<OperationType, string> = {
  grayscale: 'Grayscale',
  blur: 'Blur',
  sharpen: 'Sharpen',
  denoise: 'Denoise',
  edge_detection: 'Edge Detection',
  brightness: 'Brightness',
  contrast: 'Contrast',
  background_removal: 'Background Removal',
  ocr: 'OCR',
  object_detection: 'Object Detection',
  caption_generation: 'Caption Generation',
};

export const operationOptions = [
  {
    value: 'grayscale',
    label: operationLabels.grayscale,
    labelJa: 'モノクロ',
    isAiOp: false,
    description: '色を落としてモノクロにします。',
    icon: 'GS',
    parameters: [],
  },
  {
    value: 'blur',
    label: operationLabels.blur,
    labelJa: 'ぼかし',
    isAiOp: false,
    description: '全体をなめらかにぼかします。',
    icon: 'BL',
    parameters: [
      {
        key: 'blurStrength',
        label: 'Blur Strength',
        min: 1,
        max: 25,
        step: 2,
        helpText: 'ぼかしの強さを調整します。',
      },
      {
        key: 'blurSigma',
        label: 'Blur Sigma',
        min: 0,
        max: 10,
        step: 0.5,
        helpText: '0 で自動。大きいほどぼかしが滑らかになります。',
      },
    ],
  },
  {
    value: 'sharpen',
    label: operationLabels.sharpen,
    labelJa: 'シャープ',
    isAiOp: false,
    description: '輪郭を強調してくっきり見せます。',
    icon: 'SH',
    parameters: [
      {
        key: 'sharpenStrength',
        label: 'Sharpen Strength',
        min: 1,
        max: 5,
        step: 1,
        helpText: '上げすぎるとノイズも強まります。',
      },
    ],
  },
  {
    value: 'denoise',
    label: operationLabels.denoise,
    labelJa: 'ノイズ除去',
    isAiOp: false,
    description: 'ノイズを抑えてざらつきを減らします。',
    icon: 'DN',
    parameters: [
      {
        key: 'denoiseStrength',
        label: 'Denoise Strength',
        min: 1,
        max: 30,
        step: 1,
        helpText: '上げるほどノイズを強く除去します。',
      },
    ],
  },
  {
    value: 'edge_detection',
    label: operationLabels.edge_detection,
    labelJa: 'エッジ',
    isAiOp: false,
    description: '輪郭だけを抽出します。',
    icon: 'ED',
    parameters: [],
  },
  {
    value: 'brightness',
    label: operationLabels.brightness,
    labelJa: '明るさ',
    isAiOp: false,
    description: '明るさを調整します。',
    icon: 'BR',
    parameters: [
      {
        key: 'brightness',
        label: 'Brightness',
        min: -100,
        max: 100,
        step: 5,
        helpText: '0 が基準です。マイナスで暗く、プラスで明るくなります。',
      },
    ],
  },
  {
    value: 'contrast',
    label: operationLabels.contrast,
    labelJa: 'コントラスト',
    isAiOp: false,
    description: '明暗差を強めてメリハリを付けます。',
    icon: 'CT',
    parameters: [
      {
        key: 'contrast',
        label: 'Contrast',
        min: -100,
        max: 100,
        step: 5,
        helpText: '0 が基準です。マイナスで弱く、プラスで強くなります。',
      },
    ],
  },
  {
    value: 'background_removal',
    label: operationLabels.background_removal,
    labelJa: '背景除去',
    isAiOp: false,
    description: '背景を透過して前景を切り出します。',
    icon: 'BG',
    parameters: [],
  },
  {
    value: 'ocr',
    label: operationLabels.ocr,
    labelJa: 'OCR',
    isAiOp: true,
    description: '画像内の文字を読み取ります。',
    icon: 'OC',
    parameters: [],
  },
  {
    value: 'object_detection',
    label: operationLabels.object_detection,
    labelJa: '物体検出',
    isAiOp: true,
    description: '物体を検出して枠を表示します。',
    icon: 'DT',
    parameters: [
      {
        key: 'detectionThreshold',
        label: 'Detection Threshold',
        min: 10,
        max: 95,
        step: 5,
        helpText: '上げると低い信頼度の検出を除外します。',
      },
    ],
  },
  {
    value: 'caption_generation',
    label: operationLabels.caption_generation,
    labelJa: 'AIキャプション',
    isAiOp: true,
    description: '画像内容の説明候補を生成します。',
    icon: 'CP',
    parameters: [],
  },
] satisfies OperationOption[];

export const operationLabelsJa: Record<OperationType, string> = Object.fromEntries(
  operationOptions.map((o) => [o.value, o.labelJa]),
) as Record<OperationType, string>;

export const AI_OPS: Set<OperationType> = new Set(
  operationOptions.filter((o) => o.isAiOp).map((o) => o.value),
);

export const allOperationKeys: OperationType[] = operationOptions.map((o) => o.value);

const operationOptionMap = Object.fromEntries(
  operationOptions.map((option) => [option.value, option]),
) as Partial<Record<OperationType, OperationOption>>;

export function getOperationOption(operation: OperationType): OperationOption {
  const found = operationOptionMap[operation];
  if (!found) {
    throw new Error(
      `[getOperationOption] No entry found for operation: ${operation}. operationOptions is out of sync with OperationType.`,
    );
  }
  return found;
}
