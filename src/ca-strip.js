import { ETHERSCAN_TOKEN_URL, UNIHASH_CA } from './config/deployed.js';

const SCRAMBLE_GLYPHS = '01█#?_X';

/**
 * @param {HTMLElement} element
 * @param {string} target
 */
function revealTerminalText(element, target) {
  const started = performance.now();
  const duration = 1100;
  let frame = 0;

  const tick = (now) => {
    const progress = Math.min((now - started) / duration, 1);
    const revealCount = Math.floor(progress * target.length * 1.05);

    if (progress >= 1) {
      element.textContent = target;
      element.classList.add('is-revealed');
      return;
    }

    let output = '';
    for (let i = 0; i < target.length; i += 1) {
      if (i < revealCount - 1) {
        output += target[i];
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

export function initCaStrip() {
  const strip = document.getElementById('ca-strip');
  const display = document.getElementById('ca-address-display');
  const copyBtn = document.getElementById('ca-copy-btn');
  const explorerLink = document.getElementById('ca-explorer-link');

  if (!strip || !display) return;
  if (strip.dataset.initialized === 'true') return;
  strip.dataset.initialized = 'true';

  display.textContent = '0x' + '█'.repeat(40);
  revealTerminalText(display, UNIHASH_CA);

  if (explorerLink) {
    explorerLink.href = ETHERSCAN_TOKEN_URL;
  }

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(UNIHASH_CA);
      copyBtn.textContent = 'Copied ✓';
      copyBtn.classList.add('is-copied');
      strip.classList.add('is-copied');

      window.setTimeout(() => {
        copyBtn.textContent = 'Copy CA';
        copyBtn.classList.remove('is-copied');
        strip.classList.remove('is-copied');
      }, 2200);
    } catch {
      copyBtn.textContent = 'Failed';
      window.setTimeout(() => {
        copyBtn.textContent = 'Copy CA';
      }, 2000);
    }
  });
}
