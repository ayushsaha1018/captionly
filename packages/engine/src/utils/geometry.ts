export const BASE_REFERENCE_DIMENSION = 1080;
export const DEFAULT_BOX_WIDTH = 1800;
export const MAX_SUBTITLE_WIDTH_RATIO = 0.95;

export interface SubtitleLayout {
  scale: number;
  maxWidth: number;
}

export function getResolutionScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1.0;
  }
  const baseDim = Math.min(width, height);
  return baseDim / BASE_REFERENCE_DIMENSION;
}

export function calculateSubtitleLayout(
  width: number,
  height: number,
  boxWidthSetting: number = DEFAULT_BOX_WIDTH,
): SubtitleLayout {
  const scale = getResolutionScale(width, height);
  const targetBoxWidth = (boxWidthSetting || DEFAULT_BOX_WIDTH) * scale;
  const maxAllowedWidth = width * MAX_SUBTITLE_WIDTH_RATIO;
  const maxWidth = Math.min(targetBoxWidth, maxAllowedWidth);

  return {
    scale,
    maxWidth,
  };
}
