import test from 'node:test';
import assert from 'node:assert/strict';

import { processGoogleCallback } from '../src/services/OAuthCallbackService.ts';

test('processGoogleCallback persists tokens and reports profileLoaded=true when profile bootstrap succeeds', async () => {
  let persistedToken = '';
  let persistedRefreshToken = '';
  let profileCalls = 0;

  const result = await processGoogleCallback(
    '?provider=google&token=oauth-token&refreshToken=oauth-refresh',
    {
      setTokens: (token, refreshToken) => {
        persistedToken = token;
        persistedRefreshToken = refreshToken;
      },
      loadProfile: async () => {
        profileCalls += 1;
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.profileLoaded, true);
  assert.equal(profileCalls, 1);
  assert.equal(persistedToken, 'oauth-token');
  assert.equal(persistedRefreshToken, 'oauth-refresh');
});

test('processGoogleCallback returns profileLoaded=false when profile bootstrap fails', async () => {
  const result = await processGoogleCallback(
    '?provider=google&token=oauth-token-2&refreshToken=oauth-refresh-2',
    {
      setTokens: () => {},
      loadProfile: async () => {
        throw new Error('profile bootstrap failed');
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.profileLoaded, false);
});

test('processGoogleCallback rejects when OAuth params are missing', async () => {
  await assert.rejects(
    () =>
      processGoogleCallback('?provider=google&token=only-token', {
        setTokens: () => {},
        loadProfile: async () => {},
      }),
    /Missing token from Google OAuth/,
  );
});

test('processGoogleCallback reads tokens from the URL fragment', async () => {
  let persistedToken = '';

  const result = await processGoogleCallback(
    '#provider=google&token=fragment-token&refreshToken=fragment-refresh',
    {
      setTokens: (token) => {
        persistedToken = token;
      },
      loadProfile: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal(persistedToken, 'fragment-token');
});
