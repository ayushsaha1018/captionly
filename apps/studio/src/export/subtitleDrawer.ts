import {
  calculateSubtitleLayout,
  type SubtitleExportData,
  type SubtitleLine,
  type Word,
} from "@captionly/engine";

export interface DrawSubtitlesParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  subtitles: SubtitleExportData;
  timeInSeconds: number;
  width: number;
  height: number;
}

export function drawSubtitlesOnCanvas({
  ctx,
  subtitles,
  timeInSeconds,
  width,
  height,
}: DrawSubtitlesParams): void {
  const { lines, style, position } = subtitles;

  const activeLine = lines.find((l) => timeInSeconds >= l.start && timeInSeconds <= l.end);

  if (!activeLine || !activeLine.words || activeLine.words.length === 0) {
    return;
  }

  const { scale, maxWidth } = calculateSubtitleLayout(width, height, style.boxWidth);
  const fontSize = Math.round(style.fontSize * scale);
  const fontWeight = style.fontWeight || 900;
  const fontFamily = style.fontFamily || "Inter, system-ui, sans-serif";

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";

  // Calculate layout of words
  const words = activeLine.words;
  const wordMetrics = words.map((w) => {
    const metrics = ctx.measureText(w.text);
    return {
      word: w,
      width: metrics.width,
    };
  });

  const spaceWidth = ctx.measureText(" ").width;
  const totalTextWidth =
    wordMetrics.reduce((acc, curr) => acc + curr.width, 0) + spaceWidth * (words.length - 1);

  // Subtitle anchor position
  const targetX = position.x <= 100 ? (position.x / 100) * width : (position.x / 1920) * width;
  const targetY = position.y <= 100 ? (position.y / 100) * height : (position.y / 1080) * height;

  const boxHeight = fontSize * 1.35;
  const padX = (style.bgPaddingX || 24) * scale;
  const padY = (style.bgPaddingY || 12) * scale;
  const bgRadius = (style.bgRadius || 16) * scale;

  const rawBoxWidth = totalTextWidth + padX * 2;
  const boxWidth = Math.min(rawBoxWidth, maxWidth);
  const totalBoxHeight = boxHeight + padY * 2;

  const boxLeft = targetX - boxWidth / 2;
  let boxTop = targetY - totalBoxHeight / 2;

  if (style.boxAnchor === "bottom") {
    boxTop = targetY - totalBoxHeight;
  } else if (style.boxAnchor === "top") {
    boxTop = targetY;
  }

  // Draw background pill
  if (style.bgOpacity > 0) {
    ctx.save();
    ctx.fillStyle = hexToRgba(style.bgColor || "#000000", style.bgOpacity);
    ctx.beginPath();
    ctx.roundRect(boxLeft, boxTop, boxWidth, totalBoxHeight, bgRadius);
    ctx.fill();
    ctx.restore();
  }

  // Draw words
  let currentX = boxLeft + padX;
  const textBaselineY = boxTop + padY + boxHeight / 2;

  for (const { word, width: wWidth } of wordMetrics) {
    const isActive = timeInSeconds >= word.start && timeInSeconds <= word.end;
    const isPast = timeInSeconds > word.end;

    const wordColor = isActive ? style.activeColor : isPast ? style.activeColor : style.color;

    ctx.save();

    // Active scale transform
    if (isActive && style.activeScale > 1) {
      const activeScale = style.activeScale;
      const centerX = currentX + wWidth / 2;
      const centerY = textBaselineY;
      ctx.translate(centerX, centerY);
      ctx.scale(activeScale, activeScale);
      ctx.translate(-centerX, -centerY);
    }

    // Shadow
    if (style.shadowBlur > 0) {
      ctx.shadowColor = isActive ? style.activeColor : "rgba(0,0,0,0.8)";
      ctx.shadowBlur = style.shadowBlur * scale;
    }

    // Stroke
    if (style.strokeWidth > 0) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth * scale * 2;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(word.text, currentX, textBaselineY);
    }

    // Fill
    ctx.fillStyle = wordColor;
    ctx.fillText(word.text, currentX, textBaselineY);

    ctx.restore();

    currentX += wWidth + spaceWidth;
  }

  ctx.restore();
}

function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace("#", "");
  let r = 0;
  let g = 0;
  let b = 0;

  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
