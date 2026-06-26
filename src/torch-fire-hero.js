import * as THREE from 'three';
import { Fire } from './three/fire/Fire.js';

/** @type {THREE.Scene | null} */
let scene = null;
/** @type {THREE.PerspectiveCamera | null} */
let camera = null;
/** @type {THREE.WebGLRenderer | null} */
let renderer = null;
/** @type {Fire | null} */
let fire = null;
/** @type {HTMLElement | null} */
let container = null;
/** @type {number | null} */
let animationId = null;
/** @type {boolean} */
let reducedMotion = false;

function applyTorchPreset(fireMesh) {
  fireMesh.color1.set(0xdfff00);
  fireMesh.color2.set(0xff8a00);
  fireMesh.color3.set(0x000000);
  fireMesh.windVector.set(0, 0.75);
  fireMesh.colorBias = 0.92;
  fireMesh.burnRate = 1.05;
  fireMesh.diffuse = 1.33;
  fireMesh.viscosity = 0.25;
  fireMesh.expansion = 0;
  fireMesh.swirl = 50;
  fireMesh.drag = 0.35;
  fireMesh.airSpeed = 10;
  fireMesh.speed = 500;
  fireMesh.massConservation = false;

  fireMesh.clearSources();
  fireMesh.addSource(0.5, 0.08, 0.12, 1, 0, 1);
}

function onResize() {
  if (!container || !camera || !renderer) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);

  if (fire) {
    const scale = Math.min(width / 420, height / 380, 1.35);
    fire.scale.set(scale * 1.1, scale * 1.35, 1);
  }
}

function animate() {
  animationId = requestAnimationFrame(animate);
  if (!renderer || !scene || !camera) return;
  renderer.clear();
  renderer.render(scene, camera);
}

export function initTorchFireHero() {
  container = document.getElementById('hero-fire-stage');
  if (!container) return;

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    container.classList.add('is-static');
    return;
  }

  scene = new THREE.Scene();
  scene.background = null;

  const width = container.clientWidth || 640;
  const height = container.clientHeight || 480;

  camera = new THREE.PerspectiveCamera(52, width / height, 0.5, 100);
  camera.position.set(0, 0, 22);

  const ambient = new THREE.AmbientLight(0xcccccc, 0.35);
  scene.add(ambient);

  const point = new THREE.PointLight(0xdfff00, 0.9, 80);
  point.position.set(0, 2, 8);
  camera.add(point);
  scene.add(camera);

  const plane = new THREE.PlaneGeometry(18, 18);
  fire = new Fire(plane, {
    textureWidth: 512,
    textureHeight: 512,
    debug: false,
  });
  fire.position.z = -1.5;
  applyTorchPreset(fire);
  scene.add(fire);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', onResize);
  onResize();
  animate();
}

export function disposeTorchFireHero() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  window.removeEventListener('resize', onResize);

  renderer?.dispose();
  renderer?.domElement?.remove();

  if (fire) {
    fire.geometry?.dispose();
    fire.material?.dispose();
  }

  scene = null;
  camera = null;
  renderer = null;
  fire = null;
  container = null;
}
