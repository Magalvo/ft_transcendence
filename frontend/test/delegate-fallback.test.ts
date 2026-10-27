import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWithDelegateFallback,
  type Delegate,
} from '../src/games/spacedout/delegateFallback.ts';

test('createWithDelegateFallback uses GPU when it works', async () => {
  const calls: Delegate[] = [];
  const result = await createWithDelegateFallback(async (delegate) => {
    calls.push(delegate);
    return `landmarker-${delegate}`;
  });
  assert.deepEqual(result, { value: 'landmarker-GPU', delegate: 'GPU' });
  assert.deepEqual(calls, ['GPU']);
});

test('createWithDelegateFallback falls back to CPU when GPU throws', async () => {
  const calls: Delegate[] = [];
  const result = await createWithDelegateFallback(async (delegate) => {
    calls.push(delegate);
    if (delegate === 'GPU') throw new Error('no WebGL');
    return `landmarker-${delegate}`;
  });
  assert.deepEqual(result, { value: 'landmarker-CPU', delegate: 'CPU' });
  assert.deepEqual(calls, ['GPU', 'CPU']);
});

test('createWithDelegateFallback also catches a synchronous GPU throw', async () => {
  const result = await createWithDelegateFallback((delegate) => {
    if (delegate === 'GPU') throw new Error('no WebGL');
    return 7;
  });
  assert.deepEqual(result, { value: 7, delegate: 'CPU' });
});

test('createWithDelegateFallback rethrows the CPU error when both fail', async () => {
  const cpuError = new Error('cpu failed');
  const calls: Delegate[] = [];
  await assert.rejects(
    createWithDelegateFallback(async (delegate) => {
      calls.push(delegate);
      throw delegate === 'GPU' ? new Error('gpu failed') : cpuError;
    }),
    (error) => error === cpuError,
  );
  assert.deepEqual(calls, ['GPU', 'CPU']);
});
