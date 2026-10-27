import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROL_SETTINGS_KEY,
  CONTROL_SETTINGS_LIMITS,
  DEFAULT_CONTROL_SETTINGS,
  loadControlSettings,
  sanitizeControlSettings,
  saveControlSettings,
  type ControlSettings,
} from '../src/games/spacedout/controlSettings.ts';

class MemoryStorage {
  public readonly items = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const throwingStorage = {
  getItem(): string | null {
    throw new Error('storage disabled');
  },
  setItem(): void {
    throw new Error('quota exceeded');
  },
};

test('DEFAULT_CONTROL_SETTINGS matches the current tuning', () => {
  assert.deepEqual(DEFAULT_CONTROL_SETTINGS, {
    sensitivity: 1.0,
    deadzone: 0.08,
    invertYaw: false,
    invertPitch: false,
  });
  assert.ok(Object.isFrozen(DEFAULT_CONTROL_SETTINGS));
});

test('CONTROL_SETTINGS_LIMITS match the spec ranges', () => {
  assert.equal(CONTROL_SETTINGS_LIMITS.sensitivity.min, 0.5);
  assert.equal(CONTROL_SETTINGS_LIMITS.sensitivity.max, 2.0);
  assert.ok(CONTROL_SETTINGS_LIMITS.sensitivity.step > 0);
  assert.equal(CONTROL_SETTINGS_LIMITS.deadzone.min, 0.02);
  assert.equal(CONTROL_SETTINGS_LIMITS.deadzone.max, 0.2);
  assert.ok(CONTROL_SETTINGS_LIMITS.deadzone.step > 0);
});

test('sanitizeControlSettings gives the defaults for non-objects and empty objects', () => {
  for (const raw of [undefined, null, {}, 'sensitivity=2', 42, true, []]) {
    assert.deepEqual(sanitizeControlSettings(raw), DEFAULT_CONTROL_SETTINGS, `input ${JSON.stringify(raw)}`);
  }
});

test('sanitizeControlSettings returns a fresh, mutable object', () => {
  const settings = sanitizeControlSettings(undefined);
  assert.notEqual(settings, DEFAULT_CONTROL_SETTINGS);
  assert.equal(Object.isFrozen(settings), false);
});

test('sanitizeControlSettings keeps valid values', () => {
  const valid: ControlSettings = { sensitivity: 1.5, deadzone: 0.12, invertYaw: true, invertPitch: true };
  assert.deepEqual(sanitizeControlSettings(valid), valid);
});

test('sanitizeControlSettings clamps numbers to the limits', () => {
  const high = sanitizeControlSettings({ sensitivity: 9, deadzone: 1 });
  assert.equal(high.sensitivity, CONTROL_SETTINGS_LIMITS.sensitivity.max);
  assert.equal(high.deadzone, CONTROL_SETTINGS_LIMITS.deadzone.max);

  const low = sanitizeControlSettings({ sensitivity: 0, deadzone: -0.5 });
  assert.equal(low.sensitivity, CONTROL_SETTINGS_LIMITS.sensitivity.min);
  assert.equal(low.deadzone, CONTROL_SETTINGS_LIMITS.deadzone.min);

  const infinite = sanitizeControlSettings({ sensitivity: Infinity, deadzone: -Infinity });
  assert.equal(infinite.sensitivity, CONTROL_SETTINGS_LIMITS.sensitivity.max);
  assert.equal(infinite.deadzone, CONTROL_SETTINGS_LIMITS.deadzone.min);
});

test('sanitizeControlSettings rejects NaN and non-numeric values', () => {
  for (const bad of [NaN, '1.5', null, undefined, {}, true]) {
    const settings = sanitizeControlSettings({ sensitivity: bad, deadzone: bad });
    assert.equal(settings.sensitivity, DEFAULT_CONTROL_SETTINGS.sensitivity, `sensitivity ${String(bad)}`);
    assert.equal(settings.deadzone, DEFAULT_CONTROL_SETTINGS.deadzone, `deadzone ${String(bad)}`);
  }
});

test('sanitizeControlSettings only takes booleans from real booleans', () => {
  assert.equal(sanitizeControlSettings({ invertYaw: true }).invertYaw, true);
  assert.equal(sanitizeControlSettings({ invertPitch: true }).invertPitch, true);
  for (const truthy of ['true', 1, 'yes', {}, []]) {
    const settings = sanitizeControlSettings({ invertYaw: truthy, invertPitch: truthy });
    assert.equal(settings.invertYaw, false, `invertYaw ${JSON.stringify(truthy)}`);
    assert.equal(settings.invertPitch, false, `invertPitch ${JSON.stringify(truthy)}`);
  }
});

test('sanitizeControlSettings drops unknown keys', () => {
  const settings = sanitizeControlSettings({ sensitivity: 1.2, extra: 'nope' });
  assert.deepEqual(Object.keys(settings).sort(), ['deadzone', 'invertPitch', 'invertYaw', 'sensitivity']);
});

test('save then load round-trips through storage as JSON', () => {
  const storage = new MemoryStorage();
  const settings: ControlSettings = { sensitivity: 1.75, deadzone: 0.05, invertYaw: false, invertPitch: true };
  saveControlSettings(storage, settings);

  assert.equal(CONTROL_SETTINGS_KEY, 'spacedout.controlSettings.v1');
  const stored = storage.items.get(CONTROL_SETTINGS_KEY);
  assert.ok(stored, 'stored under the v1 key');
  assert.deepEqual(JSON.parse(stored), settings);
  assert.deepEqual(loadControlSettings(storage), settings);
});

test('load gives the defaults when nothing is stored', () => {
  assert.deepEqual(loadControlSettings(new MemoryStorage()), DEFAULT_CONTROL_SETTINGS);
});

test('load sanitizes stored values', () => {
  const storage = new MemoryStorage();
  storage.setItem(CONTROL_SETTINGS_KEY, JSON.stringify({ sensitivity: 5, invertYaw: 'true' }));
  assert.deepEqual(loadControlSettings(storage), {
    ...DEFAULT_CONTROL_SETTINGS,
    sensitivity: CONTROL_SETTINGS_LIMITS.sensitivity.max,
  });
});

test('load gives the defaults for corrupt JSON', () => {
  const storage = new MemoryStorage();
  storage.setItem(CONTROL_SETTINGS_KEY, '{"sensitivity": 1.5');
  assert.deepEqual(loadControlSettings(storage), DEFAULT_CONTROL_SETTINGS);
});

test('load and save never throw with a throwing or null storage', () => {
  assert.deepEqual(loadControlSettings(throwingStorage), DEFAULT_CONTROL_SETTINGS);
  assert.deepEqual(loadControlSettings(null), DEFAULT_CONTROL_SETTINGS);
  assert.doesNotThrow(() => saveControlSettings(throwingStorage, { ...DEFAULT_CONTROL_SETTINGS }));
  assert.doesNotThrow(() => saveControlSettings(null, { ...DEFAULT_CONTROL_SETTINGS }));
});

test('save stores sanitized values', () => {
  const storage = new MemoryStorage();
  saveControlSettings(storage, { sensitivity: 10, deadzone: NaN, invertYaw: true, invertPitch: false });
  assert.deepEqual(JSON.parse(storage.items.get(CONTROL_SETTINGS_KEY) ?? 'null'), {
    ...DEFAULT_CONTROL_SETTINGS,
    sensitivity: CONTROL_SETTINGS_LIMITS.sensitivity.max,
    invertYaw: true,
  });
});
