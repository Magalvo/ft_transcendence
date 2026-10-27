import test from 'node:test';
import assert from 'node:assert/strict';

import { pickFrameScheduler } from '../src/games/spacedout/frameScheduler.ts';

function fakeAnimationFrames() {
  const requested: Array<() => void> = [];
  const cancelled: number[] = [];
  return {
    requested,
    cancelled,
    requestAnimationFrame: (cb: () => void) => requested.push(cb),
    cancelAnimationFrame: (id: number) => {
      cancelled.push(id);
    },
  };
}

test('pickFrameScheduler uses requestVideoFrameCallback when the video has it', () => {
  const requested: Array<() => void> = [];
  const cancelled: number[] = [];
  const video = {
    requestVideoFrameCallback: (cb: () => void) => requested.push(cb),
    cancelVideoFrameCallback: (id: number) => {
      cancelled.push(id);
    },
  };
  const frames = fakeAnimationFrames();
  const scheduler = pickFrameScheduler(video, frames);

  assert.equal(scheduler.kind, 'video-frame');
  let ran = 0;
  const handle = scheduler.request(() => ran++);
  assert.equal(requested.length, 1);
  assert.equal(frames.requested.length, 0);
  requested[0]();
  assert.equal(ran, 1);
  scheduler.cancel(handle);
  assert.deepEqual(cancelled, [handle]);
});

test('pickFrameScheduler falls back to requestAnimationFrame otherwise', () => {
  const frames = fakeAnimationFrames();
  const scheduler = pickFrameScheduler({}, frames);

  assert.equal(scheduler.kind, 'animation-frame');
  let ran = 0;
  const handle = scheduler.request(() => ran++);
  assert.equal(frames.requested.length, 1);
  frames.requested[0]();
  assert.equal(ran, 1);
  scheduler.cancel(handle);
  assert.deepEqual(frames.cancelled, [handle]);
});

test('pickFrameScheduler keeps the video as `this` for requestVideoFrameCallback', () => {
  const video = {
    calls: 0,
    requestVideoFrameCallback(this: { calls: number }) {
      this.calls++;
      return 1;
    },
    cancelVideoFrameCallback() {},
  };
  pickFrameScheduler(video, fakeAnimationFrames()).request(() => {});
  assert.equal(video.calls, 1);
});
