/** Frame proportions matched to the on-chain face layout at 512px. */
const FRAME_REF_SIZE = 512;
const FRAME_PAD = 28;
const FRAME_BORDER = 4;

/**
 * @param {number} size
 */
export function getFaceFrameMetrics(size) {
  const scale = size / FRAME_REF_SIZE;
  const pad = Math.max(4, Math.round(FRAME_PAD * scale));
  const borderWidth = Math.max(1, Math.round(FRAME_BORDER * scale));
  const inset = pad / 2;
  const inner = size - pad;

  return { pad, borderWidth, inset, inner };
}

/**
 * Brushed aluminum base — shared by every cube face.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 */
export function drawAluminumFaceBase(ctx, size) {
  const brush = ctx.createLinearGradient(0, 0, size, size);
  brush.addColorStop(0, '#6e7680');
  brush.addColorStop(0.45, '#a8b0b8');
  brush.addColorStop(1, '#5c646c');
  ctx.fillStyle = brush;
  ctx.fillRect(0, 0, size, size);

  const step = Math.max(2, Math.round(size / 128));
  for (let lineY = 0; lineY < size; lineY += step) {
    ctx.strokeStyle = lineY % (step * 2) === 0 ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(size, lineY);
    ctx.stroke();
  }
}

/**
 * Dark inset panel inside the aluminum frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 */
export function drawFacePanelBackdrop(ctx, size) {
  const { inset, inner } = getFaceFrameMetrics(size);
  ctx.fillStyle = 'rgba(8, 4, 2, 0.78)';
  ctx.fillRect(inset, inset, inner, inner);
}

/**
 * Orange torch border — same stroke as the on-chain faces.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 */
export function drawTorchFaceFrame(ctx, size) {
  const { borderWidth, inset, inner } = getFaceFrameMetrics(size);
  ctx.strokeStyle = '#ff6b00';
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(inset, inset, inner, inner);
}

/**
 * Content area inside the frame border.
 * @param {number} size
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function getFaceContentRect(size) {
  const { pad, inset, inner } = getFaceFrameMetrics(size);
  const contentPad = Math.max(2, Math.round(pad * 0.55));

  return {
    x: inset + contentPad,
    y: inset + contentPad,
    w: inner - contentPad * 2,
    h: inner - contentPad * 2,
  };
}

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} FaceContentRect
 * @typedef {(ctx: CanvasRenderingContext2D, rect: FaceContentRect) => void} FaceContentDrawer
 */

/**
 * Standard face composition: aluminum → dark panel → content → orange frame.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} size
 * @param {FaceContentDrawer} drawContent
 */
export function composeFramedFace(ctx, size, drawContent) {
  drawAluminumFaceBase(ctx, size);
  drawFacePanelBackdrop(ctx, size);
  drawContent(ctx, getFaceContentRect(size));
  drawTorchFaceFrame(ctx, size);
}

/**
 * Draw an image centred and letterboxed inside a content rect.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} image
 * @param {FaceContentRect} rect
 * @param {boolean} [pixelated]
 */
export function drawImageInFaceRect(ctx, image, rect, pixelated = true) {
  const sourceW = 'width' in image ? image.width : rect.w;
  const sourceH = 'height' in image ? image.height : rect.h;
  const scale = Math.min(rect.w / sourceW, rect.h / sourceH);
  const w = sourceW * scale;
  const h = sourceH * scale;
  const x = rect.x + (rect.w - w) / 2;
  const y = rect.y + (rect.h - h) / 2;

  ctx.imageSmoothingEnabled = !pixelated;
  ctx.drawImage(image, x, y, w, h);
}
