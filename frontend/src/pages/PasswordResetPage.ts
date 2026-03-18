import { AbstractComponent } from '../core/Component';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import AuthService from '../services/AuthService';
import { t } from '../services/I18nService';

/**
 * PasswordReset
 * URL: /reset-password?token=xxx
 */
export class PasswordResetPage extends AbstractComponent {
  private passwordInput: Input;
  private confirmPasswordInput: Input;
  private resetToken: string | null;
  private statusMessage = '';
  private statusType: 'error' | 'success' | null = null;
  private isSubmitting = false;

  constructor() {
    super('section', 'w-full h-screen flex justify-center items-center bg-gray-900 p-4');
    
    this.resetToken = new URLSearchParams(window.location.search).get('token');
    this.passwordInput = new Input(
      t('reset.password.placeholder'),
      'password',
      t('reset.password.label')
    );
    this.confirmPasswordInput = new Input(
      t('reset.confirm.placeholder'),
      'password',
      t('reset.confirm.label')
    );
  }

  public render(): void {
    this.element.innerHTML = '';

    if (!this.resetToken) {
      const errorCard = new Card('w-full max-w-md space-y-4 bg-red-900 p-6');
      const title = document.createElement('h2');
      title.className = 'text-2xl font-bold text-center text-white';
      title.innerText = t('reset.invalid.title');

      const message = document.createElement('p');
      message.className = 'text-center text-gray-200';
      message.innerText = t('reset.invalid.message');

      const backButton = new Button(t('reset.actions.backToLogin'), () => {
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
    title.innerText = t('reset.title');

    const description = document.createElement('p');
    description.className = 'text-center text-gray-400 text-sm';
    description.innerText = t('reset.description');

    const submitButton = new Button(
      this.isSubmitting ? t('reset.actions.submitting') : t('reset.actions.submit'),
      () => this.handleReset()
    );
    submitButton.getElement().toggleAttribute('disabled', this.isSubmitting);

    const backButton = new Button(t('reset.actions.backToLogin'), () => {
      window.location.href = '/login';
    }, 'secondary');
    backButton.getElement().toggleAttribute('disabled', this.isSubmitting);

    card.addChildren(
      submitButton,
      backButton
    );
    
    card.getElement().appendChild(this.passwordInput.getElement());
    card.getElement().appendChild(this.confirmPasswordInput.getElement());

    if (this.statusMessage) {
      const status = document.createElement('p');
      status.className =
        this.statusType === 'success'
          ? 'text-sm text-emerald-400'
          : 'text-sm text-red-400';
      status.innerText = this.statusMessage;
      card.getElement().appendChild(status);
    }

    card.getElement().prepend(description);
    card.getElement().prepend(title);

    this.element.appendChild(card.getElement());
  }

  private async handleReset(): Promise<void> {
    if (this.isSubmitting) return;

    this.statusMessage = '';
    this.statusType = null;

    const password = this.passwordInput.getValue();
    const confirmPassword = this.confirmPasswordInput.getValue();

    let isValid = true;

    if (!password || password.length < 8) {
      this.passwordInput.setError(true);
      this.statusMessage = t('reset.validation.passwordLength');
      this.statusType = 'error';
      isValid = false;
    } else {
      this.passwordInput.setError(false);
    }

    if (password !== confirmPassword) {
      this.confirmPasswordInput.setError(true);
      this.statusMessage = t('reset.validation.passwordMismatch');
      this.statusType = 'error';
      isValid = false;
    } else {
      this.confirmPasswordInput.setError(false);
    }

    if (!isValid) {
      this.render();
      return;
    }

    this.isSubmitting = true;
    this.render();

    try {
      await AuthService.resetPassword(this.resetToken!, password);

      this.statusType = 'success';
      this.statusMessage = t('reset.success');
      this.render();

      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      this.statusType = 'error';
      this.statusMessage = error.response?.data?.error || t('reset.error');
      this.render();
      console.error('Password reset failed:', error);
    } finally {
      this.isSubmitting = false;
    }
  }
}
