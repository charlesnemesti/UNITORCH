const DEFAULT_GLYPHS = '!<>-_\\/[]{}—=+*^?#_';

const DEFAULTS = {
  text: '',
  glyphs: DEFAULT_GLYPHS,
  tickMs: 42,
  scrambleTicks: 5,
  holdMs: 5000,
  clearMs: 50,
  cycleMs: null,
  holdRatio: 0.28,
  cursorChar: '█',
};

/**
 * @param {string} text
 * @param {number} cycleMs
 * @param {{ scrambleTicks?: number, clearMs?: number, holdRatio?: number }} options
 */
function resolveTypewriterTiming(text, cycleMs, options = {}) {
  const scrambleTicks = options.scrambleTicks ?? DEFAULTS.scrambleTicks;
  const clearMs = options.clearMs ?? DEFAULTS.clearMs;
  const holdRatio = options.holdRatio ?? DEFAULTS.holdRatio;
  const charSteps = Math.max(text.length, 1);
  const holdMs = Math.round(cycleMs * holdRatio);
  const decodeBudget = Math.max(cycleMs - holdMs - clearMs, charSteps * scrambleTicks * 12);
  const tickMs = Math.max(12, Math.floor(decodeBudget / (charSteps * scrambleTicks)));

  return { tickMs, holdMs, clearMs, scrambleTicks };
}

/**
 * Hacked Terminal Typewriter — decode scramble → hold → wipe → loop.
 *
 * @param {HTMLElement} element
 * @param {{
 *   text?: string,
 *   glyphs?: string,
 *   tickMs?: number,
 *   scrambleTicks?: number,
 *   holdMs?: number,
 *   clearMs?: number,
 *   cycleMs?: number | null,
 *   holdRatio?: number,
 *   cursorChar?: string,
 * }} [options]
 */
export function createHackedTypewriter(element, options = {}) {
  const base = { ...DEFAULTS, ...options };
  const target = base.text;

  const timing = base.cycleMs
    ? resolveTypewriterTiming(target, base.cycleMs, base)
    : {
        tickMs: base.tickMs,
        holdMs: base.holdMs,
        clearMs: base.clearMs,
        scrambleTicks: base.scrambleTicks,
      };

  const config = { ...base, ...timing };

  /** @type {'decode' | 'hold' | 'clear'} */
  let phase = 'decode';
  let revealedIndex = 0;
  let scrambleFrame = 0;

  /** @type {ReturnType<typeof setInterval> | null} */
  let tickInterval = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let phaseTimeout = null;

  const clearPhaseTimeout = () => {
    if (phaseTimeout !== null) {
      clearTimeout(phaseTimeout);
      phaseTimeout = null;
    }
  };

  const randomGlyph = () => {
    const pool = config.glyphs;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const buildFrame = () => {
    if (phase === 'clear') return '';

    let output = '';

    for (let i = 0; i < target.length; i++) {
      const char = target[i];

      if (char === '\n') {
        if (i < revealedIndex) output += '<br />';
        continue;
      }

      if (i < revealedIndex) {
        output += escapeHtml(char);
      } else if (i === revealedIndex && phase === 'decode') {
        output += escapeHtml(randomGlyph());
      } else if (i === revealedIndex + 1 && phase === 'decode') {
        output += `<span class="hero-typewriter-ghost">${escapeHtml(randomGlyph())}</span>`;
      }
    }

    if (phase !== 'clear') {
      output += `<span class="hero-typewriter-cursor" aria-hidden="true">${config.cursorChar}</span>`;
    }

    return output;
  };

  const render = () => {
    element.innerHTML = buildFrame();
  };

  const resetDecode = () => {
    phase = 'decode';
    revealedIndex = 0;
    scrambleFrame = 0;
    render();
  };

  const beginHold = () => {
    phase = 'hold';
    render();

    clearPhaseTimeout();
    phaseTimeout = setTimeout(() => {
      phase = 'clear';
      render();

      clearPhaseTimeout();
      phaseTimeout = setTimeout(() => {
        resetDecode();
      }, config.clearMs);
    }, config.holdMs);
  };

  const onTick = () => {
    if (phase !== 'decode') return;

    scrambleFrame += 1;

    if (scrambleFrame >= config.scrambleTicks) {
      scrambleFrame = 0;

      if (revealedIndex < target.length) {
        revealedIndex += 1;

        while (revealedIndex < target.length && target[revealedIndex] === '\n') {
          revealedIndex += 1;
        }
      }

      if (revealedIndex >= target.length) {
        beginHold();
        return;
      }
    }

    render();
  };

  const start = () => {
    dispose();
    resetDecode();

    tickInterval = setInterval(onTick, config.tickMs);
  };

  const dispose = () => {
    clearPhaseTimeout();

    if (tickInterval !== null) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };

  return { start, dispose, render };
}

function escapeHtml(char) {
  return char
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const HERO_TYPEWRITER_TEXT = '> supply only shrinks';
