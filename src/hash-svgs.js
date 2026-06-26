/** 24×24 on-chain Hash SVG inner markup (void + fluor palette). */
export const BASE_HASH_SVGS = [
  '<rect width="24" height="24" fill="#000"/><rect x="2" y="2" width="6" height="6" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="8" y="4" width="8" height="4" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="4" y="8" width="4" height="8" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="12" y="12" width="8" height="8" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="0" y="16" width="24" height="4" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="10" y="0" width="4" height="24" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="6" y="6" width="12" height="12" fill="none" stroke="#DFFF00" stroke-width="1"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="2" y="10" width="20" height="4" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="4" y="4" width="16" height="16" fill="#DFFF00" opacity="0.5"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="8" y="2" width="8" height="20" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="0" y="0" width="12" height="12" fill="#DFFF00"/><rect x="12" y="12" width="12" height="12" fill="#DFFF00"/>',
  '<rect width="24" height="24" fill="#000"/><rect x="6" y="6" width="4" height="4" fill="#DFFF00"/><rect x="14" y="14" width="4" height="4" fill="#DFFF00"/>',
];

const GRID = 24;
const FLUOR = '#DFFF00';

function seeded(seed) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} seed */
export function generateHashSvg(seed) {
  const rand = seeded(seed);
  const rects = [`<rect width="${GRID}" height="${GRID}" fill="#000"/>`];
  const blocks = 3 + Math.floor(rand() * 5);

  for (let i = 0; i < blocks; i += 1) {
    const w = 2 + Math.floor(rand() * 10);
    const h = 2 + Math.floor(rand() * 10);
    const x = Math.floor(rand() * (GRID - w));
    const y = Math.floor(rand() * (GRID - h));
    const hollow = rand() > 0.82;

    if (hollow) {
      rects.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${FLUOR}" stroke-width="1"/>`,
      );
    } else {
      const opacity = rand() > 0.7 ? ' opacity="0.55"' : '';
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FLUOR}"${opacity}/>`);
    }
  }

  return rects.join('');
}

/** @param {number} count */
export function getHashSvgCatalog(count) {
  const catalog = [...BASE_HASH_SVGS];

  for (let i = catalog.length; i < count; i += 1) {
    catalog.push(generateHashSvg(i * 97 + 13));
  }

  return catalog;
}

export const GALLERY_HASH_COUNT = 120;

export const HASH_SVGS = getHashSvgCatalog(GALLERY_HASH_COUNT);
