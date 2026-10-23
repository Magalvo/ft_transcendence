export interface GoogleCallbackResult {
  ok: boolean;
  profileLoaded: boolean;
}

export interface GoogleCallbackDeps {
  setTokens: (token: string, refreshToken: string) => void;
  loadProfile: () => Promise<unknown>;
}

// The backend sends OAuth results in the URL fragment (#token=...) so they
// never reach server logs; a leading '?' or '#' is accepted.
export function parseOAuthParams(raw: string): URLSearchParams {
  return new URLSearchParams(raw.replace(/^[?#]/, ''));
}

export async function processGoogleCallback(
  search: string,
  deps: GoogleCallbackDeps,
): Promise<GoogleCallbackResult> {
  const params = parseOAuthParams(search);
  const token = params.get('token');
  const refreshToken = params.get('refreshToken');

  if (!token || !refreshToken) {
    throw new Error('Missing token from Google OAuth');
  }

  deps.setTokens(token, refreshToken);

  let profileLoaded = false;
  try {
    await deps.loadProfile();
    profileLoaded = true;
  } catch {
    profileLoaded = false;
  }

  return {
    ok: true,
    profileLoaded,
  };
}
