import { createHackedTypewriter } from './hacked-typewriter.js';
import { LAUNCH_TERMINAL_MESSAGE } from './config/launch.js';

const SCRAMBLE_GLYPHS = '01█#?X_';
const FAKE_TARGETS = ['1284', '412', '89204'];

/**
 * @param {string[]} statIds
 * @param {string} launchElementId
 */
export function initLaunchHeroStats(statIds, launchElementId) {
  statIds.forEach((id, index) => {
    const el = document.getElementById(id);
    if (!el) return;
    runMetricTerminal(el, FAKE_TARGETS[index] ?? '0000', 900 + index * 350);
  });

  const launchEl = document.getElementById(launchElementId);
  if (!launchEl) return;

  const typewriter = createHackedTypewriter(launchEl, {
    text: `> ${LAUNCH_TERMINAL_MESSAGE}`,
    cycleMs: 9000,
    holdRatio: 0.55,
    scrambleTicks: 4,
  });

  window.setTimeout(() => typewriter.start(), 1400);
}

/**
 * @param {HTMLElement} element
 * @param {string} fakeTarget
 * @param {number} durationMs
 */
function runMetricTerminal(element, fakeTarget, durationMs) {
  const started = performance.now();
  let frame = 0;

  const tick = (now) => {
    const elapsed = now - started;
    const progress = Math.min(elapsed / durationMs, 1);

    if (progress >= 1) {
      element.textContent = '—';
      return;
    }

    const revealCount = Math.floor(progress * fakeTarget.length * 1.1);
    let output = '';

    for (let i = 0; i < fakeTarget.length; i += 1) {
      if (i < revealCount - 1) {
        output += fakeTarget[i];
      } else if (i < revealCount) {
        output += SCRAMBLE_GLYPHS[frame % SCRAMBLE_GLYPHS.length];
      } else {
        output += SCRAMBLE_GLYPHS[(frame + i) % SCRAMBLE_GLYPHS.length];
      }
    }

    element.textContent = output;
    frame += 1;
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
