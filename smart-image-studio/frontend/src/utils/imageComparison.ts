export interface ImageHistogram {
  red: number[];
  green: number[];
  blue: number[];
  luminance: number[];
  maxCount: number;
}

export interface LoadedComparisonImage {
  src: string;
  width: number;
  height: number;
  histogram: ImageHistogram | null;
}

export interface ComparisonAssets {
  before: LoadedComparisonImage;
  after: LoadedComparisonImage;
  diffDataUrl: string | null;
  diagnostics: string | null;
}

const histogramSampleLimit = 512;
const diffSampleLimit = 1200;

function createImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('比較用画像の読み込みに失敗しました。'));
    image.src = src;
  });
}

function getScaledDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawImageToCanvas(
  image: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas を初期化できませんでした。');
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function computeHistogram(canvas: HTMLCanvasElement): ImageHistogram {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('ヒストグラム計算に失敗しました。');
  }

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const red = Array.from({ length: 256 }, () => 0);
  const green = Array.from({ length: 256 }, () => 0);
  const blue = Array.from({ length: 256 }, () => 0);
  const luminance = Array.from({ length: 256 }, () => 0);

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const alpha = data[index + 3] / 255;

    red[r] += alpha;
    green[g] += alpha;
    blue[b] += alpha;

    const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    luminance[luma] += alpha;
  }

  const maxCount = Math.max(
    1,
    ...red,
    ...green,
    ...blue,
    ...luminance,
  );

  return { red, green, blue, luminance, maxCount };
}

function loadHistogram(image: HTMLImageElement): ImageHistogram {
  const { width, height } = getScaledDimensions(
    image.naturalWidth,
    image.naturalHeight,
    histogramSampleLimit,
  );
  const canvas = drawImageToCanvas(image, width, height);
  return computeHistogram(canvas);
}

function createDiffDataUrl(before: HTMLImageElement, after: HTMLImageElement): string {
  const { width, height } = getScaledDimensions(
    before.naturalWidth,
    before.naturalHeight,
    diffSampleLimit,
  );
  const beforeCanvas = drawImageToCanvas(before, width, height);
  const afterCanvas = drawImageToCanvas(after, width, height);

  const beforeContext = beforeCanvas.getContext('2d');
  const afterContext = afterCanvas.getContext('2d');
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = width;
  diffCanvas.height = height;

  const diffContext = diffCanvas.getContext('2d');

  if (!beforeContext || !afterContext || !diffContext) {
    throw new Error('差分画像の生成に失敗しました。');
  }

  const beforePixels = beforeContext.getImageData(0, 0, width, height);
  const afterPixels = afterContext.getImageData(0, 0, width, height);
  const diffPixels = diffContext.createImageData(width, height);

  for (let index = 0; index < beforePixels.data.length; index += 4) {
    diffPixels.data[index] = Math.abs(beforePixels.data[index] - afterPixels.data[index]);
    diffPixels.data[index + 1] = Math.abs(
      beforePixels.data[index + 1] - afterPixels.data[index + 1],
    );
    diffPixels.data[index + 2] = Math.abs(
      beforePixels.data[index + 2] - afterPixels.data[index + 2],
    );
    diffPixels.data[index + 3] = 255;
  }

  diffContext.putImageData(diffPixels, 0, 0);
  return diffCanvas.toDataURL('image/png');
}

export async function loadComparisonAssets(
  beforeSrc: string,
  afterSrc: string,
): Promise<ComparisonAssets> {
  const [beforeImage, afterImage] = await Promise.all([
    createImageElement(beforeSrc),
    createImageElement(afterSrc),
  ]);

  let beforeHistogram: ImageHistogram | null = null;
  let afterHistogram: ImageHistogram | null = null;
  let diffDataUrl: string | null = null;
  let diagnostics: string | null = null;

  try {
    beforeHistogram = loadHistogram(beforeImage);
    afterHistogram = loadHistogram(afterImage);
    diffDataUrl = createDiffDataUrl(beforeImage, afterImage);
  } catch {
    diagnostics = '差分表示またはヒストグラム生成に失敗しました。';
  }

  return {
    before: {
      src: beforeSrc,
      width: beforeImage.naturalWidth,
      height: beforeImage.naturalHeight,
      histogram: beforeHistogram,
    },
    after: {
      src: afterSrc,
      width: afterImage.naturalWidth,
      height: afterImage.naturalHeight,
      histogram: afterHistogram,
    },
    diffDataUrl,
    diagnostics,
  };
}
