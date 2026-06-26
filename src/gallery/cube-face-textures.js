import * as THREE from 'three';

import {
  composeFramedFace,
  drawAluminumFaceBase,
  drawFacePanelBackdrop,
  drawImageInFaceRect,
  drawTorchFaceFrame,
  getFaceFrameMetrics,
} from './face-frame.js';

import { TORCH_TEXTURE_SIZE } from './gallery-texture-sizes.js';

/** Higher resolution than pixel-art NFT faces — keeps on-chain labels readable up close. */
import { ONCHAIN_TEXTURE_SIZE } from './gallery-texture-sizes.js';

export { ONCHAIN_TEXTURE_SIZE };

/** BoxGeometry groups: 0/+X, 1/-X, 2/+Y, 3/-Y, 4/+Z, 5/-Z */
export const FACE_NFT = [0, 1];
export const FACE_ONCHAIN = [2, 3];
export const FACE_LOGO = [4, 5];

const LOGO_URL = '/textures/torch-logo.png';
const IMAGE_LOAD_TIMEOUT_MS = 12_000;

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.src = '';
      reject(new Error(`Timed out loading image: ${url}`));
    }, IMAGE_LOAD_TIMEOUT_MS);

    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };

    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`Failed to load image: ${url}`));
    };

    image.src = url;
  });
}

/** Brushed aluminum PBR baseline — cool silver reads against the void background. */
const ALUMINUM = {
  color: 0xd6dce4,
  metalness: 0.91,
  roughness: 0.27,
};

/**
 * @param {THREE.Texture} map
 * @param {{ color?: number, metalness?: number, roughness?: number }} [opts]
 */
export function createMetallicFaceMaterial(map, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map,
    color: new THREE.Color(opts.color ?? ALUMINUM.color),
    metalness: opts.metalness ?? ALUMINUM.metalness,
    roughness: opts.roughness ?? ALUMINUM.roughness,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
  });
}

/**
 * @param {THREE.Texture} map
 * @param {{ emissive?: number, emissiveIntensity?: number }} [opts]
 * @deprecated Use createMetallicFaceMaterial — kept for compatibility.
 */
export function createFaceMaterial(map, opts = {}) {
  return createMetallicFaceMaterial(map, {
    roughness: opts.emissiveIntensity ? 0.24 : ALUMINUM.roughness,
  });
}

/**
 * @typedef {{ hashId: string, owner: string, yieldLabel: string }} OnchainEntry
 */

/**
 * @returns {Promise<THREE.Texture>}
 */
export async function loadLogoTexture() {
  const image = await loadImageElement(LOGO_URL);
  const size = TORCH_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  composeFramedFace(ctx, size, (faceCtx, rect) => {
    drawImageInFaceRect(faceCtx, image, rect, true);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * @param {THREE.Texture} map
 * @returns {THREE.MeshStandardMaterial}
 */
export function createOnchainFaceMaterial(map) {
  return createMetallicFaceMaterial(map, {
    color: 0xc8ced6,
    metalness: 0.88,
    roughness: 0.34,
  });
}

/**
 * @param {Map<string, THREE.CanvasTexture>} cache
 * @param {THREE.WebGLRenderer | THREE.WebGPURenderer} renderer
 */
export function tuneOnchainTextures(cache, renderer) {
  const getMaxAnisotropy = renderer?.capabilities?.getMaxAnisotropy;
  if (typeof getMaxAnisotropy !== 'function') return;

  const anisotropy = getMaxAnisotropy.call(renderer.capabilities);
  cache.forEach((texture) => {
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
  });
}

/**
 * @param {OnchainEntry} entry
 * @returns {THREE.CanvasTexture}
 */
export function createOnchainDataTexture(entry) {
  const size = ONCHAIN_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.textBaseline = 'top';

  const { pad } = getFaceFrameMetrics(size);

  drawAluminumFaceBase(ctx, size);
  drawFacePanelBackdrop(ctx, size);
  drawTorchFaceFrame(ctx, size);

  ctx.strokeStyle = 'rgba(255, 107, 0, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, pad + 72);
  ctx.lineTo(size - pad, pad + 72);
  ctx.stroke();

  let y = pad;

  ctx.font = 'bold 30px "Courier New", Consolas, monospace';
  ctx.fillStyle = '#ff6b00';
  ctx.fillText('> ON_CHAIN', pad, y);
  y += 40;

  ctx.font = 'bold 36px "Courier New", Consolas, monospace';
  ctx.fillStyle = '#ffb020';
  ctx.fillText(entry.hashId, pad, y);
  y += 56;

  const labelFont = 'bold 22px "Courier New", Consolas, monospace';
  const valueFont = '24px "Courier New", Consolas, monospace';

  ctx.font = labelFont;
  ctx.fillStyle = '#fff5eb';
  ctx.fillText('HOLDER', pad, y);
  y += 30;

  ctx.font = valueFont;
  ctx.fillStyle = '#ff8c42';
  ctx.fillText(truncateText(entry.owner, 22), pad, y);
  y += 44;

  ctx.font = labelFont;
  ctx.fillStyle = '#fff5eb';
  ctx.fillText('HOOK_FEES', pad, y);
  y += 30;

  ctx.font = valueFont;
  ctx.fillStyle = '#ffb020';
  const fees = entry.yieldLabel.replace(/\s*fees/i, ' ETH').toUpperCase();
  ctx.fillText(truncateText(fees, 20), pad, y);
  y += 44;

  ctx.font = labelFont;
  ctx.fillStyle = '#cc6633';
  ctx.fillText('TOKENURI', pad, y);
  y += 30;

  ctx.font = valueFont;
  ctx.fillStyle = '#ff4500';
  ctx.fillText('svg · 24×24', pad, y);

  ctx.strokeStyle = 'rgba(255, 69, 0, 0.2)';
  ctx.lineWidth = 1;
  for (let scanY = pad; scanY < size - pad; scanY += 4) {
    ctx.beginPath();
    ctx.moveTo(pad, scanY);
    ctx.lineTo(size - pad, scanY);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.userData.hashId = entry.hashId;
  return texture;
}

/**
 * @param {string} text
 * @param {number} maxLen
 */
function truncateText(text, maxLen) {
  const value = text.trim();
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

/**
 * @param {OnchainEntry[]} entries
 * @returns {Map<string, THREE.CanvasTexture>}
 */
export function buildOnchainTextureCache(entries) {
  const cache = new Map();
  entries.forEach((entry) => {
    cache.set(entry.hashId, createOnchainDataTexture(entry));
  });
  return cache;
}

/**
 * @param {THREE.Texture} logoMap
 * @returns {THREE.MeshStandardMaterial}
 */
export function createLogoFaceMaterial(logoMap) {
  const mat = createMetallicFaceMaterial(logoMap, {
    color: 0xdce2ea,
    metalness: 0.93,
    roughness: 0.22,
  });
  mat.userData.faceRole = 'logo';
  return mat;
}

/**
 * @param {THREE.Texture} nftMap
 * @param {THREE.Texture} onchainMap
 * @param {THREE.MeshStandardMaterial} logoMaterial
 * @returns {THREE.MeshStandardMaterial[]}
 */
export function buildCubeFaceMaterials(nftMap, onchainMap, logoMaterial) {
  const nftMat = createMetallicFaceMaterial(nftMap, {
    color: 0xd0d6de,
    metalness: 0.9,
    roughness: 0.26,
  });
  const onchainMat = createOnchainFaceMaterial(onchainMap);

  nftMat.userData.faceRole = 'nft';
  onchainMat.userData.faceRole = 'onchain';

  const materials = new Array(6);
  FACE_NFT.forEach((i) => { materials[i] = nftMat; });
  FACE_ONCHAIN.forEach((i) => { materials[i] = onchainMat; });
  FACE_LOGO.forEach((i) => { materials[i] = logoMaterial; });

  return materials;
}

const FACE_METAL = {
  nft: { metalness: 0.9, roughness: 0.26 },
  onchain: { metalness: 0.88, roughness: 0.34 },
  logo: { metalness: 0.93, roughness: 0.22 },
};

/**
 * @param {THREE.MeshStandardMaterial[]} materials
 * @param {boolean} selected
 */
export function setMaterialsHighlight(materials, selected) {
  materials.forEach((mat) => {
    const role = mat.userData.faceRole ?? 'nft';
    const base = FACE_METAL[role] ?? FACE_METAL.nft;

    mat.metalness = base.metalness;
    mat.roughness = selected ? base.roughness * 0.72 : base.roughness;
    mat.emissive.setHex(selected ? 0xff6b00 : 0x000000);
    mat.emissiveIntensity = selected ? 0.14 : 0;
  });
}

/**
 * @param {THREE.MeshStandardMaterial[]} materials
 */
export function disposeCubeMaterials(materials) {
  const seen = new Set();
  materials.forEach((mat) => {
    if (seen.has(mat)) return;
    seen.add(mat);
    mat.dispose();
  });
}

/**
 * @param {Map<string, THREE.CanvasTexture>} cache
 */
export function disposeOnchainTextureCache(cache) {
  cache.forEach((tex) => tex.dispose());
  cache.clear();
}
