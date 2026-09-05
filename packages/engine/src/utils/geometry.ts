export const BASE_REFERENCE_DIMENSION = 1080;

export function getResolutionScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1.0;
  const baseDim = Math.min(width, height);
  return baseDim / BASE_REFERENCE_DIMENSION;
}

export function calculateSubtitleLayout(
  width: number,
  height: number,
  boxWidthSetting: number = 1400,
): { scale: number; maxWidth: number } {
  const scale = getResolutionScale(width, height);
  const targetBoxWidth = (boxWidthSetting || 1400) * scale;
  const maxAllowedWidth = width * 0.88;
  const maxWidth = Math.min(targetBoxWidth, maxAllowedWidth);

  return {
    scale,
    maxWidth,
  };
}
