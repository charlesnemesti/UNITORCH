/** @type {{ dispose: () => void } | null} */
let volumeFire = null;

/** @type {import('./three/fire/Fire.js').Fire | null} */
let webglFire = null;

/** @type {number | null} */
let webglAnimationId = null;

/** @type {HTMLElement | null} */
let primaryContainer = null;

/** @type {HTMLElement | null} */
let fallbackContainer = null;

let reducedMotion = false;

async function initWebGLFallback() {
  if (!fallbackContainer || reducedMotion) {
    fallbackContainer?.classList.add('is-static');
    return;
  }

  const [{ Fire }, THREE] = await Promise.all([
    import('./three/fire/Fire.js'),
    import('three'),
  ]);

  const width = fallbackContainer.clientWidth || 640;
  const height = fallbackContainer.clientHeight || 480;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, width / height, 0.5, 100);
  camera.position.set(0, 0, 22);

  scene.add(new THREE.AmbientLight(0xcccccc, 0.35));

  const point = new THREE.PointLight(0xff6b00, 0.9, 80);
  point.position.set(0, 2, 8);
  camera.add(point);
  scene.add(camera);

  const plane = new THREE.PlaneGeometry(18, 18);
  webglFire = new Fire(plane, {
    textureWidth: 512,
    textureHeight: 512,
    debug: false,
  });
  webglFire.color1.set(0xff6b00);
  webglFire.color2.set(0xff2200);
  webglFire.color3.set(0x1a0500);
  webglFire.windVector.set(0, 0.75);
  webglFire.colorBias = 0.92;
  webglFire.burnRate = 1.05;
  webglFire.speed = 500;
  webglFire.clearSources();
  webglFire.addSource(0.5, 0.08, 0.12, 1, 0, 1);
  webglFire.position.z = -1.5;
  scene.add(webglFire);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.autoClear = false;
  fallbackContainer.appendChild(renderer.domElement);
  fallbackContainer.classList.remove('is-static');

  const onResize = () => {
    if (!fallbackContainer) return;
    const w = fallbackContainer.clientWidth;
    const h = fallbackContainer.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  window.addEventListener('resize', onResize);

  const animate = () => {
    webglAnimationId = requestAnimationFrame(animate);
    renderer.clear();
    renderer.render(scene, camera);
  };
  animate();

  volumeFire = {
    dispose() {
      if (webglAnimationId !== null) {
        cancelAnimationFrame(webglAnimationId);
        webglAnimationId = null;
      }
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      renderer.domElement.remove();
      webglFire?.geometry?.dispose();
      webglFire?.material?.dispose();
      webglFire = null;
    },
  };
}

/**
 * Fullscreen WebGPU volumetric fire (three.js webgpu_volume_fire) with mood cycling.
 * Falls back to the legacy WebGL hero plane when WebGPU is unavailable.
 */
export async function initTorchFireHero() {
  primaryContainer = document.getElementById('hero-canvas');
  fallbackContainer = document.getElementById('hero-fire-stage');

  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    primaryContainer?.classList.add('site-bg-canvas--static');
    fallbackContainer?.classList.add('is-static');
    return;
  }

  if (!primaryContainer) return;

  primaryContainer.classList.remove('site-bg-canvas--static');

  try {
    const { createVolumeFire } = await import('./three/volume-fire/VolumeFireApp.js');
    const instance = await createVolumeFire(primaryContainer);
    if (instance) {
      volumeFire = instance;
      fallbackContainer?.classList.add('is-hidden');
      return;
    }
  } catch (error) {
    console.warn('[UniTorch] WebGPU volume fire failed, using WebGL fallback:', error);
  }

  primaryContainer.classList.add('site-bg-canvas--static');
  await initWebGLFallback();
}

export function disposeTorchFireHero() {
  volumeFire?.dispose();
  volumeFire = null;
  webglFire = null;
  primaryContainer?.classList.add('site-bg-canvas--static');
  fallbackContainer?.classList.remove('is-hidden');
  primaryContainer = null;
  fallbackContainer = null;
}
