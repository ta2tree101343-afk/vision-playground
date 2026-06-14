export interface ChannelRange {
  min: number;
  max: number;
}

export interface ImageHistogram {
  red: number[];
  green: number[];
  blue: number[];
  luminance: number[];
  maxCount: number;
  range: {
    red: ChannelRange;
    green: ChannelRange;
    blue: ChannelRange;
    luminance: ChannelRange;
  };
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
