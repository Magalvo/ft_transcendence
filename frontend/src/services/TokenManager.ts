/**
 * TokenManager - Centralized token management
 * Handles token storage, retrieval, and expiration checking
 */

export class TokenManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private static readonly EXPIRES_AT_KEY = 'token_expires_at';
  private static readonly USER_KEY = 'user_data';
  private static readonly USER_CACHE_KEY = 'user_data_cache_time';
  private static readonly USER_CACHE_EXPIRY_SECONDS = 300; // 5 minutes
  private static readonly AUTH_STATE_CHANGED_EVENT = 'auth-state-changed';
  private static readonly AUTH_STORAGE_KEYS = new Set<string>([
    TokenManager.TOKEN_KEY,
    TokenManager.REFRESH_TOKEN_KEY,
    TokenManager.EXPIRES_AT_KEY,
    TokenManager.USER_KEY,
    TokenManager.USER_CACHE_KEY,
  ]);

  /**
   * Store tokens (typically called after successful login/register)
   * Note: In production, tokens should be in httpOnly cookies
   * We use localStorage as fallback for SPA development
   */
  static setTokens(token: string, refreshToken: string, expiresInHours: number = 1): void {
    const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
    
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(this.EXPIRES_AT_KEY, expiresAt.toString());
    } catch (e) {
      console.warn('localStorage unavailable, tokens not persisted:', e);
    }

    this.dispatchAuthStateChanged();
  }

  /**
   * Get current access token from localStorage or cookies
   */
  static getAccessToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch (e) {
      console.warn('Cannot access localStorage');
      return null;
    }
  }

  /**
   * Get refresh token from localStorage or cookies
   */
  static getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (e) {
      console.warn('Cannot access localStorage');
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(): boolean {
    try {
      const expiresAt = localStorage.getItem(this.EXPIRES_AT_KEY);
      if (!expiresAt) return true;
      return Date.now() > parseInt(expiresAt);
    } catch (e) {
      console.warn('Cannot check token expiry');
      return true; // Assume expired if can't check
    }
  }

  /**
   * Get time until token expires (in seconds)
   */
  static getTimeUntilExpiry(): number {
    try {
      const expiresAt = localStorage.getItem(this.EXPIRES_AT_KEY);
      if (!expiresAt) return 0;
      const secondsRemaining = (parseInt(expiresAt) - Date.now()) / 1000;
      return Math.max(0, secondsRemaining);
    } catch (e) {
      console.warn('Cannot get token expiry time');
      return 0;
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return !!(token && !this.isTokenExpired());
  }

  /**
   * Store user data
   */
  static setUser(user: any): void {
    try {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      localStorage.setItem(this.USER_CACHE_KEY, Date.now().toString());
    } catch (e) {
      console.warn('Cannot store user data:', e);
    }
  }

  /**
   * Get stored user data
   */
  static getUser(): any {
    try {
      const userData = localStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      console.warn('Cannot retrieve user data:', e);
      return null;
    }
  }

  /**
   * Clear all auth data (logout)
   */
  static clearTokens(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.EXPIRES_AT_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.USER_CACHE_KEY);
    } catch (e) {
      console.warn('Cannot clear tokens:', e);
    }

    this.dispatchAuthStateChanged();
  }

  /**
   * Check if user cache has expired
   */
  static isUserCacheExpired(): boolean {
    try {
      const cacheTime = localStorage.getItem(this.USER_CACHE_KEY);
      if (!cacheTime) return true;

      const cacheAge = (Date.now() - parseInt(cacheTime)) / 1000;
      return cacheAge > this.USER_CACHE_EXPIRY_SECONDS;
    } catch (e) {
      return true;
    }
  }

  /**
   * Get seconds until user cache expires
   */
  static getUserCacheTimeRemaining(): number {
    try {
      const cacheTime = localStorage.getItem(this.USER_CACHE_KEY);
      if (!cacheTime) return 0;

      const cacheAge = (Date.now() - parseInt(cacheTime)) / 1000;
      return Math.max(0, this.USER_CACHE_EXPIRY_SECONDS - cacheAge);
    } catch (e) {
      return 0;
    }
  }

  /**
   * Refresh user data cache
   */
  static refreshUserCacheTime(): void {
    try {
      localStorage.setItem(this.USER_CACHE_KEY, Date.now().toString());
    } catch (e) {
      console.warn('Cannot refresh user cache timestamp:', e);
    }
  }

  /**
   * Get Authorization header value
   */
  static getAuthHeader(): string | null {
    const token = this.getAccessToken();
    return token ? `Bearer ${token}` : null;
  }

  /**
   * Check if localStorage is available
   */
  static isLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  static getAuthStateChangedEventName(): string {
    return this.AUTH_STATE_CHANGED_EVENT;
  }

  static isAuthStorageKey(key: string | null): boolean {
    return key !== null && this.AUTH_STORAGE_KEYS.has(key);
  }

  private static dispatchAuthStateChanged(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const detail = {
      authenticated: this.isAuthenticated(),
      token: this.getAccessToken(),
    };

    window.dispatchEvent(
      new CustomEvent(this.AUTH_STATE_CHANGED_EVENT, {
        detail,
      }),
    );
  }
}
