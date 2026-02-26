import { AbstractComponent } from '../core/Component';
import AuthService from '../services/AuthService';

/**
 * GoogleOAuthCallbackPage - Handles Google OAuth redirect
 * Backend redirects here with token in URL: /?token=xxx&refreshToken=yyy
 */
export class GoogleOAuthCallbackPage extends AbstractComponent {
  constructor() {
    super('div', 'w-full h-screen flex items-center justify-center bg-gray-900');
  }

  public async render(): Promise<void> {
    // Display loading message
    const message = document.createElement('div');
    message.className = 'text-center text-white';
    message.innerHTML = `
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
      <p class="text-lg">Completing authentication...</p>
    `;
    this.element.appendChild(message);

    try {
      // Handle the OAuth callback - extracts token from URL and stores it
      await AuthService.handleGoogleCallback();
      
      // handleGoogleCallback redirects to home page on success
      // This code won't be reached
    } catch (error: any) {
      // Show error message
      message.innerHTML = `
        <div class="bg-red-900 text-white px-6 py-4 rounded-lg max-w-md">
          <h2 class="text-xl font-bold mb-2">Authentication Failed</h2>
          <p class="mb-4">Google login encountered an error. Please try again.</p>
          <a href="/login" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg inline-block">
            Back to Login
          </a>
        </div>
      `;
      console.error('Google OAuth callback failed:', error);
    }
  }
}
