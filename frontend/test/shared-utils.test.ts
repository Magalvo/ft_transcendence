import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAngle180,
  randomFloat2,
  randomInt,
  roundTo,
} from '../src/shared/utils.ts';

test('normalizeAngle180 wraps values into [-180, 180)', () => {
  assert.equal(normalizeAngle180(0), 0);
  assert.equal(normalizeAngle180(181), -179);
  assert.equal(normalizeAngle180(-181), 179);
  assert.equal(normalizeAngle180(540), -180);
});

test('roundTo rounds to the requested decimal places', () => {
  assert.equal(roundTo(1.2345, 2), 1.23);
  assert.equal(roundTo(1.235, 2), 1.24);
  assert.equal(roundTo(-3.14159, 3), -3.142);
});

test('randomInt stays inside the inclusive bounds', () => {
  for (let index = 0; index < 200; index += 1) {
    const value = randomInt(3, 7);
    assert.ok(value >= 3 && value <= 7);
    assert.equal(Number.isInteger(value), true);
  }
});

test('randomFloat2 stays inside bounds and keeps two-decimal precision', () => {
  for (let index = 0; index < 200; index += 1) {
    const value = randomFloat2(1.5, 4.5);
    assert.ok(value >= 1.5 && value <= 4.5);
    assert.equal(value, Math.round(value * 100) / 100);
  }
});
