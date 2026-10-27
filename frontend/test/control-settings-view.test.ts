import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTROL_SETTINGS_LIMITS,
  DEFAULT_CONTROL_SETTINGS,
} from '../src/games/spacedout/controlSettings.ts';
import {
  applySliderValue,
  applyToggle,
  formatSettingValue,
  resetControlSettings,
  sliderAttributes,
  sliderValue,
  type SliderField,
} from '../src/games/spacedout/controlSettingsView.ts';

const FIELDS: SliderField[] = ['sensitivity', 'deadzone'];

test('sliderAttributes come from CONTROL_SETTINGS_LIMITS', () => {
  for (const field of FIELDS) {
    const limits = CONTROL_SETTINGS_LIMITS[field];
    assert.deepEqual(sliderAttributes(field), {
      min: String(limits.min),
      max: String(limits.max),
      step: String(limits.step),
    });
  }
});

test('applySliderValue sets one field and keeps the others', () => {
  const next = applySliderValue(DEFAULT_CONTROL_SETTINGS, 'sensitivity', '1.5');
  assert.deepEqual(next, { ...DEFAULT_CONTROL_SETTINGS, sensitivity: 1.5 });
  const dz = applySliderValue(next, 'deadzone', '0.15');
  assert.deepEqual(dz, { ...DEFAULT_CONTROL_SETTINGS, sensitivity: 1.5, deadzone: 0.15 });
});

test('applySliderValue snaps to the step without float noise', () => {
  assert.equal(applySliderValue(DEFAULT_CONTROL_SETTINGS, 'sensitivity', '1.234').sensitivity, 1.25);
  assert.equal(applySliderValue(DEFAULT_CONTROL_SETTINGS, 'deadzone', '0.123').deadzone, 0.12);
  assert.equal(applySliderValue(DEFAULT_CONTROL_SETTINGS, 'deadzone', '0.07').deadzone, 0.07);
});

test('applySliderValue clamps to the limits and ignores junk', () => {
  assert.equal(applySliderValue(DEFAULT_CONTROL_SETTINGS, 'sensitivity', '5').sensitivity, 2);
  assert.equal(applySliderValue(DEFAULT_CONTROL_SETTINGS, 'sensitivity', '0').sensitivity, 0.5);
  assert.equal(applySliderValue(DEFAULT_CONTROL_SETTINGS, 'deadzone', '-1').deadzone, 0.02);
  const current = { ...DEFAULT_CONTROL_SETTINGS, sensitivity: 1.3 };
  assert.deepEqual(applySliderValue(current, 'sensitivity', 'abc'), current);
  assert.deepEqual(applySliderValue(current, 'sensitivity', ''), current);
});

test('sliderValue round-trips every step of each slider', () => {
  for (const field of FIELDS) {
    const { min, max, step } = CONTROL_SETTINGS_LIMITS[field];
    const steps = Math.round((max - min) / step);
    for (let i = 0; i <= steps; i += 1) {
      const settings = applySliderValue(DEFAULT_CONTROL_SETTINGS, field, String(min + i * step));
      const again = applySliderValue(DEFAULT_CONTROL_SETTINGS, field, sliderValue(settings, field));
      assert.deepEqual(again, settings, `${field} step ${i}`);
    }
  }
  assert.equal(sliderValue(DEFAULT_CONTROL_SETTINGS, 'sensitivity'), '1');
  assert.equal(sliderValue(DEFAULT_CONTROL_SETTINGS, 'deadzone'), '0.08');
});

test('applyToggle sets an invert flag and keeps the rest', () => {
  assert.deepEqual(applyToggle(DEFAULT_CONTROL_SETTINGS, 'invertYaw', true), {
    ...DEFAULT_CONTROL_SETTINGS,
    invertYaw: true,
  });
  assert.deepEqual(applyToggle(DEFAULT_CONTROL_SETTINGS, 'invertPitch', true), {
    ...DEFAULT_CONTROL_SETTINGS,
    invertPitch: true,
  });
});

test('resetControlSettings gives a mutable copy of the defaults', () => {
  const changed = applyToggle(applySliderValue(DEFAULT_CONTROL_SETTINGS, 'sensitivity', '2'), 'invertYaw', true);
  assert.notDeepEqual(changed, DEFAULT_CONTROL_SETTINGS);
  const reset = resetControlSettings();
  assert.deepEqual(reset, DEFAULT_CONTROL_SETTINGS);
  assert.notEqual(reset, DEFAULT_CONTROL_SETTINGS);
  assert.equal(Object.isFrozen(reset), false);
});

test('formatSettingValue shows sensitivity as a factor and the deadzone in degrees', () => {
  assert.equal(formatSettingValue('sensitivity', 1), '1.00x');
  assert.equal(formatSettingValue('sensitivity', 2), '2.00x');
  assert.equal(formatSettingValue('deadzone', 0.08), '4.6°');
  assert.equal(formatSettingValue('deadzone', 0.2), '11.5°');
});
