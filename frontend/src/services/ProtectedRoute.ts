import AuthService from '../services/AuthService';
import { TokenManager } from './TokenManager';

/**
 * ProtectedRoute - Guard for authenticated routes
 * Redirects to login if user is not authenticated
 */
export class ProtectedRoute {
  static canAccess(): boolean {
    return AuthService.isAuthenticated();
  }

  /**
   * Get current user or redirect to login
   */
  static async getCurrentUser() {
    if (!this.canAccess()) {
      window.location.href = '/login';
      return null;
    }

    return TokenManager.getUser();
  }

  /**
   * Ensure user is authenticated before proceeding
   * Used in route guards
   */
  static ensureAuthenticated(): void {
    if (!this.canAccess()) {
      window.location.href = '/login';
    }
  }

  /**
   * Ensure user is NOT authenticated (for login/register pages)
   */
  static ensureNotAuthenticated(): void {
    if (this.canAccess()) {
      window.location.href = '/';
    }
  }

  /**
   * Check if token is expiring soon (within 5 minutes)
   */
  static isTokenExpiringsoon(): boolean {
    const timeRemaining = TokenManager.getTimeUntilExpiry();
    return timeRemaining < 300; // 5 minutes in seconds
  }

  /**
   * Show expiration warning
   */
  static showExpirationWarning(): void {
    if (this.isTokenExpiringsoon()) {
      const warning = document.createElement('div');
      warning.className = 'fixed top-4 left-4 bg-yellow-500 text-white px-4 py-3 rounded-lg';
      warning.innerHTML = `
        <p class="font-semibold">Session Expiring Soon</p>
        <p class="text-sm">Your session will expire in ${Math.round(TokenManager.getTimeUntilExpiry())} seconds</p>
      `;
      document.body.appendChild(warning);
      setTimeout(() => warning.remove(), 30000);
    }
  }
}
