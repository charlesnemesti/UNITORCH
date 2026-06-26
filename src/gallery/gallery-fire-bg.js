/** @type {{ dispose: () => void } | null} */
let volumeFire = null;

/**
 * Fullscreen WebGPU volumetric torch fire — same system as the landing hero.
 */
export async function initGalleryFireBackground() {
  const container = document.getElementById('gallery-fire-canvas');
  if (!container) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    container.classList.add('gallery-fire-canvas--static');
    return;
  }

  container.classList.remove('gallery-fire-canvas--static');

  try {
    const { createVolumeFire } = await import('../three/volume-fire/VolumeFireApp.js');
    const instance = await createVolumeFire(container);
    if (instance) {
      volumeFire = instance;
      return;
    }
  } catch (error) {
    console.warn('[UniTorch] Gallery volume fire failed:', error);
  }

  container.classList.add('gallery-fire-canvas--static');
}

export function disposeGalleryFireBackground() {
  volumeFire?.dispose();
  volumeFire = null;
}
