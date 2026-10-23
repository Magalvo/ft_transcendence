import { AbstractComponent } from '../core/Component';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import AuthService from '../services/AuthService';
import { t } from '../services/I18nService';

export class TwoFactorPage extends AbstractComponent {
  private codeInput: Input;
  private onSuccess: () => void;
  private onCancel: () => void;

  constructor(onSuccess: () => void, onCancel: () => void) {
    super(
      'div',
      'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    );
    this.onSuccess = onSuccess;
    this.onCancel = onCancel;
    this.codeInput = new Input(
      t('auth.2fa.codePlaceholder'),
      'text',
      t('auth.2fa.codeLabel')
    );
  }

  public render(): void {
    this.element.innerHTML = '';

    const card = new Card('w-full max-w-md space-y-6 bg-gray-900 p-8');

    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold text-center text-white';
    title.innerText = t('auth.2fa.title');

    const description = document.createElement('p');
    description.className = 'text-center text-gray-400';
    description.innerText = t('auth.2fa.description');

    const submitButton = new Button(t('auth.2fa.verify'), () => this.handleVerify());
    const cancelButton = new Button(
      t('auth.2fa.cancel'),
      () => this.handleCancel(),
      'secondary'
    );

    card.addChildren(submitButton, cancelButton);
    card.getElement().prepend(this.codeInput.getElement());
    card.getElement().prepend(description);
    card.getElement().prepend(title);

    this.element.appendChild(card.getElement());
  }

  private async handleVerify(): Promise<void> {
    const code = this.codeInput.getValue();

    if (!code || code.length !== 6) {
      this.codeInput.setError(true);
      return;
    }

    try {
      await AuthService.verify2FA(code);
      this.onSuccess();
    } catch (error: any) {
      this.codeInput.setError(true);
      console.error('2FA verification failed:', error);
    }
  }

  private handleCancel(): void {
    this.onCancel();
  }
}
