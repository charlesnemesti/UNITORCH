/** 24×24 procedural flame pixel-art SVGs (UniTorch palette). */

export const GRID = 24;
export const GALLERY_HASH_COUNT = 120;

const VOID = '#080402';
const SMOKE = '#1a0500';
const COAL = '#3d1200';
const DEEP = '#cc3300';
const FLAME = '#FF4500';
const EMBER = '#FF6B00';
const HEAT = '#FFB020';
const CORE = '#FFE8A8';

const PALETTE = [VOID, SMOKE, COAL, DEEP, FLAME, EMBER, HEAT, CORE];

/** @param {number} index 1-based pattern index */
export function seedForPattern(index) {
  return index * 97 + 13;
}

function seeded(seed) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} x @param {number} y @param {number} seed */
function hashNoise(x, y, seed) {
  let t = Math.imul(seed ^ x * 374761393 ^ y * 668265263, 0x27d4eb2d);
  t ^= t >>> 15;
  t = Math.imul(t, 0x85ebca6b);
  t ^= t >>> 13;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** @param {number} value 0..1 */
function intensityToColor(value) {
  if (value <= 0.04) return null;
  const idx = Math.min(PALETTE.length - 1, Math.floor(value * (PALETTE.length - 1)));
  return PALETTE[idx];
}

/**
 * @param {number} seed
 * @returns {(string | null)[][]}
 */
export function generateFlamePixelGrid(seed) {
  const rand = seeded(seed);
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(null));

  const style = Math.floor(rand() * 6);
  const baseX = 6 + Math.floor(rand() * 12);
  const baseWidth = 2 + Math.floor(rand() * 5);
  const maxHeight = 10 + Math.floor(rand() * 12);
  const lean = (rand() - 0.5) * 2.4;
  const turbulence = 0.35 + rand() * 0.45;
  const twinOffset = 3 + Math.floor(rand() * 5);
  const flickerStrength = 0.12 + rand() * 0.2;
  const sparkChance = 0.012 + rand() * 0.02;

  for (let y = 0; y < GRID; y += 1) {
    const height = GRID - 1 - y;

    for (let x = 0; x < GRID; x += 1) {
      const n = hashNoise(x, y, seed);
      const n2 = hashNoise(x + 17, y * 3 + 5, seed + 41);
      let intensity = 0;

      if (style === 0) {
        intensity = torchFlame(x, height, baseX, baseWidth, maxHeight, lean, n, n2, turbulence);
      } else if (style === 1) {
        intensity = bonfireFlame(x, height, baseX, baseWidth + 3, maxHeight - 2, lean, n, n2, turbulence);
      } else if (style === 2) {
        const left = torchFlame(x, height, baseX - twinOffset, baseWidth - 1, maxHeight - 3, lean * 0.7, n, n2, turbulence);
        const right = torchFlame(x, height, baseX + twinOffset, baseWidth - 1, maxHeight - 1, lean * 0.7, n2, n, turbulence);
        intensity = Math.max(left, right * 0.95);
      } else if (style === 3) {
        intensity = emberBedFlame(x, height, baseX, baseWidth + 4, maxHeight - 6, n, n2, turbulence, seed);
      } else if (style === 4) {
        intensity = jetFlame(x, height, baseX, baseWidth - 1, maxHeight + 2, lean * 1.6, n, n2, turbulence);
      } else {
        intensity = ringFlame(x, height, baseX, baseWidth, maxHeight - 4, n, n2, turbulence);
      }

      if (height > maxHeight * 0.35 && hashNoise(x, y, seed + 777) < sparkChance) {
        intensity = Math.max(intensity, 0.55 + hashNoise(x + 3, y + 9, seed + 888) * 0.35);
      }

      intensity += (n - 0.5) * flickerStrength;
      intensity = Math.max(0, Math.min(1, intensity));

      const color = intensityToColor(intensity);
      if (color && color !== VOID) {
        grid[y][x] = color;
      }
    }
  }

  return grid;
}

function torchFlame(x, height, baseX, baseWidth, maxHeight, lean, n, n2, turbulence) {
  if (height > maxHeight) return 0;

  const hr = height / maxHeight;
  const cx = baseX + lean * height * 0.1;
  const width = Math.max(1.2, baseWidth * (1 - hr * 0.82) + (n2 - 0.5) * turbulence * 2);
  const dist = Math.abs(x - cx);
  if (dist > width) return 0;

  let heat = (1 - hr) * (1 - dist / (width + 0.5));
  heat += (n - 0.5) * 0.18;
  if (dist < width * 0.35) heat += 0.22 * (1 - hr * 0.5);
  if (height < 2) heat = Math.min(1, heat + 0.35);

  return heat;
}

function bonfireFlame(x, height, baseX, baseWidth, maxHeight, lean, n, n2, turbulence) {
  if (height > maxHeight) return 0;

  const hr = height / maxHeight;
  const cx = baseX + lean * height * 0.06 + Math.sin(height * 0.55) * 0.8;
  const width = Math.max(2, baseWidth * (1 - hr * 0.55) + (n2 - 0.5) * turbulence * 3);
  const dist = Math.abs(x - cx);
  if (dist > width) return 0;

  let heat = (1 - hr * 0.85) * (1 - dist / (width + 1));
  heat += (n - 0.5) * 0.22;
  if (dist < width * 0.4) heat += 0.18;

  return heat;
}

function emberBedFlame(x, height, baseX, baseWidth, maxHeight, n, n2, turbulence, seed) {
  if (height > maxHeight + 4) return 0;

  const emberCenters = 3 + Math.floor(turbulence * 4);
  let heat = 0;

  for (let i = 0; i < emberCenters; i += 1) {
    const offset = (i - (emberCenters - 1) / 2) * (baseWidth / emberCenters);
    const cx = baseX + offset + (n - 0.5) * 1.5;
    const localH = maxHeight * (0.45 + hashNoise(i, 0, baseX) * 0.55);
    if (height > localH) continue;

    const hr = height / localH;
    const width = 1.2 + (1 - hr) * 2.2 + n2 * turbulence;
    const dist = Math.abs(x - cx);
    if (dist <= width) {
      const spike = (1 - hr) * (1 - dist / (width + 0.4));
      heat = Math.max(heat, spike + (height < 2 ? 0.25 : 0));
    }
  }

  if (height <= 1 && Math.abs(x - baseX) < baseWidth) {
    heat = Math.max(heat, 0.35 + hashNoise(x, 1, seed + 333) * 0.15);
  }

  return heat;
}

function jetFlame(x, height, baseX, baseWidth, maxHeight, lean, n, n2, turbulence) {
  if (height > maxHeight) return 0;

  const hr = height / maxHeight;
  const cx = baseX + lean * height * 0.14;
  const width = Math.max(0.9, baseWidth * (1 - hr * 0.9) + (n2 - 0.5) * turbulence);
  const dist = Math.abs(x - cx);
  if (dist > width) return 0;

  let heat = (1 - hr * 1.05) * (1 - dist / (width + 0.35));
  heat += (n - 0.5) * 0.12;
  if (dist < width * 0.25) heat += 0.3 * (1 - hr);

  return heat;
}

function ringFlame(x, height, baseX, baseWidth, maxHeight, n, n2, turbulence) {
  if (height > maxHeight) return 0;

  const hr = height / maxHeight;
  const ringRadius = baseWidth + 1.5;
  const distFromCenter = Math.abs(x - baseX);
  const onRing = Math.abs(distFromCenter - ringRadius) < 1.2 + n * turbulence;

  if (!onRing && height > 2) return 0;

  let heat = onRing ? (1 - hr) * (0.75 + n2 * 0.25) : 0;
  if (height <= 2 && distFromCenter < baseWidth) {
    heat = Math.max(heat, 0.3 + n * 0.2);
  }
  if (distFromCenter < 1.2 && height < maxHeight * 0.5) {
    heat *= 0.35;
  }

  return heat;
}

/**
 * @param {(string | null)[][]} grid
 * @returns {string}
 */
export function flameGridToSvg(grid) {
  const parts = [`<rect width="${GRID}" height="${GRID}" fill="${VOID}"/>`];

  for (let y = 0; y < GRID; y += 1) {
    let x = 0;
    while (x < GRID) {
      const color = grid[y][x];
      if (!color) {
        x += 1;
        continue;
      }

      let w = 1;
      while (x + w < GRID && grid[y][x + w] === color) w += 1;
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${color}"/>`);
      x += w;
    }
  }

  return parts.join('');
}

/** @param {number} seed */
export function generateHashSvg(seed) {
  return flameGridToSvg(generateFlamePixelGrid(seed));
}

/** @param {number} count */
export function getHashSvgCatalog(count) {
  return Array.from({ length: count }, (_, index) => generateHashSvg(seedForPattern(index + 1)));
}

/** @deprecated Use getHashSvgCatalog — kept for imports that expect a fixed base set. */
export const BASE_HASH_SVGS = getHashSvgCatalog(12);

export const HASH_SVGS = getHashSvgCatalog(GALLERY_HASH_COUNT);
