import type { PipelinePreset } from '../types/image';
import { defaultParameterState } from './imageOperations';

export const builtInPipelinePresets: PipelinePreset[] = [
  {
    id: 'builtin-sns',
    name: 'SNS向け補正',
    description: '明るさとシャープで見栄えを整えます。',
    builtIn: true,
    steps: [
      {
        operation: 'brightness',
        parameters: {
          ...defaultParameterState,
          brightness: 25,
        },
      },
      {
        operation: 'sharpen',
        parameters: {
          ...defaultParameterState,
          sharpenStrength: 2,
        },
      },
    ],
  },
  {
    id: 'builtin-ocr',
    name: 'OCR前処理',
    description: '文字抽出しやすい状態に整えてから OCR をかけます。',
    builtIn: true,
    steps: [
      {
        operation: 'grayscale',
        parameters: { ...defaultParameterState },
      },
      {
        operation: 'brightness',
        parameters: {
          ...defaultParameterState,
          brightness: 30,
        },
      },
      {
        operation: 'sharpen',
        parameters: {
          ...defaultParameterState,
          sharpenStrength: 2,
        },
      },
      {
        operation: 'ocr',
        parameters: { ...defaultParameterState },
      },
    ],
  },
  {
    id: 'builtin-portrait',
    name: '人物写真補正',
    description: '明るさと軽い補正で顔まわりを見やすくします。',
    builtIn: true,
    steps: [
      {
        operation: 'brightness',
        parameters: {
          ...defaultParameterState,
          brightness: 15,
        },
      },
      {
        operation: 'blur',
        parameters: {
          ...defaultParameterState,
          blurStrength: 3,
        },
      },
      {
        operation: 'sharpen',
        parameters: {
          ...defaultParameterState,
          sharpenStrength: 2,
        },
      },
    ],
  },
  {
    id: 'builtin-product',
    name: '商品画像整形',
    description: '背景除去後に輪郭と明るさを整えます。',
    builtIn: true,
    steps: [
      {
        operation: 'background_removal',
        parameters: { ...defaultParameterState },
      },
      {
        operation: 'brightness',
        parameters: {
          ...defaultParameterState,
          brightness: 10,
        },
      },
      {
        operation: 'sharpen',
        parameters: {
          ...defaultParameterState,
          sharpenStrength: 2,
        },
      },
    ],
  },
];
