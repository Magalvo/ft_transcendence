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
  private show2FAModal: boolean = false;

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
      enableWebcam: false,
      bloomIntensity: 1.5
    });
    
    background.render();
    this.element.appendChild(background.getElement());

    // Login/Register Card
    const card = new Card('w-full max-w-md bg-white/10 backdrop-blur-sm');

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
    }

    card.getElement().appendChild(this.passwordInput.getElement());

    // Forgot password link (login mode only)
    if (!this.isRegisterMode) {
      const forgotLink = document.createElement('div');
      forgotLink.className = 'flex justify-end mb-6';
      const link = document.createElement('a');
      link.href = 'javascript:void(0)';
      link.className = 'text-sm text-indigo-400 hover:text-indigo-300 font-medium';
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
      (e) => this.handleSubmit(e),
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
    toggleLink.className = 'text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer';
    toggleLink.innerText = this.isRegisterMode ? 'Sign in' : 'Sign up';
    toggleLink.onclick = () => this.toggleMode();

    toggleDiv.appendChild(toggleLink);
    card.getElement().appendChild(toggleDiv);

    this.element.appendChild(card.getElement());
  }

  private renderSocialLogin(card: Card): void {
    const divider = document.createElement('div');
    divider.className = 'relative mt-6 mb-6';
    divider.innerHTML = `
      <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-500"></div></div>
      <div class="relative flex justify-center text-sm"><span class="px-2 bg-transparent text-gray-400">Or continue with</span></div>
    `;
    card.getElement().appendChild(divider);

    const socialContainer = document.createElement('div');
    socialContainer.className = 'grid grid-cols-1 gap-3';
    
    const googleBtn = document.createElement('button');
    googleBtn.className = 'w-full flex items-center justify-center px-4 py-2 border border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-900/50 hover:bg-gray-800/50 focus:outline-none transition';
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

  private async handleSubmit(e: Event): Promise<void> {
    if (e) e.preventDefault();

    const username = this.usernameInput.getValue();
    const password = this.passwordInput.getValue();
    
    let isValid = true;
    
    if (!username || username.length < 5) {
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
    }

    if (!isValid) return;

    try {
      if (this.isRegisterMode) {
        const email = this.emailInput.getValue();
        await AuthService.register({ username, password, email });
        
        // Show success message and redirect
        this.showSuccessMessage('Registration successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        await AuthService.login(username, password);
        
        // Check if 2FA is enabled (if login doesn't throw error, 2FA not required)
        this.showSuccessMessage('Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (error: any) {
      console.error('Auth Error:', error);
      
      // Handle specific error types
      if (error.response?.status === 409) {
        this.usernameInput.setError(true);
        alert('Username or email already exists');
      } else if (error.response?.status === 401) {
        this.usernameInput.setError(true);
        this.passwordInput.setError(true);
        alert('Invalid credentials');
      } else if (error.response?.status === 400) {
        if (error.response.data.error.includes('2FA')) {
          this.show2FAModal = true;
          this.render2FAModal();
        } else {
          alert(`Error: ${error.response.data.error}`);
        }
      } else {
        alert('Authentication failed. Please try again.');
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
      () => {
        this.showSuccessMessage('2FA verified! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      },
      () => {
        this.show2FAModal = false;
        this.render();
      }
    );
    
    twoFAPage.render();
    this.element.appendChild(twoFAPage.getElement());
  }

  private showSuccessMessage(message: string): void {
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg';
    successDiv.innerText = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => successDiv.remove(), 30000);
  }
}