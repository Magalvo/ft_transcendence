import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TournamentInviteState,
  type TournamentInviteInvalidatedPayload,
} from '../src/services/TournamentInviteState.ts';

function installWindowEventBridge() {
  const listeners = new Map<string, Set<(event: any) => void>>();

  const windowMock = {
    addEventListener: (name: string, callback: (event: any) => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(callback);
    },
    removeEventListener: (name: string, callback: (event: any) => void) => {
      listeners.get(name)?.delete(callback);
    },
    dispatchEvent: (event: any) => {
      const callbacks = listeners.get(event.type);
      if (!callbacks) return true;
      for (const callback of callbacks) callback(event);
      return true;
    },
  };

  return { windowMock };
}

function buildPayload(token: string): TournamentInviteInvalidatedPayload {
  return {
    version: 1,
    tournamentId: 't1',
    matchId: 'm1',
    invalidatedToken: token,
    supersededByToken: `${token}-new`,
    reason: 'superseded',
    requestedBy: 'u1',
    invalidatedAt: Date.now(),
  };
}

test('markInvalidated stores token and emits browser event', () => {
  const originalWindow = (globalThis as any).window;

  try {
    const { windowMock } = installWindowEventBridge();
    (globalThis as any).window = windowMock;

    const eventName = TournamentInviteState.getInvalidatedEventName();
    const receivedPayloads: TournamentInviteInvalidatedPayload[] = [];

    windowMock.addEventListener(eventName, (event: any) => {
      receivedPayloads.push(event.detail as TournamentInviteInvalidatedPayload);
    });

    const payload = buildPayload('token-a');
    TournamentInviteState.markInvalidated(payload);

    assert.equal(TournamentInviteState.isTokenInvalidated('token-a'), true);
    assert.equal(receivedPayloads.length, 1);
    const receivedPayload = receivedPayloads[0];
    assert.ok(receivedPayload);
    assert.equal(receivedPayload.invalidatedToken, 'token-a');
    assert.equal(receivedPayload.supersededByToken, 'token-a-new');
  } finally {
    (globalThis as any).window = originalWindow;
  }
});

test('isTokenInvalidated returns false for unknown or empty tokens', () => {
  assert.equal(TournamentInviteState.isTokenInvalidated('unknown-token'), false);
  assert.equal(TournamentInviteState.isTokenInvalidated(''), false);
  assert.equal(TournamentInviteState.isTokenInvalidated(null), false);
  assert.equal(TournamentInviteState.isTokenInvalidated(undefined), false);
});
