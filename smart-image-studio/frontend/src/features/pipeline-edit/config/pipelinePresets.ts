import { asUIThreshold, type PipelinePreset } from '@entities/pipeline';
import { defaultParameterState } from '@entities/operation';

function parameters(overrides: Partial<typeof defaultParameterState> = {}) {
  return { ...defaultParameterState, ...overrides };
}

export const builtInPipelinePresets = [
  {
    id: 'builtin-sns',
    name: 'SNS向け補正',
    description: '明るさとシャープで見栄えを整えます。',
    builtIn: true,
    steps: [
      { operation: 'brightness', parameters: parameters({ brightness: 25 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 2 }) },
    ],
  },
  {
    id: 'builtin-ocr',
    name: 'OCR前処理',
    description: '文字抽出しやすい状態に整えてから OCR をかけます。',
    builtIn: true,
    steps: [
      { operation: 'brightness', parameters: parameters({ brightness: 30 }) },
      { operation: 'contrast', parameters: parameters({ contrast: 30 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 2 }) },
      { operation: 'ocr', parameters: parameters() },
    ],
  },
  {
    id: 'builtin-portrait',
    name: '人物写真補正',
    description: '明るさを整え、軽いぼかしとシャープで顔まわりを見やすくします。',
    builtIn: true,
    steps: [
      { operation: 'brightness', parameters: parameters({ brightness: 15 }) },
      { operation: 'blur', parameters: parameters({ blurStrength: 3 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 2 }) },
    ],
  },
  {
    id: 'builtin-product',
    name: '商品画像整形',
    description: '背景除去後に輪郭と明るさを整えます。',
    builtIn: true,
    steps: [
      { operation: 'background_removal', parameters: parameters() },
      { operation: 'brightness', parameters: parameters({ brightness: 10 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 2 }) },
    ],
  },
  {
    id: 'builtin-denoise',
    name: 'ノイズ除去',
    description: 'ノイズを取り除いてからシャープをかけ、細部を引き立てます。',
    builtIn: true,
    steps: [
      { operation: 'denoise', parameters: parameters({ denoiseStrength: 10 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 2 }) },
    ],
  },
  {
    id: 'builtin-scan',
    name: 'スキャン文書整形',
    description: '明るさ・コントラスト・ノイズ除去・シャープで読み取りやすい文書画像に整えます。',
    builtIn: true,
    steps: [
      { operation: 'brightness', parameters: parameters({ brightness: 20 }) },
      { operation: 'contrast', parameters: parameters({ contrast: 40 }) },
      { operation: 'denoise', parameters: parameters({ denoiseStrength: 5 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 3 }) },
    ],
  },
  {
    id: 'builtin-grayscale',
    name: 'モノクロ変換',
    description: 'グレースケール変換後にコントラストとシャープで締まりを出します。',
    builtIn: true,
    steps: [
      { operation: 'grayscale', parameters: parameters() },
      { operation: 'contrast', parameters: parameters({ contrast: 20 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 2 }) },
    ],
  },
  {
    id: 'builtin-detect',
    name: '物体検出',
    description: '画像内の物体を検出してバウンディングボックスを描画します。',
    builtIn: true,
    steps: [
      {
        operation: 'object_detection',
        parameters: parameters({ detectionThreshold: asUIThreshold(45) }),
      },
    ],
  },
  {
    id: 'builtin-caption',
    name: 'AIキャプション生成',
    description: 'AIが画像の内容を読み取りキャプションを生成します。',
    builtIn: true,
    steps: [{ operation: 'caption_generation', parameters: parameters() }],
  },
  {
    id: 'builtin-full-analysis',
    name: 'フル解析',
    description: 'OCR・物体検出・キャプション生成を一括実行します。',
    builtIn: true,
    steps: [
      { operation: 'ocr', parameters: parameters() },
      {
        operation: 'object_detection',
        parameters: parameters({ detectionThreshold: asUIThreshold(45) }),
      },
      { operation: 'caption_generation', parameters: parameters() },
    ],
  },
  {
    id: 'builtin-lowlight',
    name: '暗所補正',
    description: '暗い写真を明るくし、ノイズ除去とコントラスト・シャープで仕上げます。',
    builtIn: true,
    steps: [
      { operation: 'brightness', parameters: parameters({ brightness: 40 }) },
      { operation: 'denoise', parameters: parameters({ denoiseStrength: 15 }) },
      { operation: 'contrast', parameters: parameters({ contrast: 10 }) },
      { operation: 'sharpen', parameters: parameters({ sharpenStrength: 2 }) },
    ],
  },
] satisfies PipelinePreset[];
