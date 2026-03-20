import { ApiClient } from "./ApiClient.ts";
import { TokenManager } from "./TokenManager.ts";
import { UserService } from "./UserService.ts";
import { API_URL } from "./RuntimeConfig.ts";
import userRegister from "../interfaces/userRegister.ts";
import {
  processGoogleCallback,
  type GoogleCallbackResult,
} from "./OAuthCallbackService.ts";

interface LoginResponse {
  token?: string;
  refreshToken?: string;
  twoFactorRequired?: boolean;
  username?: string;
  password?: string;
}

interface RegisterResponse {
  token: string;
  refreshToken: string;
  message: string;
}

interface TwoFASetupResponse {
  qr: string;
  secret: string;
  message: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  online: boolean;
}

export class AuthService {
  private apiUrl = API_URL;
  private pendingTwoFactorCredentials: { username: string; password: string } | null = null;

  /**
   * Login with username and password
   * Returns { token, refreshToken } on success
   * Returns { twoFactorRequired: true, username, password } if 2FA needed
   * Throws error on failure
   */
  async login(
    username: string,
    password: string,
    twoFactorCode?: string,
  ): Promise<LoginResponse> {
    try {
      const response = await ApiClient.post("/api/auth/login", {
        username,
        password,
        ...(twoFactorCode && { twoFactorCode }),
      });

      if (response.status === 200 && response.data.success) {
        const { token, refreshToken } = response.data.data;
        TokenManager.setTokens(token, refreshToken, 1); // 1 hour expiration

        // Fetch and populate user data
        try {
          const userProfile = await UserService.getProfile();
          console.log("User profile loaded:", userProfile.username);
        } catch (profileError) {
          console.warn(
            "Failed to load user profile after login:",
            profileError,
          );
          // Don't throw - allow login to succeed even if profile fetch fails
        }

        return response.data.data;
      }

      throw new Error("Invalid login response");
    } catch (error: any) {
      // Handle 2FA required (400 status with specific error message)
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error || "";
        if (errorMsg.includes("2FA") || errorMsg.includes("2FA code")) {
          // Store credentials for the pending 2FA verification step
          this.pendingTwoFactorCredentials = { username, password };
          return {
            twoFactorRequired: true,
            username,
            password,
          };
        }
      }

      const errorMsg = this.handleError(error, "Login failed");
      if (error?.response) {
        error.message = errorMsg;
        throw error;
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Register new user
   */
  async register({
    username,
    email,
    password,
    acceptTerms,
  }: userRegister): Promise<RegisterResponse> {
    try {
      const response = await ApiClient.post("/api/auth/register", {
        username,
        email,
        password,
        acceptTerms,
      });

      if (response.status === 201 && response.data.success) {
        const { token, refreshToken } = response.data.data;
        TokenManager.setTokens(token, refreshToken, 1); // 1 hour expiration

        // Fetch and populate user data
        try {
          const userProfile = await UserService.getProfile();
          console.log("New user profile loaded:", userProfile.username);
        } catch (profileError) {
          console.warn(
            "Failed to load user profile after registration:",
            profileError,
          );
          // Don't throw - allow registration to succeed even if profile fetch fails
        }

        return response.data.data;
      }

      throw new Error("Invalid register response");
    } catch (error: any) {
      const errorMsg = this.handleError(error, "Registration failed");
      if (error?.response) {
        error.message = errorMsg;
        throw error;
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Setup Two-Factor Authentication
   * Returns QR code and secret for authenticator app
   */
  async setup2FA(): Promise<TwoFASetupResponse> {
    try {
      const response = await ApiClient.post("/api/auth/2fa/setup", {});

      if (response.status === 200 && response.data.success) {
        return response.data.data;
      }

      throw new Error("Failed to setup 2FA");
    } catch (error: any) {
      this.handleError(error, "2FA setup failed");
      throw error;
    }
  }

  /**
   * Verify Two-Factor Authentication code
   */
  async verify2FA(code: string): Promise<{ message: string }> {
    try {
      if (!this.pendingTwoFactorCredentials) {
        throw new Error("No pending 2FA login session");
      }

      const { username, password } = this.pendingTwoFactorCredentials;

      // Re-use the login endpoint with the 2FA code to complete authentication
      await this.login(username, password, code);

      // Clear pending credentials once 2FA succeeds
      this.pendingTwoFactorCredentials = null;

      return { message: "2FA verified" };
    } catch (error: any) {
      const errorMsg = this.handleError(error, "2FA verification failed");
      if (error?.response) {
        error.message = errorMsg;
        throw error;
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Verify 2FA code during setup (enabling 2FA in profile settings)
   */
  async verify2FASetup(code: string): Promise<{ message: string }> {
    try {
      const response = await ApiClient.post("/api/auth/2fa/verify", { code });

      if (response.status === 200 && response.data.success) {
        return response.data.data;
      }

      throw new Error("Invalid 2FA code");
    } catch (error: any) {
      const errorMsg = this.handleError(error, "2FA verification failed");
      if (error?.response) {
        error.message = errorMsg;
        throw error;
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Disable Two-Factor Authentication on the account
   */
  async disable2FA(): Promise<{ message: string }> {
    try {
      const response = await ApiClient.post("/api/auth/2fa/disable", {});

      if (response.status === 200 && response.data.success) {
        return response.data.data;
      }

      throw new Error("Failed to disable 2FA");
    } catch (error: any) {
      const errorMsg = this.handleError(error, "Failed to disable 2FA");
      if (error?.response) {
        error.message = errorMsg;
        throw error;
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Request password reset email
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      const response = await ApiClient.post("/api/auth/forgot", { email });

      if (response.status === 200 && response.data.success) {
        return response.data.data;
      }

      throw new Error("Failed to send reset email");
    } catch (error: any) {
      this.handleError(error, "Password reset request failed");
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      const response = await ApiClient.post("/api/auth/reset-password", {
        resetToken,
        newPassword,
      });

      if (response.status === 200 && response.data.success) {
        return response.data.data;
      }

      throw new Error("Failed to reset password");
    } catch (error: any) {
      this.handleError(error, "Password reset failed");
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await ApiClient.get("/api/auth/me");

      if (response.status === 200) {
        const user = response.data; // Note: /me endpoint returns user directly
        TokenManager.setUser(user);
        return user;
      }

      throw new Error("Failed to fetch user profile");
    } catch (error: any) {
      this.handleError(error, "Failed to fetch user profile");
      throw error;
    }
  }

  /**
   * Refresh user profile data (force refresh from server)
   */
  async refreshUserProfile(): Promise<User> {
    try {
      const response = await ApiClient.get("/api/auth/me");
      if (response.status === 200 && response.data) {
        TokenManager.setUser(response.data);
        TokenManager.refreshUserCacheTime();
        return response.data;
      }
      throw new Error("Failed to refresh user profile");
    } catch (error: any) {
      const errorMsg = this.handleError(
        error,
        "Failed to refresh user profile",
      );
      throw new Error(errorMsg);
    }
  }

  /**
   * Get current user with cache awareness
   * Returns cached user if cache is valid, null if cache expired or no user
   */
  getCachedUser(): User | null {
    if (TokenManager.isUserCacheExpired()) {
      return null;
    }
    return TokenManager.getUser();
  }

  /**
   * Refresh access token
   */
  async refreshToken(): Promise<{ token: string }> {
    try {
      const refreshToken = TokenManager.getRefreshToken();
      const response = await ApiClient.post("/api/auth/token/refresh", {
        refreshToken,
      });

      if (response.status === 200 && response.data.success) {
        const { token } = response.data.data;
        if (refreshToken) {
          TokenManager.setTokens(token, refreshToken, 1);
        }
        return response.data.data;
      }

      throw new Error("Failed to refresh token");
    } catch (error: any) {
      this.handleError(error, "Token refresh failed");
      throw error;
    }
  }

  /**
   * Logout - clear tokens and invalidate on server
   */
  async logout(): Promise<void> {
    // Best-effort backend logout; ignore errors so client cleanup always runs
    try {
      await ApiClient.post("/api/auth/logout");
    } catch {
      // Non-fatal – network issues or missing endpoint should not block client logout
    }
    TokenManager.clearTokens();
    window.location.href = "/login";
  }

  /**
   * Redirect to Google OAuth login
   */
  loginWithGoogle(): void {
    window.location.href = `${this.apiUrl}/api/auth/google/login`;
  }

  /**
   * Handle Google OAuth callback (called from URL params)
   * Expected URL: /login?token=xxx&refreshToken=yyy
   */
  async handleGoogleCallback(): Promise<GoogleCallbackResult> {
    try {
      const result = await processGoogleCallback(window.location.search, {
        setTokens: (token, refreshToken) =>
          TokenManager.setTokens(token, refreshToken, 1),
        loadProfile: async () => {
          await UserService.getProfile();
          console.log("Google OAuth: User profile loaded");
        },
      });

      if (!result.profileLoaded) {
        console.warn("Failed to load user profile from Google callback");
      }

      return result;
    } catch (error: any) {
      console.error("Google OAuth callback failed:", error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return TokenManager.isAuthenticated();
  }

  /**
   * Get stored user data
   */
  getStoredUser(): User | null {
    return TokenManager.getUser();
  }

  /**
   * Check if token is expiring soon (within 5 minutes)
   */
  isTokenExpiringSoon(): boolean {
    return TokenManager.getTimeUntilExpiry() < 300; // 5 minutes
  }

  /**
   * Get seconds until token expires
   */
  getTokenExpiryTime(): number {
    return TokenManager.getTimeUntilExpiry();
  }

  /**
   * Redirect to home page after successful authentication
   */
  redirectToHomePage(token: string, refreshToken: string): void {
    TokenManager.setTokens(token, refreshToken, 1); // 1 hour expiry
    window.location.href = "/";
  }

  /**
   * Handle API errors and return user-friendly messages
   */
  private handleError(error: any, defaultMessage: string): string {
    let message = defaultMessage;

    if (error.response?.status === 409) {
      message =
        error.response?.data?.error || "Username or email already exists";
    } else if (error.response?.status === 401) {
      message = error.response?.data?.error || "Invalid credentials";
    } else if (error.response?.status === 400) {
      message = error.response?.data?.error || "Bad request";
    } else if (error.response?.status === 404) {
      message = error.response?.data?.error || "User not found";
    } else if (error.response?.status === 500) {
      message = error.response?.data?.error || "Server error";
    } else if (error.message === "Network Error") {
      message = "Network connection failed";
    }

    console.error(`[Auth Error] ${message}`, error);
    return message;
  }

  /**
   * Parse and validate email
   */
  parseEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Clear any pending 2FA login credentials (e.g. when user cancels)
   */
  clearPendingTwoFactor(): void {
    this.pendingTwoFactorCredentials = null;
  }
}

export default new AuthService();
