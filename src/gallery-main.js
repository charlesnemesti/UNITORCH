import './gallery.css';

import { initCaStrip } from './ca-strip.js';
import { HASH_SVGS } from './hash-svgs.js';
import { HOLDER_THRESHOLD_LABEL } from './config/holder.js';
import { liveDataEnabled } from './config/launch.js';
import { loadProceduralTorchSamples, readTokenMetadata } from './web3/protocol.js';
import { GalleryCubeScene } from './gallery/gallery-cube-scene.js';
import {
  disposeGalleryFireBackground,
  initGalleryFireBackground,
} from './gallery/gallery-fire-bg.js';

const GALLERY_DISPLAY_CAP = 50;
const PATTERN_CYCLE_MS = 5000;
const SHAPE_STAGGER_MS = 130;

/**
 * @typedef {Object} GalleryEntry
 * @property {string} hashId
 * @property {string} owner
 * @property {string} yieldLabel
 * @property {string} svg
 */

/** @type {GalleryEntry[]} */
let galleryEntries = [];

/** @type {GalleryCubeScene | null} */
let cubeScene = null;

/** @type {number | null} */
let patternCycleId = null;

/** @type {number[]} */
let patternQueue = [];

/** @type {number} */
let patternSlot = 0;

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;

  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getHashPlaceholderMeta(catalogIndex) {
  const tokenId = catalogIndex + 1;
  const rand = seededRandom(tokenId * 7919 + 104729);
  const hexChar = () => Math.floor(rand() * 16).toString(16);

  let wallet = '0x';
  for (let i = 0; i < 40; i += 1) wallet += hexChar();

  const feeEth = (0.0008 + rand() * 0.048).toFixed(4);

  return {
    hashId: `#${String(tokenId).padStart(4, '0')}`,
    owner: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
    yieldLabel: `${feeEth} ETH fees`,
  };
}

function buildPlaceholderEntries() {
  return Array.from({ length: GALLERY_DISPLAY_CAP }, (_, index) => {
    const meta = getHashPlaceholderMeta(index);

    return {
      hashId: meta.hashId,
      owner: meta.owner,
      yieldLabel: meta.yieldLabel,
      svg: HASH_SVGS[index % HASH_SVGS.length],
    };
  });
}

function setGalleryLoader(visible, progress = 0, label = '') {
  const loader = document.getElementById('gallery-loader');
  const bar = document.getElementById('gallery-loader-bar');
  const text = document.getElementById('gallery-loader-text');

  if (!loader) return;

  loader.classList.toggle('is-hidden', !visible);
  loader.setAttribute('aria-hidden', visible ? 'false' : 'true');

  if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
  if (text && label) text.textContent = label;
}

function setIntroCopy() {
  const introCopy = document.getElementById('gallery-intro-copy');
  const introNote = document.getElementById('gallery-intro-note');
  const showcaseLabel = document.getElementById('gallery-showcase-label');

  if (introCopy) {
    introCopy.textContent = `Fly through ${GALLERY_DISPLAY_CAP} Torch NFT cubes — one procedural flame-pixel artwork per cube. Hold ${HOLDER_THRESHOLD_LABEL} UNITORCH to claim yours.`;
  }

  if (introNote) {
    introNote.textContent = 'Each cube: NFT (×2) · on-chain data (×2) · UniTorch logo (×2). Click to inspect.';
    introNote.hidden = false;
  }

  if (showcaseLabel) showcaseLabel.textContent = 'Selected Torch NFT';

  const yieldLabel = document.querySelector(
    '#gallery-showcase-details .gallery-showcase-detail:last-child dt',
  );
  if (yieldLabel) yieldLabel.textContent = 'Hook fees accrued';
}

function shuffleIndices(count) {
  const indices = Array.from({ length: count }, (_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices;
}

function updateShowcaseDetails(listIndex) {
  const details = document.getElementById('gallery-showcase-details');
  const hashIdEl = document.getElementById('gallery-showcase-hashid');
  const ownerEl = document.getElementById('gallery-showcase-owner');
  const yieldEl = document.getElementById('gallery-showcase-yield');
  if (!hashIdEl || !ownerEl || !yieldEl) return;

  const entry = galleryEntries[listIndex];
  if (!entry) return;

  details?.classList.remove('is-updating');
  void details?.offsetWidth;
  details?.classList.add('is-updating');

  hashIdEl.textContent = entry.hashId;
  hashIdEl.classList.add('is-fluor');
  ownerEl.textContent = entry.owner;
  ownerEl.classList.remove('is-fluor');
  yieldEl.textContent = entry.yieldLabel;
  yieldEl.classList.add('is-fluor');
}

function parseSvgShapes(innerMarkup) {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${innerMarkup}</svg>`,
    'image/svg+xml',
  );

  return [...doc.documentElement.children];
}

function isCanvasBackground(shape) {
  return (
    shape.tagName === 'rect' &&
    shape.getAttribute('width') === '24' &&
    shape.getAttribute('height') === '24' &&
    (shape.getAttribute('fill') === '#000' || shape.getAttribute('fill') === '#080402')
  );
}

function renderShowcasePattern(listIndex) {
  const svgRoot = document.getElementById('gallery-showcase-svg');
  const frame = document.getElementById('gallery-showcase-frame');
  const entry = galleryEntries[listIndex];
  if (!svgRoot || !frame || !entry) return;

  const shapes = parseSvgShapes(entry.svg);

  frame.classList.remove('is-jumping');
  void frame.offsetWidth;
  frame.classList.add('is-jumping');
  window.setTimeout(() => frame.classList.remove('is-jumping'), 360);

  svgRoot.replaceChildren();

  let shapeDelay = 0;
  shapes.forEach((shape) => {
    const node = document.importNode(shape, true);

    if (isCanvasBackground(node)) {
      svgRoot.appendChild(node);
      return;
    }

    node.classList.add('gallery-showcase-shape');
    node.style.animationDelay = `${shapeDelay}s`;
    shapeDelay += SHAPE_STAGGER_MS / 1000;
    svgRoot.appendChild(node);
  });

  updateShowcaseDetails(listIndex);
  cubeScene?.setSelectedIndex(listIndex);
}

function advancePatternShowcase() {
  if (galleryEntries.length === 0) return;

  patternSlot += 1;

  if (patternSlot >= patternQueue.length) {
    patternSlot = 0;
    patternQueue = shuffleIndices(galleryEntries.length);
  }

  renderShowcasePattern(patternQueue[patternSlot]);
}

function initPatternShowcase() {
  const svgRoot = document.getElementById('gallery-showcase-svg');
  if (!svgRoot || galleryEntries.length === 0) return;

  patternQueue = shuffleIndices(galleryEntries.length);
  patternSlot = 0;

  renderShowcasePattern(patternQueue[patternSlot]);

  if (patternCycleId !== null) clearInterval(patternCycleId);
  patternCycleId = window.setInterval(advancePatternShowcase, PATTERN_CYCLE_MS);
}

async function initGalleryScene() {
  const container = document.getElementById('gallery-container');
  if (!container || galleryEntries.length === 0) return;

  setGalleryLoader(true, 0, 'Initialising WebGPU lens-flare scene…');
  container.classList.remove('is-empty');

  cubeScene?.dispose();
  cubeScene = new GalleryCubeScene({
    container,
    entries: galleryEntries,
    onSelect: (index) => {
      renderShowcasePattern(index);
      patternSlot = patternQueue.indexOf(index);
      if (patternSlot < 0) patternSlot = 0;
    },
    onLoadProgress: (loaded, total, label) => {
      setGalleryLoader(
        true,
        loaded / total,
        label ?? `Baking Torch textures ${loaded}/${total}…`,
      );
    },
    onReady: () => {
      setGalleryLoader(false);
      initPatternShowcase();
    },
    onError: (message) => {
      const note = document.getElementById('gallery-intro-note');
      if (note) {
        note.textContent = message;
        note.hidden = false;
      }
    },
  });

  try {
    await cubeScene.init();
  } catch (error) {
    console.error('[UniTorch] Gallery scene failed:', error);
    setGalleryLoader(false);
    const detail = error instanceof Error ? error.message : String(error);
    showGalleryEmptyState(
      `Could not initialise the 3D Torch gallery. ${detail}`,
    );
  }
}

function disposeGalleryScene() {
  if (patternCycleId !== null) clearInterval(patternCycleId);
  cubeScene?.dispose();
  cubeScene = null;
  disposeGalleryFireBackground();
}

function showGalleryEmptyState(message) {
  const introCopy = document.getElementById('gallery-intro-copy');
  const introNote = document.getElementById('gallery-intro-note');
  const showcase = document.querySelector('.gallery-showcase');
  const container = document.getElementById('gallery-container');

  if (introCopy) introCopy.textContent = message;
  if (introNote) introNote.hidden = true;
  showcase?.classList.add('is-empty');
  container?.classList.add('is-empty');
  setGalleryLoader(false);
}

function updateGalleryIntro(displayedCount, burnPercent = null) {
  const introCopy = document.getElementById('gallery-intro-copy');
  const introNote = document.getElementById('gallery-intro-note');

  if (introCopy) {
    introCopy.textContent = `Fly through ${displayedCount.toLocaleString('en-US')} Torch NFT cubes in open space. Click any cube to inspect.`;
  }

  if (introNote && burnPercent !== null) {
    introNote.textContent = `WASD · mouse look · click to inspect · live burn ${burnPercent.toFixed(2)}%`;
    introNote.hidden = false;
  }
}

async function bootGallery() {
  initCaStrip();
  galleryEntries = buildPlaceholderEntries();
  setIntroCopy();

  const fireReady = initGalleryFireBackground();

  if (liveDataEnabled) {
    setGalleryLoader(true, 0, 'Loading on-chain stats…');

    try {
      const meta = await readTokenMetadata();
      if (meta) {
        const samples = loadProceduralTorchSamples(Math.min(GALLERY_DISPLAY_CAP, galleryEntries.length));
        galleryEntries = samples.map((entry, index) => ({
          hashId: entry.torchId,
          owner: 'awaiting claim',
          yieldLabel: 'Hook fees accrue',
          svg: entry.svg || HASH_SVGS[index % HASH_SVGS.length],
        }));
        updateGalleryIntro(galleryEntries.length, meta.burnPercent);
        await initGalleryScene();
        await fireReady;
        return;
      }
    } catch (error) {
      console.error('[UniTorch] Could not load gallery burn stats:', error);
    }
  }

  await initGalleryScene();
  await fireReady;
}

bootGallery();

if (import.meta.hot) {
  import.meta.hot.dispose(disposeGalleryScene);
}
