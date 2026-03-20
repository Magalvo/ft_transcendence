export interface GoogleCallbackResult {
  ok: boolean;
  profileLoaded: boolean;
}

export interface GoogleCallbackDeps {
  setTokens: (token: string, refreshToken: string) => void;
  loadProfile: () => Promise<unknown>;
}

export async function processGoogleCallback(
  search: string,
  deps: GoogleCallbackDeps,
): Promise<GoogleCallbackResult> {
  const params = new URLSearchParams(search);
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
