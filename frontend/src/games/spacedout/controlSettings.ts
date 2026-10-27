// Per-player face-steering settings. Pure (no DOM): storage is passed in so the
// module can be unit tested under plain Node.

export interface ControlSettings {
  // Higher = full deflection with a smaller head turn past the deadzone.
  sensitivity: number;
  // Head rotation (radians past neutral) that is ignored.
  deadzone: number;
  invertYaw: boolean;
  invertPitch: boolean;
}

// Matches the original fixed tuning, so defaults change nothing.
export const DEFAULT_CONTROL_SETTINGS: Readonly<ControlSettings> = Object.freeze({
  sensitivity: 1.0,
  deadzone: 0.08,
  invertYaw: false,
  invertPitch: false,
});

export const CONTROL_SETTINGS_LIMITS = {
  sensitivity: { min: 0.5, max: 2.0, step: 0.05 },
  deadzone: { min: 0.02, max: 0.2, step: 0.01 },
} as const;

export const CONTROL_SETTINGS_KEY = 'spacedout.controlSettings.v1';

function sanitizeNumber(value: unknown, limits: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(limits.max, Math.max(limits.min, value));
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

// Always returns a complete, valid object: numbers are clamped to the limits and
// anything missing or of the wrong type falls back to the default.
export function sanitizeControlSettings(raw: unknown): ControlSettings {
  const source: Record<string, unknown> =
    typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const defaults = DEFAULT_CONTROL_SETTINGS;
  return {
    sensitivity: sanitizeNumber(source.sensitivity, CONTROL_SETTINGS_LIMITS.sensitivity, defaults.sensitivity),
    deadzone: sanitizeNumber(source.deadzone, CONTROL_SETTINGS_LIMITS.deadzone, defaults.deadzone),
    invertYaw: sanitizeBoolean(source.invertYaw, defaults.invertYaw),
    invertPitch: sanitizeBoolean(source.invertPitch, defaults.invertPitch),
  };
}

// Storage can be missing, disabled (throws) or hold anything; all of those give
// the defaults rather than an error.
export function loadControlSettings(storage: Pick<Storage, 'getItem'> | null): ControlSettings {
  if (!storage) {
    return sanitizeControlSettings(undefined);
  }
  try {
    const stored = storage.getItem(CONTROL_SETTINGS_KEY);
    return sanitizeControlSettings(stored === null ? undefined : JSON.parse(stored));
  } catch {
    return sanitizeControlSettings(undefined);
  }
}

export function saveControlSettings(storage: Pick<Storage, 'setItem'> | null, settings: ControlSettings): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(CONTROL_SETTINGS_KEY, JSON.stringify(sanitizeControlSettings(settings)));
  } catch {
    // Settings still apply for this session; they just won't persist.
  }
}
