import { AbstractComponent } from '../core/Component';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import AuthService from '../services/AuthService';
import { TwoFactorPage } from './TwoFactorPage';
import { GridScanWrapper } from '../components/ui/GridScanWrapper';

/**
 * LoginPage - Main authentication page for login/register
 * Handles both login and registration modes
 * Integrates with 2FA flow
 */
export class LoginPage extends AbstractComponent {
  private isRegisterMode: boolean = false;
  private usernameInput: Input;
  private passwordInput: Input;
  private emailInput: Input;

  // track if user checked "accept terms"
  private acceptTermsChecked: boolean = false;

  constructor() {
    super('section', 'w-full h-screen flex justify-center items-center relative overflow-hidden');

    this.usernameInput = new Input('Username', 'text', 'Username');
    this.passwordInput = new Input('Password', 'password', 'Password');
    this.emailInput = new Input('Email', 'email', 'Email Address');
  }

  public render(): void {
    this.element.innerHTML = '';

    // Background animation
    const background = new GridScanWrapper({
      enableWebcam: true,
      bloomIntensity: 1.5
    });

    background.render();
    this.element.appendChild(background.getElement());

    // Login/Register Card
    const card = new Card('w-full max-w-md bg-white/10 backdrop-blur-sm relative z-10');

    const header = document.createElement('div');
    header.className = 'text-center mb-8';
    header.innerHTML = `
      <h2 class="text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 leading-normal inline-block">
        Pong Game
      </h2>
      <p class="text-gray-400 mt-4">
        ${this.isRegisterMode ? 'Create an account to join the arena' : 'Sign in to access the arena'}
      </p>
    `;
    card.getElement().appendChild(header);

    // Form inputs
    this.usernameInput.render();
    this.passwordInput.render();
    card.getElement().appendChild(this.usernameInput.getElement());

    if (this.isRegisterMode) {
      this.emailInput.render();
      card.getElement().appendChild(this.emailInput.getElement());

      // terms & privacy checkbox + links
      const termsDiv = document.createElement('div');
      termsDiv.className = 'flex items-center mb-4 text-sm text-gray-300';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'acceptTerms';
      checkbox.className = 'mr-2 cursor-pointer';
      checkbox.onclick = () => { this.acceptTermsChecked = checkbox.checked; };
      const label = document.createElement('label');
      label.htmlFor = 'acceptTerms';
      label.className = 'cursor-pointer';
      label.innerHTML = `I accept the <a href="/terms" target="_blank" class="text-indigo-400 hover:text-indigo-300 underline transition">Terms</a> and <a href="/privacy" target="_blank" class="text-indigo-400 hover:text-indigo-300 underline transition">Privacy Policy</a>`;
      
      termsDiv.appendChild(checkbox);
      termsDiv.appendChild(label);
      card.getElement().appendChild(termsDiv);
    }

    card.getElement().appendChild(this.passwordInput.getElement());

    // Forgot password link (login mode only)
    if (!this.isRegisterMode) {
      const forgotLink = document.createElement('div');
      forgotLink.className = 'flex justify-end mb-6';
      const link = document.createElement('a');
      link.href = 'javascript:void(0)';
      link.className = 'text-sm text-indigo-400 hover:text-indigo-300 font-medium transition';
      link.innerText = 'Forgot password?';
      link.onclick = (e) => {
        e.preventDefault();
        this.handleForgotPassword();
      };
      forgotLink.appendChild(link);
      card.getElement().appendChild(forgotLink);
    }

    // Main action button
    const actionBtn = new Button(
      this.isRegisterMode ? 'Sign Up' : 'Sign In',
      () => { void this.handleSubmit(); },
      'primary'
    );
    actionBtn.getElement().classList.add('w-full', 'mb-4');
    card.addChildren(actionBtn);

    // Social login
    this.renderSocialLogin(card);

    // Toggle mode
    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'mt-6 text-center text-sm text-gray-400';
    toggleDiv.innerText = this.isRegisterMode ? "Already have an account? " : "Don't have an account? ";

    const toggleLink = document.createElement('span');
    toggleLink.className = 'text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition';
    toggleLink.innerText = this.isRegisterMode ? 'Sign in' : 'Sign up';
    toggleLink.onclick = () => this.toggleMode();

    toggleDiv.appendChild(toggleLink);
    card.getElement().appendChild(toggleDiv);

    if (!this.isRegisterMode) {
      const legalFooter = document.createElement('div');
      legalFooter.className = 'mt-6 pt-4 border-t border-gray-700/50 flex justify-center gap-4 text-xs text-gray-500';
      legalFooter.innerHTML = `
        <a href="/terms" target="_blank" class="hover:text-gray-300 transition">Terms</a>
        <span>•</span>
        <a href="/privacy" target="_blank" class="hover:text-gray-300 transition">Privacy Policy</a>
      `;
      card.getElement().appendChild(legalFooter);
    }

    this.element.appendChild(card.getElement());
  }

  private renderSocialLogin(card: Card): void {
    const divider = document.createElement('div');
    divider.className = 'relative mt-6 mb-6';
    divider.innerHTML = `
      <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-600/50"></div></div>
      <div class="relative flex justify-center text-sm"><span class="px-2 bg-[#111] text-gray-400">Or continue with</span></div>
    `;
    card.getElement().appendChild(divider);

    const socialContainer = document.createElement('div');
    socialContainer.className = 'grid grid-cols-1 gap-3';

    const googleBtn = document.createElement('button');
    googleBtn.className = 'w-full flex items-center justify-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-900/50 hover:bg-gray-800 focus:outline-none transition';
    googleBtn.innerHTML = `
      <svg class="h-5 w-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Google
    `;
    googleBtn.onclick = (e) => {
      e.preventDefault();
      AuthService.loginWithGoogle();
    };

    socialContainer.appendChild(googleBtn);
    card.getElement().appendChild(socialContainer);
  }

  private toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.render();
  }

  private async handleSubmit(e?: Event): Promise<void> {
    if (e) e.preventDefault();

    const username = this.usernameInput.getValue();
    const password = this.passwordInput.getValue();

    let isValid = true;

    if (!username || username.length < 3 || username.length > 20) {
      this.usernameInput.setError(true);
      isValid = false;
    } else {
      this.usernameInput.setError(false);
    }

    if (!password || password.length < 8) {
      this.passwordInput.setError(true);
      isValid = false;
    } else {
      this.passwordInput.setError(false);
    }

    if (this.isRegisterMode) {
      const email = this.emailInput.getValue();
      if (!AuthService.parseEmail(email)) {
        this.emailInput.setError(true);
        isValid = false;
      } else {
        this.emailInput.setError(false);
      }

      if (!this.acceptTermsChecked) {
        alert('You must accept the terms and privacy policy to register.');
        isValid = false;
      }
    }

    if (!isValid) return;

    try {
      if (this.isRegisterMode) {
        const email = this.emailInput.getValue();
        await AuthService.register({ username, password, email, acceptTerms: this.acceptTermsChecked });
        this.showSuccessMessage('Registration successful! Loading profile...');

        // Wait a bit for profile fetch to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        window.location.href = '/';
      } else {
        const loginResult = await AuthService.login(username, password);

        // Check if 2FA is required
        if (loginResult.twoFactorRequired) {
          this.render2FAModal();
        } else {
          // Login successful - wait for user profile to be fully loaded
          this.showSuccessMessage('Login successful! Loading profile...');

          // Wait a bit for profile fetch to complete
          await new Promise(resolve => setTimeout(resolve, 500));

          window.location.href = '/';
        }
      }
    } catch (error: any) {
      console.error('Auth Error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Authentication failed. Please try again.';

      // Handle specific error types
      if (error.response?.status === 409) {
        this.usernameInput.setError(true);
        alert(errorMessage);
      } else if (error.response?.status === 401) {
        this.usernameInput.setError(true);
        this.passwordInput.setError(true);
        alert(errorMessage);
      } else if (error.response?.status === 400) {
        if ((error.response?.data?.error || '').includes('2FA')) {
          this.render2FAModal();
        } else {
          alert(`Error: ${errorMessage}`);
        }
      } else {
        alert(errorMessage);
      }
    }
  }

  private async handleForgotPassword(): Promise<void> {
    const email = prompt('Enter your email address:');

    if (!email) return;

    if (!AuthService.parseEmail(email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      await AuthService.forgotPassword(email);
      alert('Password reset email sent! Check your inbox.');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to send reset email';
      alert(errorMsg);
    }
  }

  private render2FAModal(): void {
    const twoFAPage = new TwoFactorPage(
      async () => {
        this.showSuccessMessage('2FA verified! Redirecting...');

        // Give user time to see the message, then redirect
        await new Promise(resolve => setTimeout(resolve, 2000));
        window.location.href = '/';
      },
      () => {
        this.render();
      }
    );

    twoFAPage.render();
    this.element.appendChild(twoFAPage.getElement());
  }

  private showSuccessMessage(message: string): void {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    successDiv.innerText = message;
    document.body.appendChild(successDiv);

    setTimeout(() => successDiv.remove(), 3000);
  }
}
