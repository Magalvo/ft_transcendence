import { AbstractComponent } from '../core/Component';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import AuthService from '../services/AuthService';

/**
 * PasswordReset
 * URL: /reset-password?token=xxx
 */
export class PasswordResetPage extends AbstractComponent {
  private passwordInput: Input;
  private confirmPasswordInput: Input;
  private resetToken: string | null;

  constructor() {
    super('section', 'w-full h-screen flex justify-center items-center bg-gray-900 p-4');
    
    this.resetToken = new URLSearchParams(window.location.search).get('token');
    this.passwordInput = new Input('New password', 'password', 'Password');
    this.confirmPasswordInput = new Input('Confirm password', 'password', 'Confirm Password');
  }

  public render(): void {
    this.element.innerHTML = '';

    if (!this.resetToken) {
      const errorCard = new Card('w-full max-w-md space-y-4 bg-red-900 p-6');
      const title = document.createElement('h2');
      title.className = 'text-2xl font-bold text-center text-white';
      title.innerText = 'Invalid Reset Link';

      const message = document.createElement('p');
      message.className = 'text-center text-gray-200';
      message.innerText = 'The password reset link is invalid or has expired. Please request a new one.';

      const backButton = new Button('Back to Login', () => {
        window.location.href = '/login';
      });

      errorCard.addChildren(backButton);
      errorCard.getElement().appendChild(title);
      errorCard.getElement().appendChild(message);
      this.element.appendChild(errorCard.getElement());
      return;
    }

    const card = new Card('w-full max-w-md space-y-6 bg-gray-800 p-8');

    const title = document.createElement('h2');
    title.className = 'text-3xl font-bold text-center text-white';
    title.innerText = 'Reset Password';

    const description = document.createElement('p');
    description.className = 'text-center text-gray-400 text-sm';
    description.innerText = 'Enter your new password below';

    const submitButton = new Button('Reset Password', () => this.handleReset());
    const backButton = new Button('Back to Login', () => {
      window.location.href = '/login';
    }, 'secondary');

    card.addChildren(
      submitButton,
      backButton
    );
    
    card.getElement().appendChild(this.passwordInput.getElement());
    card.getElement().appendChild(this.confirmPasswordInput.getElement());
    card.getElement().prepend(description);
    card.getElement().prepend(title);

    this.element.appendChild(card.getElement());
  }

  private async handleReset(): Promise<void> {
    const password = this.passwordInput.getValue();
    const confirmPassword = this.confirmPasswordInput.getValue();

    let isValid = true;

    if (!password || password.length < 8) {
      this.passwordInput.setError(true);
      isValid = false;
    } else {
      this.passwordInput.setError(false);
    }

    if (password !== confirmPassword) {
      this.confirmPasswordInput.setError(true);
      isValid = false;
    } else {
      this.confirmPasswordInput.setError(false);
    }

    if (!isValid) return;

    try {
      await AuthService.resetPassword(this.resetToken!, password);
      
      // Success - redirect para login
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg';
      successMessage.innerText = 'Password reset successfully! Redirecting...';
      document.body.appendChild(successMessage);

      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to reset password';
      alert(errorMessage);
      console.error('Password reset failed:', error);
    }
  }
}
