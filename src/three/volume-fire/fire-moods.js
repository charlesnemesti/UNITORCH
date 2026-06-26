/** Presets cycled on an interval — hues & sim speeds for the volumetric fire. */
export const MOOD_CYCLE_MS = 12_000;
export const MOOD_BLEND_MS = 3_500;

export const FIRE_MOODS = [
  {
    id: 'ember-core',
    fireStartColor: '#ffc266',
    fireMidColor: '#ff6b00',
    fireEndColor: '#ff2200',
    fireHue: 0,
    simSpeed: 1.15,
    turbulence: 3.0,
    fireIntensity: 72,
    fireLifespan: 1.25,
    smokeLifespan: 3.2,
    emitTemperature: 8.5,
    emitDensity: 12.5,
    buoyancy: 4.2,
    bloomStrength: 0.55,
  },
  {
    id: 'inferno',
    fireStartColor: '#fff0a8',
    fireMidColor: '#ff4500',
    fireEndColor: '#b80000',
    fireHue: 12,
    simSpeed: 1.75,
    turbulence: 4.8,
    fireIntensity: 80,
    fireLifespan: 0.95,
    smokeLifespan: 2.6,
    emitTemperature: 9.5,
    emitDensity: 14.0,
    buoyancy: 5.2,
    bloomStrength: 0.65,
  },
  {
    id: 'blue-furnace',
    fireStartColor: '#ffe8cc',
    fireMidColor: '#ff8c42',
    fireEndColor: '#4a1a6b',
    fireHue: -18,
    simSpeed: 0.85,
    turbulence: 2.4,
    fireIntensity: 65,
    fireLifespan: 1.6,
    smokeLifespan: 4.5,
    emitTemperature: 7.5,
    emitDensity: 11.0,
    buoyancy: 3.6,
    bloomStrength: 0.42,
  },
  {
    id: 'solar-flare',
    fireStartColor: '#ffffff',
    fireMidColor: '#ffb020',
    fireEndColor: '#ff5500',
    fireHue: 28,
    simSpeed: 2.1,
    turbulence: 5.2,
    fireIntensity: 85,
    fireLifespan: 0.8,
    smokeLifespan: 2.2,
    emitTemperature: 10.0,
    emitDensity: 15.0,
    buoyancy: 5.8,
    bloomStrength: 0.72,
  },
  {
    id: 'deep-coal',
    fireStartColor: '#ff9a3c',
    fireMidColor: '#cc3300',
    fireEndColor: '#1a0500',
    fireHue: -8,
    simSpeed: 1.0,
    turbulence: 2.8,
    fireIntensity: 68,
    fireLifespan: 1.4,
    smokeLifespan: 5.0,
    emitTemperature: 8.0,
    emitDensity: 11.5,
    buoyancy: 4.0,
    bloomStrength: 0.48,
  },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(out, a, b, t) {
  out.r = lerp(a.r, b.r, t);
  out.g = lerp(a.g, b.g, t);
  out.b = lerp(a.b, b.b, t);
}

/**
 * @param {import('three').Color} startColor
 * @param {import('three').Color} midColor
 * @param {import('three').Color} endColor
 * @param {typeof FIRE_MOODS[0]} from
 * @param {typeof FIRE_MOODS[0]} to
 * @param {number} t 0..1
 */
export function blendMoodIntoColors(startColor, midColor, endColor, from, to, t) {
  const scratchA = startColor.clone();
  const scratchB = startColor.clone();
  scratchA.set(from.fireStartColor);
  scratchB.set(to.fireStartColor);
  lerpColor(startColor, scratchA, scratchB, t);

  scratchA.set(from.fireMidColor);
  scratchB.set(to.fireMidColor);
  lerpColor(midColor, scratchA, scratchB, t);

  scratchA.set(from.fireEndColor);
  scratchB.set(to.fireEndColor);
  lerpColor(endColor, scratchA, scratchB, t);
}

/**
 * @param {typeof FIRE_MOODS[0]} from
 * @param {typeof FIRE_MOODS[0]} to
 * @param {number} t
 */
export function blendMoodScalars(from, to, t) {
  return {
    fireHue: lerp(from.fireHue, to.fireHue, t),
    simSpeed: lerp(from.simSpeed, to.simSpeed, t),
    turbulence: lerp(from.turbulence, to.turbulence, t),
    fireIntensity: lerp(from.fireIntensity, to.fireIntensity, t),
    fireLifespan: lerp(from.fireLifespan, to.fireLifespan, t),
    smokeLifespan: lerp(from.smokeLifespan, to.smokeLifespan, t),
    emitTemperature: lerp(from.emitTemperature, to.emitTemperature, t),
    emitDensity: lerp(from.emitDensity, to.emitDensity, t),
    buoyancy: lerp(from.buoyancy, to.buoyancy, t),
    bloomStrength: lerp(from.bloomStrength, to.bloomStrength, t),
  };
}
