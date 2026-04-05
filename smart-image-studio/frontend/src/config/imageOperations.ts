import type { ImageOperationType } from '../types/api';
import type { OperationOption, ParameterState } from '../types/image';

export const defaultParameterState: ParameterState = {
  blurStrength: 5,
  brightness: 20,
  contrast: 20,
  sharpenStrength: 1,
  denoiseStrength: 8,
  detectionThreshold: 45,
};

export const operationLabels: Record<ImageOperationType, string> = {
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

export const operationOptions: OperationOption[] = [
  {
    value: 'grayscale',
    label: operationLabels.grayscale,
    description: '色を落としてモノクロにします。',
    icon: 'GS',
    parameters: [],
  },
  {
    value: 'blur',
    label: operationLabels.blur,
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
    ],
  },
  {
    value: 'sharpen',
    label: operationLabels.sharpen,
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
    description: '輪郭だけを抽出します。',
    icon: 'ED',
    parameters: [],
  },
  {
    value: 'brightness',
    label: operationLabels.brightness,
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
    description: '背景を透過して前景を切り出します。',
    icon: 'BG',
    parameters: [],
  },
  {
    value: 'ocr',
    label: operationLabels.ocr,
    description: '画像内の文字を読み取ります。',
    icon: 'OC',
    parameters: [],
  },
  {
    value: 'object_detection',
    label: operationLabels.object_detection,
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
    description: '画像内容の説明候補を生成します。',
    icon: 'CP',
    parameters: [],
  },
];

export function getOperationOption(operation: ImageOperationType): OperationOption {
  return operationOptions.find((option) => option.value === operation) ?? operationOptions[0];
}
