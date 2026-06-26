import * as THREE from 'three';

import { composeFramedFace } from './face-frame.js';
import { TORCH_TEXTURE_SIZE } from './gallery-texture-sizes.js';

const GRID = 24;

/**
 * Paint procedural SVG inner markup (24×24 rects) straight to canvas — no Image/blob URL.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} innerMarkup
 * @param {{ x: number, y: number, w: number, h: number }} rect
 */
export function rasterizeSvgInnerMarkup(ctx, innerMarkup, rect) {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}">${innerMarkup}</svg>`,
    'image/svg+xml',
  );

  const scaleX = rect.w / GRID;
  const scaleY = rect.h / GRID;

  doc.querySelectorAll('rect').forEach((node) => {
    const fill = node.getAttribute('fill');
    if (!fill || fill === 'none') return;

    const x = Number(node.getAttribute('x') ?? 0);
    const y = Number(node.getAttribute('y') ?? 0);
    const w = Number(node.getAttribute('width') ?? 0);
    const h = Number(node.getAttribute('height') ?? 0);

    ctx.fillStyle = fill;
    ctx.fillRect(rect.x + x * scaleX, rect.y + y * scaleY, w * scaleX, h * scaleY);
  });
}

/**
 * @param {string} innerMarkup
 * @returns {THREE.CanvasTexture}
 */
export function svgInnerToTexture(innerMarkup) {
  const size = TORCH_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  composeFramedFace(ctx, size, (faceCtx, rect) => {
    rasterizeSvgInnerMarkup(faceCtx, innerMarkup, rect);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * @typedef {{ hashId: string, svg: string }} TorchArtEntry
 * @param {TorchArtEntry[]} entries
 * @param {(loaded: number, total: number) => void} [onProgress]
 * @returns {Map<string, THREE.CanvasTexture>}
 */
export function buildTorchTextureCache(entries, onProgress) {
  const cache = new Map();
  const total = entries.length;

  for (let i = 0; i < total; i += 1) {
    const entry = entries[i];
    const texture = svgInnerToTexture(entry.svg);
    texture.userData.hashId = entry.hashId;
    cache.set(entry.hashId, texture);
    onProgress?.(i + 1, total);
  }

  return cache;
}

/**
 * @param {Map<string, THREE.CanvasTexture>} cache
 */
export function disposeTorchTextureCache(cache) {
  cache.forEach((texture) => texture.dispose());
  cache.clear();
}

export { TORCH_TEXTURE_SIZE } from './gallery-texture-sizes.js';
