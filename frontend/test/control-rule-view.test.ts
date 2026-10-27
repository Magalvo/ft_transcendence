import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canToggleControlMode,
  controlModeBadge,
  controlModeToggleMessage,
  controlRuleLabel,
  keyboardFallbackVisible,
  normalizeControlMode,
  normalizeControlRule,
  ruleSelectState,
  type ControlRule,
} from '../src/games/spacedout/controlRuleView.ts';

const RULES: ControlRule[] = ['FACE_REQUIRED', 'ANY'];
const BOOLS = [false, true];

test('normalizeControlRule keeps only the exact "ANY"', () => {
  assert.equal(normalizeControlRule('ANY'), 'ANY');
  assert.equal(normalizeControlRule('FACE_REQUIRED'), 'FACE_REQUIRED');
  for (const junk of [undefined, null, '', 'any', 'KEYBOARD', 1, {}]) {
    assert.equal(normalizeControlRule(junk), 'FACE_REQUIRED', String(junk));
  }
});

test('normalizeControlMode keeps only the exact "KEYBOARD"', () => {
  assert.equal(normalizeControlMode('KEYBOARD'), 'KEYBOARD');
  assert.equal(normalizeControlMode('FACE'), 'FACE');
  for (const junk of [undefined, null, '', 'keyboard', 0]) {
    assert.equal(normalizeControlMode(junk), 'FACE', String(junk));
  }
});

test('canToggleControlMode: only under ANY, calibrated and alive', () => {
  for (const rule of RULES) {
    for (const isCalibrated of BOOLS) {
      for (const isDead of BOOLS) {
        const expected = rule === 'ANY' && isCalibrated && !isDead;
        assert.equal(
          canToggleControlMode({ rule, isCalibrated, isDead }),
          expected,
          JSON.stringify({ rule, isCalibrated, isDead }),
        );
      }
    }
  }
});

test('controlModeToggleMessage explains only a rule block', () => {
  const blocked = controlModeToggleMessage({ rule: 'FACE_REQUIRED', isCalibrated: true, isDead: false });
  assert.ok(blocked && /face/i.test(blocked), 'mentions the face rule');
  assert.equal(controlModeToggleMessage({ rule: 'ANY', isCalibrated: true, isDead: false }), null);
  // Not flying yet or destroyed: M is just ignored, as before WS6.
  assert.equal(controlModeToggleMessage({ rule: 'FACE_REQUIRED', isCalibrated: false, isDead: false }), null);
  assert.equal(controlModeToggleMessage({ rule: 'FACE_REQUIRED', isCalibrated: true, isDead: true }), null);
});

test('controlModeBadge gives a camera badge for FACE and a keyboard badge for KEYBOARD', () => {
  const face = controlModeBadge('FACE');
  const keyboard = controlModeBadge('KEYBOARD');
  assert.deepEqual(face, { mode: 'FACE', label: 'Face', icon: '\u{1F4F7}' });
  assert.deepEqual(keyboard, { mode: 'KEYBOARD', label: 'Keyboard', icon: '⌨️' });
});

test('ruleSelectState: editable only for the host while the terrain is unlocked', () => {
  assert.equal(ruleSelectState({ isHost: true, terrainLocked: false }), 'editable');
  assert.equal(ruleSelectState({ isHost: true, terrainLocked: true }), 'readonly');
  assert.equal(ruleSelectState({ isHost: false, terrainLocked: false }), 'readonly');
  assert.equal(ruleSelectState({ isHost: false, terrainLocked: true }), 'readonly');
});

test('keyboardFallbackVisible: "Fly with keyboard" only under ANY', () => {
  assert.equal(keyboardFallbackVisible('ANY'), true);
  assert.equal(keyboardFallbackVisible('FACE_REQUIRED'), false);
});

test('controlRuleLabel names each rule', () => {
  assert.equal(controlRuleLabel('FACE_REQUIRED'), 'Face required');
  assert.equal(controlRuleLabel('ANY'), 'Any');
});
