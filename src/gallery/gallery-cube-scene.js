import * as THREE from 'three/webgpu';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import { LensflareMesh, LensflareElement } from 'three/addons/objects/LensflareMesh.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

import { buildTorchTextureCache, disposeTorchTextureCache } from './torch-textures.js';
import {
  buildCubeFaceMaterials,
  buildOnchainTextureCache,
  createLogoFaceMaterial,
  disposeOnchainTextureCache,
  loadLogoTexture,
  setMaterialsHighlight,
  tuneOnchainTextures,
} from './cube-face-textures.js';

const CUBE_SIZE = 420;
const CLUSTER_RADIUS = 3800;
/** Minimum gap between cube centres — ~1.5× edge length avoids overlap. */
const MIN_CUBE_SEPARATION = CUBE_SIZE * 1.52;

/**
 * Lightweight equirectangular env — PMREMGenerator hangs on WebGPURenderer.
 * @returns {THREE.CanvasTexture}
 */
function createMetallicEnvironmentMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const gradient = ctx.createLinearGradient(0, 0, 0, 32);
  gradient.addColorStop(0, '#f0f4f8');
  gradient.addColorStop(0.35, '#98a4b0');
  gradient.addColorStop(0.7, '#30383f');
  gradient.addColorStop(1, '#0a0604');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Distribute cubes in a spherical shell with room to separate them.
 * @param {() => number} rand
 */
function clusterPosition(rand) {
  const theta = rand() * Math.PI * 2;
  const phi = Math.acos(2 * rand() - 1);
  const radius = CLUSTER_RADIUS * (0.58 + rand() * 0.42);

  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta) * 0.6,
    radius * Math.cos(phi),
  );
}

/**
 * Place cubes with minimum separation so faces never intersect.
 * @param {number} count
 * @param {(index: number) => () => number} randForIndex
 */
function layoutCubePositions(count, randForIndex) {
  const positions = [];
  const maxAttempts = 1400;

  for (let i = 0; i < count; i += 1) {
    const rand = randForIndex(i);
    let placed = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = clusterPosition(rand);
      const separated = positions.every((p) => p.distanceTo(candidate) >= MIN_CUBE_SEPARATION);
      if (separated) {
        placed = candidate;
        break;
      }
    }

    positions.push(placed ?? clusterPosition(rand));
  }

  return positions;
}

/**
 * @typedef {import('./torch-textures.js').TorchArtEntry & {
 *   owner: string,
 *   yieldLabel: string,
 * }} GalleryEntry
 */

/**
 * @typedef {Object} GalleryCubeSceneOptions
 * @property {HTMLElement} container
 * @property {GalleryEntry[]} entries
 * @property {(index: number) => void} onSelect
 * @property {(loaded: number, total: number, label?: string) => void} [onLoadProgress]
 * @property {() => void} [onReady]
 * @property {(message: string) => void} [onError]
 */

function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GalleryCubeScene {
  /** @param {GalleryCubeSceneOptions} options */
  constructor(options) {
    this.container = options.container;
    this.entries = options.entries;
    this.onSelect = options.onSelect;
    this.onLoadProgress = options.onLoadProgress;
    this.onReady = options.onReady;
    this.onError = options.onError;

    /** @type {THREE.PerspectiveCamera | null} */
    this.camera = null;
    /** @type {THREE.Scene | null} */
    this.scene = null;
    /** @type {THREE.WebGPURenderer | null} */
    this.renderer = null;
    /** @type {FlyControls | null} */
    this.controls = null;
    this.timer = new THREE.Timer();

    /** @type {THREE.BoxGeometry | null} */
    this.cubeGeometry = null;
    /** @type {THREE.Mesh[]} */
    this.cubes = [];
    /** @type {Map<string, THREE.CanvasTexture>} */
    this.textureCache = new Map();
    /** @type {Map<string, THREE.CanvasTexture>} */
    this.onchainCache = new Map();
    /** @type {THREE.Texture | null} */
    this.logoTexture = null;
    /** @type {THREE.Texture | null} */
    this.envMap = null;
    /** @type {THREE.MeshStandardMaterial | null} */
    this.logoMaterial = null;

    this.selectedIndex = -1;

    this._resizeHandler = () => this.onResize();
    this._pointerDown = { x: 0, y: 0 };
    this._pointerDownHandler = (event) => {
      this._pointerDown.x = event.clientX;
      this._pointerDown.y = event.clientY;
    };
    this._pointerUpHandler = (event) => this.onPointerSelect(event);
    this._disposed = false;
  }

  async init() {
    const phase = (label, step, total) => {
      this.onLoadProgress?.(step, total, label);
    };

    phase('Checking WebGPU…', 0, 5);

    if (!(await WebGPU.isAvailable())) {
      const message = 'WebGPU is required for the Torch gallery. Use Chrome or Edge with WebGPU enabled.';
      this.onError?.(message);
      throw new Error(message);
    }

    this.timer.connect(document);

    phase('Baking Torch textures…', 1, 5);
    await this.buildTextures();
    if (this._disposed) return;

    phase('Starting WebGPU renderer…', 2, 5);
    await this.setupRenderer();
    tuneOnchainTextures(this.onchainCache, this.renderer);
    if (this._disposed) return;

    phase('Building cube cluster…', 3, 5);
    this.setupScene();
    this.setupEnvironment();
    this.buildCubes();
    this.setupLights();
    this.setupControls();

    phase('Ready', 5, 5);

    window.addEventListener('resize', this._resizeHandler);
    this.renderer.domElement.addEventListener('pointerdown', this._pointerDownHandler);
    this.renderer.domElement.addEventListener('pointerup', this._pointerUpHandler);

    this.renderer.setAnimationLoop(() => this.tick());
    this.onReady?.();
  }

  async buildTextures() {
    const total = this.entries.length * 2 + 1;
    let loaded = 0;
    const bump = () => {
      loaded += 1;
      this.onLoadProgress?.(loaded, total);
    };

    this.logoTexture = await loadLogoTexture();
    bump();
    this.logoMaterial = createLogoFaceMaterial(this.logoTexture);

    this.textureCache = buildTorchTextureCache(this.entries, bump);
    this.onchainCache = buildOnchainTextureCache(this.entries);
    this.entries.forEach(() => bump());
  }

  async setupRenderer() {
    this.renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    const initPromise = this.renderer.init();
    const timeoutMs = 20_000;
    await Promise.race([
      initPromise,
      new Promise((_, reject) => {
        window.setTimeout(
          () => reject(new Error('WebGPU renderer init timed out')),
          timeoutMs,
        );
      }),
    ]);
  }

  setupScene() {
    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      1,
      9000,
    );
    this.camera.position.set(1200, 360, 1500);
    this.camera.lookAt(0, 0, 0);

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.FogExp2(0x080402, 0.00011);
  }

  setupEnvironment() {
    if (!this.scene) return;

    this.envMap = createMetallicEnvironmentMap();
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 1.1;
  }

  buildCubes() {
    this.cubeGeometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const positions = layoutCubePositions(
      this.entries.length,
      (index) => seededRandom(index * 7919 + 104729),
    );

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i];
      const nftTexture = this.textureCache.get(entry.hashId);
      const onchainTexture = this.onchainCache.get(entry.hashId);
      const materials = buildCubeFaceMaterials(nftTexture, onchainTexture, this.logoMaterial);

      const mesh = new THREE.Mesh(this.cubeGeometry, materials);
      mesh.userData = { listIndex: i, hashId: entry.hashId, materials };

      mesh.position.copy(positions[i]);

      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );

      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();

      this.scene.add(mesh);
      this.cubes.push(mesh);
    }
  }

  setupLights() {
    const textureLoader = new THREE.TextureLoader();
    const textureFlare0 = textureLoader.load('/textures/lensflare/lensflare0.png');
    const textureFlare3 = textureLoader.load('/textures/lensflare/lensflare3.png');
    textureFlare0.colorSpace = THREE.SRGBColorSpace;
    textureFlare3.colorSpace = THREE.SRGBColorSpace;

    const coolFill = new THREE.AmbientLight(0xc8d2dc, 0.48);
    this.scene.add(coolFill);

    const warmFill = new THREE.AmbientLight(0xff6b00, 0.08);
    this.scene.add(warmFill);

    const hemi = new THREE.HemisphereLight(0xe8eef5, 0x080402, 0.62);
    hemi.position.set(0, 1, 0);
    this.scene.add(hemi);

    const clusterFill = new THREE.PointLight(0xf0f4f8, 2.4, CLUSTER_RADIUS * 3.2, 1.1);
    clusterFill.position.set(0, 0, 0);
    this.scene.add(clusterFill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.95);
    rim.position.set(-1600, 1200, 900);
    this.scene.add(rim);

    const key = new THREE.DirectionalLight(0xffd4a8, 0.45);
    key.position.set(1400, -600, 1100);
    this.scene.add(key);

    this.addLensflareLight(textureFlare0, textureFlare3, 0.55, 0.95, 0.55, 0, 2800, -2200);
    this.addLensflareLight(textureFlare0, textureFlare3, 0.12, 0.8, 0.5, -1800, 600, -1400);
  }

  addLensflareLight(flare0, flare3, h, s, l, x, y, z) {
    const light = new THREE.PointLight(0xffffff, 1.1, CLUSTER_RADIUS * 3.5, 1.4);
    light.color.setHSL(h, s, l);
    light.position.set(x, y, z);
    this.scene.add(light);

    const lensflare = new LensflareMesh();
    lensflare.addElement(new LensflareElement(flare0, 320, 0, light.color));
    lensflare.addElement(new LensflareElement(flare3, 40, 0.55));
    lensflare.addElement(new LensflareElement(flare3, 55, 0.75));
    lensflare.addElement(new LensflareElement(flare3, 70, 0.9));
    light.add(lensflare);
  }

  setupControls() {
    this.controls = new FlyControls(this.camera, this.renderer.domElement);
    this.controls.movementSpeed = 1800;
    this.controls.domElement = this.container;
    this.controls.rollSpeed = Math.PI / 6;
    this.controls.autoForward = false;
    this.controls.dragToLook = false;
  }

  /**
   * @param {number} index
   */
  setSelectedIndex(index) {
    this.selectedIndex = index;

    this.cubes.forEach((cube, i) => {
      const materials = /** @type {THREE.MeshStandardMaterial[]} */ (cube.userData.materials);
      setMaterialsHighlight(materials, i === index);
      cube.scale.setScalar(i === index ? 1.15 : 1);
      cube.updateMatrix();
    });
  }

  /**
   * @param {PointerEvent} event
   */
  onPointerSelect(event) {
    if (!this.camera || !this.renderer) return;

    const dx = event.clientX - this._pointerDown.x;
    const dy = event.clientY - this._pointerDown.y;
    if (dx * dx + dy * dy > 36) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hits = raycaster.intersectObjects(this.cubes, false);

    if (hits[0]?.object?.userData?.listIndex !== undefined) {
      const index = hits[0].object.userData.listIndex;
      this.setSelectedIndex(index);
      this.onSelect(index);
    }
  }

  tick() {
    this.timer.update();
    const delta = this.timer.getDelta();
    this.controls?.update(delta);

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    if (!this.camera || !this.renderer) return;

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    this._disposed = true;
    this.renderer?.setAnimationLoop(null);

    window.removeEventListener('resize', this._resizeHandler);
    this.renderer?.domElement.removeEventListener('pointerdown', this._pointerDownHandler);
    this.renderer?.domElement.removeEventListener('pointerup', this._pointerUpHandler);

    this.controls?.dispose();

    const disposedMaterials = new Set();
    this.cubes.forEach((cube) => {
      /** @type {THREE.MeshStandardMaterial[]} */ (cube.userData.materials).forEach((mat) => {
        if (disposedMaterials.has(mat)) return;
        disposedMaterials.add(mat);
        mat.dispose();
      });
    });
    this.cubes = [];

    this.cubeGeometry?.dispose();
    this.cubeGeometry = null;

    disposeTorchTextureCache(this.textureCache);
    disposeOnchainTextureCache(this.onchainCache);
    this.logoMaterial?.dispose();
    this.logoMaterial = null;
    this.logoTexture?.dispose();
    this.logoTexture = null;
    this.envMap?.dispose();
    this.envMap = null;

    this.renderer?.dispose();
    this.renderer?.domElement?.remove();

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
  }
}
