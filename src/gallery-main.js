import './gallery.css';

import { initCaStrip } from './ca-strip.js';
import * as THREE from 'three';
import TWEEN from 'three/examples/jsm/libs/tween.module.js';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { GALLERY_HASH_COUNT, HASH_SVGS } from './hash-svgs.js';
import { liveDataEnabled } from './config/launch.js';
import { loadMintedHashes, readMintedCount } from './web3/protocol.js';

const GALLERY_DISPLAY_CAP = 120;
const TABLE_COLS = 12;
const TABLE_SPACING_X = 132;
const TABLE_SPACING_Y = 148;
const TABLE_OFFSET_X = 780;
const TABLE_OFFSET_Y = 620;
const PATTERN_CYCLE_MS = 5000;
const SHAPE_STAGGER_MS = 130;
const LAYOUT_CYCLE_MS = 7000;

const LAYOUT_SEQUENCE = /** @type {const} */ (['table', 'sphere', 'helix', 'grid']);

const LAYOUT_BUTTON_IDS = {
  table: 'layout-table',
  sphere: 'layout-sphere',
  helix: 'layout-helix',
  grid: 'layout-grid',
};

/**
 * @typedef {Object} GalleryEntry
 * @property {string} hashId
 * @property {string} owner
 * @property {string} yieldLabel
 * @property {string} svg
 */

/** @type {GalleryEntry[]} */
let galleryEntries = [];

/** @type {number} */
let totalMinted = 0;

/** @type {THREE.PerspectiveCamera | null} */
let camera = null;

/** @type {THREE.Scene | null} */
let scene = null;

/** @type {CSS3DRenderer | null} */
let renderer = null;

/** @type {TrackballControls | null} */
let controls = null;

/** @type {CSS3DObject[]} */
const objects = [];

/** @type {{ table: THREE.Object3D[], sphere: THREE.Object3D[], helix: THREE.Object3D[], grid: THREE.Object3D[] }} */
const targets = { table: [], sphere: [], helix: [], grid: [] };

/** @type {number | null} */
let animationId = null;

/** @type {number | null} */
let patternCycleId = null;

/** @type {number[]} */
let patternQueue = [];

/** @type {number} */
let patternSlot = 0;

/** @type {number | null} */
let layoutCycleId = null;

/** @type {number} */
let layoutIndex = 0;

function formatEth(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 ETH';
  if (value < 0.0001) return '<0.0001 ETH';
  return `${value.toFixed(4)} ETH`;
}

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

  const dailyYield = (0.06 + rand() * 2.75).toFixed(3);

  return {
    hashId: `#${String(tokenId).padStart(4, '0')}`,
    owner: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
    yieldLabel: `~${dailyYield} $HASH / day`,
  };
}

function buildPlaceholderEntries() {
  return Array.from({ length: GALLERY_HASH_COUNT }, (_, index) => {
    const meta = getHashPlaceholderMeta(index);

    return {
      hashId: meta.hashId,
      owner: meta.owner,
      yieldLabel: meta.yieldLabel,
      svg: HASH_SVGS[index % HASH_SVGS.length],
    };
  });
}

function initPlaceholderGallery() {
  galleryEntries = buildPlaceholderEntries();

  const introCopy = document.getElementById('gallery-intro-copy');
  const introNote = document.getElementById('gallery-intro-note');
  const showcaseLabel = document.getElementById('gallery-showcase-label');

  if (introCopy) {
    introCopy.textContent =
      '120 preview Hashes rendered as living 24×24 SVG art. Drag to explore, then switch layouts below.';
  }

  if (introNote) {
    introNote.textContent = 'Preview mode — live on-chain data unlocks after launch.';
    introNote.hidden = false;
  }

  if (showcaseLabel) showcaseLabel.textContent = 'Preview pattern';

  const yieldLabel = document.querySelector(
    '#gallery-showcase-details .gallery-showcase-detail:last-child dt',
  );
  if (yieldLabel) yieldLabel.textContent = 'Daily yield';

  initGalleryScene();
}

/**
 * @param {import('./web3/protocol.js').MintedHash[]} hashes
 * @returns {GalleryEntry[]}
 */
function buildGalleryEntries(hashes) {
  return hashes.map((hash) => ({
    hashId: hash.hashId,
    owner: hash.ownerShort,
    yieldLabel: formatEth(hash.claimableEth),
    svg: hash.svg,
  }));
}

/**
 * @param {number} count
 */
function shuffleIndices(count) {
  const indices = Array.from({ length: count }, (_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices;
}

/**
 * @param {number} listIndex
 */
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

/**
 * @param {string} innerMarkup
 */
function parseSvgShapes(innerMarkup) {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${innerMarkup}</svg>`,
    'image/svg+xml',
  );

  return [...doc.documentElement.children];
}

/**
 * @param {Element} shape
 */
function isCanvasBackground(shape) {
  return (
    shape.tagName === 'rect' &&
    shape.getAttribute('width') === '24' &&
    shape.getAttribute('height') === '24' &&
    shape.getAttribute('fill') === '#000'
  );
}

/**
 * @param {number} listIndex
 */
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

  const activeCard = objects[listIndex]?.element;
  objects.forEach((object) => object.element.classList.remove('hash-element-active'));
  activeCard?.classList.add('hash-element-active');
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

  patternCycleId = window.setInterval(advancePatternShowcase, PATTERN_CYCLE_MS);
}

/**
 * @param {'table' | 'sphere' | 'helix' | 'grid'} layoutKey
 */
function setActiveLayoutButton(layoutKey) {
  LAYOUT_SEQUENCE.forEach((key) => {
    document.getElementById(LAYOUT_BUTTON_IDS[key])?.classList.toggle('is-active', key === layoutKey);
  });
}

/**
 * @param {'table' | 'sphere' | 'helix' | 'grid'} layoutKey
 * @param {number} [duration]
 */
function switchLayout(layoutKey, duration = 2000) {
  const layoutTargets = targets[layoutKey];
  if (!layoutTargets.length) return;

  transform(layoutTargets, duration);
  setActiveLayoutButton(layoutKey);
  layoutIndex = LAYOUT_SEQUENCE.indexOf(layoutKey);
}

function advanceLayout() {
  layoutIndex = (layoutIndex + 1) % LAYOUT_SEQUENCE.length;
  switchLayout(LAYOUT_SEQUENCE[layoutIndex]);
}

function startLayoutCycle() {
  if (layoutCycleId !== null) clearInterval(layoutCycleId);
  layoutCycleId = window.setInterval(advanceLayout, LAYOUT_CYCLE_MS);
}

/**
 * @param {'table' | 'sphere' | 'helix' | 'grid'} layoutKey
 */
function onLayoutSelected(layoutKey) {
  switchLayout(layoutKey);
  startLayoutCycle();
}

/**
 * @param {GalleryEntry} entry
 */
function createHashElement(entry) {
  const element = document.createElement('article');
  element.className = 'hash-element';
  element.setAttribute('aria-label', `Hash ${entry.hashId}`);

  const number = document.createElement('p');
  number.className = 'hash-element-number';
  number.textContent = entry.hashId;
  element.appendChild(number);

  const art = document.createElement('div');
  art.className = 'hash-element-art';
  art.innerHTML = `<svg viewBox="0 0 24 24" role="img" aria-hidden="true">${entry.svg}</svg>`;
  element.appendChild(art);

  const label = document.createElement('p');
  label.className = 'hash-element-label';
  label.textContent = entry.owner;
  element.appendChild(label);

  return element;
}

function initGalleryScene() {
  const container = document.getElementById('gallery-container');
  if (!container || galleryEntries.length === 0) return;

  camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 2600;

  scene = new THREE.Scene();

  for (let i = 0; i < galleryEntries.length; i += 1) {
    const element = createHashElement(galleryEntries[i]);
    const objectCSS = new CSS3DObject(element);

    objectCSS.position.x = Math.random() * 3200 - 1600;
    objectCSS.position.y = Math.random() * 3200 - 1600;
    objectCSS.position.z = Math.random() * 3200 - 1600;

    scene.add(objectCSS);
    objects.push(objectCSS);

    const tableTarget = new THREE.Object3D();
    const col = (i % TABLE_COLS) + 1;
    const row = Math.floor(i / TABLE_COLS) + 1;
    tableTarget.position.x = col * TABLE_SPACING_X - TABLE_OFFSET_X;
    tableTarget.position.y = -(row * TABLE_SPACING_Y) + TABLE_OFFSET_Y;
    targets.table.push(tableTarget);
  }

  const vector = new THREE.Vector3();
  const count = objects.length;

  for (let i = 0; i < count; i += 1) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const sphereTarget = new THREE.Object3D();
    sphereTarget.position.setFromSphericalCoords(860, phi, theta);
    vector.copy(sphereTarget.position).multiplyScalar(2);
    sphereTarget.lookAt(vector);
    targets.sphere.push(sphereTarget);
  }

  for (let i = 0; i < count; i += 1) {
    const theta = i * 0.175 + Math.PI;
    const y = -(i * 8) + 450;
    const helixTarget = new THREE.Object3D();
    helixTarget.position.setFromCylindricalCoords(900, theta, y);
    vector.x = helixTarget.position.x * 2;
    vector.y = helixTarget.position.y;
    vector.z = helixTarget.position.z * 2;
    helixTarget.lookAt(vector);
    targets.helix.push(helixTarget);
  }

  for (let i = 0; i < count; i += 1) {
    const gridTarget = new THREE.Object3D();
    gridTarget.position.x = (i % 5) * 420 - 840;
    gridTarget.position.y = (-Math.floor(i / 5) % 5) * 420 + 840;
    gridTarget.position.z = Math.floor(i / 25) * 1000 - 2000;
    targets.grid.push(gridTarget);
  }

  renderer = new CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  controls = new TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 6500;
  controls.addEventListener('change', render);

  document.getElementById('layout-table')?.addEventListener('click', () => onLayoutSelected('table'));
  document.getElementById('layout-sphere')?.addEventListener('click', () => onLayoutSelected('sphere'));
  document.getElementById('layout-helix')?.addEventListener('click', () => onLayoutSelected('helix'));
  document.getElementById('layout-grid')?.addEventListener('click', () => onLayoutSelected('grid'));

  switchLayout('table', 2000);
  initPatternShowcase();
  startLayoutCycle();
  window.addEventListener('resize', onWindowResize);
  animate();
}

/**
 * @param {THREE.Object3D[]} layoutTargets
 * @param {number} duration
 */
function transform(layoutTargets, duration) {
  TWEEN.removeAll();

  for (let i = 0; i < objects.length; i += 1) {
    const object = objects[i];
    const target = layoutTargets[i];

    new TWEEN.Tween(object.position)
      .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }

  new TWEEN.Tween({})
    .to({}, duration * 2)
    .onUpdate(render)
    .start();
}

function onWindowResize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {
  animationId = requestAnimationFrame(animate);
  TWEEN.update();
  controls?.update();
}

function render() {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
}

function disposeGalleryScene() {
  if (animationId !== null) cancelAnimationFrame(animationId);
  if (patternCycleId !== null) clearInterval(patternCycleId);
  if (layoutCycleId !== null) clearInterval(layoutCycleId);
  window.removeEventListener('resize', onWindowResize);
  controls?.dispose();
  renderer?.domElement?.remove();
}

function showGalleryEmptyState(message) {
  const introCopy = document.getElementById('gallery-intro-copy');
  const introNote = document.getElementById('gallery-intro-note');
  const showcase = document.querySelector('.gallery-showcase');
  const container = document.getElementById('gallery-container');
  const menu = document.getElementById('gallery-menu');

  if (introCopy) introCopy.textContent = message;
  if (introNote) introNote.hidden = true;
  showcase?.classList.add('is-empty');
  container?.classList.add('is-empty');
  menu?.classList.add('is-hidden');

  const hashIdEl = document.getElementById('gallery-showcase-hashid');
  const ownerEl = document.getElementById('gallery-showcase-owner');
  const yieldEl = document.getElementById('gallery-showcase-yield');
  if (hashIdEl) hashIdEl.textContent = '—';
  if (ownerEl) ownerEl.textContent = '—';
  if (yieldEl) yieldEl.textContent = '0 ETH';
}

function updateGalleryIntro(displayedCount) {
  const introCopy = document.getElementById('gallery-intro-copy');
  const introNote = document.getElementById('gallery-intro-note');
  const showcaseLabel = document.getElementById('gallery-showcase-label');

  if (introCopy) {
    introCopy.textContent =
      totalMinted === 1
        ? '1 living Hash rendered fully on-chain. Drag to explore, then switch layouts below.'
        : `${totalMinted.toLocaleString('en-US')} living Hashes on-chain. Drag to explore, then switch layouts below.`;
  }

  if (introNote) {
    if (totalMinted > displayedCount) {
      introNote.textContent = `Showing ${displayedCount.toLocaleString('en-US')} of ${totalMinted.toLocaleString('en-US')} minted Hashes in the 3D grid — all data read live from the contract.`;
      introNote.hidden = false;
    } else {
      introNote.hidden = true;
    }
  }

  if (showcaseLabel) showcaseLabel.textContent = 'Live pattern';
}

async function bootGallery() {
  initCaStrip();

  if (!liveDataEnabled) {
    initPlaceholderGallery();
    return;
  }

  const introCopy = document.getElementById('gallery-intro-copy');
  if (introCopy) introCopy.textContent = 'Loading on-chain Hashes from the contract…';

  try {
    totalMinted = await readMintedCount();

    if (totalMinted === 0) {
      showGalleryEmptyState('No Hashes minted yet. Hold 1 $HASH to spawn the first living Hash on-chain.');
      return;
    }

    const sampleSize = Math.min(GALLERY_DISPLAY_CAP, totalMinted);
    const hashes = await loadMintedHashes({ sampleSize });
    galleryEntries = buildGalleryEntries(hashes);

    if (galleryEntries.length === 0) {
      showGalleryEmptyState('Could not load on-chain Hashes. Check your RPC connection.');
      return;
    }

    updateGalleryIntro(galleryEntries.length);
    initGalleryScene();
  } catch (error) {
    console.error('[UniHash] Could not load gallery data:', error);
    showGalleryEmptyState('Could not load on-chain Hashes. Check your RPC and contract address.');
  }
}

bootGallery();

if (import.meta.hot) {
  import.meta.hot.dispose(disposeGalleryScene);
}
