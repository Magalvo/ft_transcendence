import { AbstractComponent } from '../core/Component';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import AuthService from '../services/AuthService';
import { TwoFactorPage } from './TwoFactorPage';
import { GridScanWrapper } from '../components/ui/GridScanWrapper';
import {
  availableLocales,
  getLocaleLabel,
  i18n,
  t,
} from '../services/I18nService';

export class LoginPage extends AbstractComponent {
  private background: GridScanWrapper | null = null;
  private isRegisterMode = false;
  private usernameInput: Input;
  private passwordInput: Input;
  private emailInput: Input;
  private acceptTermsChecked = false;
  private isForgotPasswordModalOpen = false;
  private forgotPasswordEmail = '';
  private forgotPasswordError = '';
  private forgotPasswordSuccess = '';
  private isForgotPasswordSubmitting = false;

  constructor() {
    super(
      'section',
      'w-full h-screen flex justify-center items-center relative overflow-hidden'
    );

    this.usernameInput = new Input(
      t('login.username.placeholder'),
      'text',
      t('login.username.label')
    );
    this.passwordInput = new Input(
      t('login.password.placeholder'),
      'password',
      t('login.password.label')
    );
    this.emailInput = new Input(
      t('login.email.placeholder'),
      'email',
      t('login.email.label')
    );
  }

  public render(): void {
    this.destroyOwnedUi();
    this.element.innerHTML = '';

    this.background = new GridScanWrapper({
      enableWebcam: false,
      bloomIntensity: 1.5,
    });
    this.background.render();
    this.element.appendChild(this.background.getElement());
    this.element.appendChild(this.buildLanguageSwitcher());

    const card = new Card('w-full max-w-md bg-white/10 backdrop-blur-sm relative z-10');

    const header = document.createElement('div');
    header.className = 'text-center mb-8';
    header.innerHTML = `
      <h2 class="text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 leading-normal inline-block">
        ${t('login.title')}
      </h2>
      <p class="text-gray-400 mt-4">
        ${this.isRegisterMode ? t('login.subtitle.signUp') : t('login.subtitle.signIn')}
      </p>
    `;
    card.getElement().appendChild(header);

    this.usernameInput.render();
    this.passwordInput.render();
    card.getElement().appendChild(this.usernameInput.getElement());

    if (this.isRegisterMode) {
      this.emailInput.render();
      card.getElement().appendChild(this.emailInput.getElement());

      const termsDiv = document.createElement('div');
      termsDiv.className = 'flex items-center mb-4 text-sm text-gray-300';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'acceptTerms';
      checkbox.className = 'mr-2 cursor-pointer';
      checkbox.checked = this.acceptTermsChecked;
      checkbox.onclick = () => {
        this.acceptTermsChecked = checkbox.checked;
      };

      const label = document.createElement('label');
      label.htmlFor = 'acceptTerms';
      label.className = 'cursor-pointer';
      label.append(t('login.acceptTerms.prefix'));
      label.appendChild(this.buildLegalLink('/terms', t('login.legal.terms')));
      label.append(t('login.acceptTerms.connector'));
      label.appendChild(this.buildLegalLink('/privacy', t('login.legal.privacy')));

      termsDiv.append(checkbox, label);
      card.getElement().appendChild(termsDiv);
    }

    card.getElement().appendChild(this.passwordInput.getElement());

    if (!this.isRegisterMode) {
      const forgotLink = document.createElement('div');
      forgotLink.className = 'flex justify-end mb-6';

      const link = document.createElement('a');
      link.href = '#';
      link.className = 'text-sm text-indigo-400 hover:text-indigo-300 font-medium transition';
      link.innerText = t('login.forgotPassword');
      link.onclick = (event) => {
        event.preventDefault();
        this.openForgotPasswordModal();
      };

      forgotLink.appendChild(link);
      card.getElement().appendChild(forgotLink);
    }

    const actionBtn = new Button(
      this.isRegisterMode ? t('login.actions.signUp') : t('login.actions.signIn'),
      () => {
        void this.handleSubmit();
      },
      'primary'
    );
    actionBtn.getElement().classList.add('w-full', 'mb-4');
    card.addChildren(actionBtn);

    this.renderSocialLogin(card);

    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'mt-6 text-center text-sm text-gray-400';
    toggleDiv.innerText = this.isRegisterMode
      ? t('login.toggle.haveAccount')
      : t('login.toggle.noAccount');

    const toggleLink = document.createElement('span');
    toggleLink.className =
      'text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition';
    toggleLink.innerText = this.isRegisterMode
      ? t('login.toggle.signIn')
      : t('login.toggle.signUp');
    toggleLink.onclick = () => this.toggleMode();

    toggleDiv.appendChild(toggleLink);
    card.getElement().appendChild(toggleDiv);

    if (!this.isRegisterMode) {
      const legalFooter = document.createElement('div');
      legalFooter.className =
        'mt-6 pt-4 border-t border-gray-700/50 flex justify-center gap-4 text-xs text-gray-500';

      legalFooter.appendChild(
        this.buildLegalLink(
          '/terms',
          t('login.legal.terms'),
          'hover:text-gray-300 transition'
        )
      );

      const separator = document.createElement('span');
      separator.innerHTML = '&bull;';
      legalFooter.appendChild(separator);

      legalFooter.appendChild(
        this.buildLegalLink(
          '/privacy',
          t('login.legal.privacy'),
          'hover:text-gray-300 transition'
        )
      );

      card.getElement().appendChild(legalFooter);
    }

    this.element.appendChild(card.getElement());

    if (!this.isRegisterMode && this.isForgotPasswordModalOpen) {
      this.element.appendChild(this.renderForgotPasswordModal());
    }
  }

  private renderSocialLogin(card: Card): void {
    const divider = document.createElement('div');
    divider.className = 'relative mt-6 mb-6';
    divider.innerHTML = `
      <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-600/50"></div></div>
      <div class="relative flex justify-center text-sm"><span class="px-2 bg-[#111] text-gray-400">${t('login.social.continue')}</span></div>
    `;
    card.getElement().appendChild(divider);

    const socialContainer = document.createElement('div');
    socialContainer.className = 'grid grid-cols-1 gap-3';

    const googleBtn = document.createElement('button');
    googleBtn.className =
      'w-full flex items-center justify-center px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-900/50 hover:bg-gray-800 focus:outline-none transition';
    googleBtn.innerHTML = `
      <svg class="h-5 w-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Google
    `;
    googleBtn.onclick = (event) => {
      event.preventDefault();
      AuthService.loginWithGoogle();
    };

    socialContainer.appendChild(googleBtn);
    card.getElement().appendChild(socialContainer);
  }

  private toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.render();
  }

  private async handleSubmit(event?: Event): Promise<void> {
    if (event) event.preventDefault();

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
        alert(t('login.validation.acceptTerms'));
        isValid = false;
      }
    }

    if (!isValid) return;

    try {
      if (this.isRegisterMode) {
        const email = this.emailInput.getValue();
        await AuthService.register({
          username,
          password,
          email,
          acceptTerms: this.acceptTermsChecked,
        });
        this.showSuccessMessage(t('login.success.register'));

        await new Promise((resolve) => setTimeout(resolve, 500));
        window.location.href = '/';
      } else {
        const loginResult = await AuthService.login(username, password);

        if (loginResult.twoFactorRequired) {
          this.render2FAModal();
        } else {
          this.showSuccessMessage(t('login.success.login'));

          await new Promise((resolve) => setTimeout(resolve, 500));
          window.location.href = '/';
        }
      }
    } catch (error: any) {
      console.error('Auth Error:', error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        t('login.error.authFallback');

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
          alert(t('login.error.prefixed', { message: errorMessage }));
        }
      } else {
        alert(errorMessage);
      }
    }
  }

  private async handleForgotPassword(): Promise<void> {
    const email = this.forgotPasswordEmail.trim();
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';

    if (!email) {
      this.forgotPasswordError = t('login.forgotPassword.requiredEmail');
      this.render();
      return;
    }

    if (!AuthService.parseEmail(email)) {
      this.forgotPasswordError = t('login.forgotPassword.invalidEmail');
      this.render();
      return;
    }

    this.isForgotPasswordSubmitting = true;
    this.render();

    try {
      await AuthService.forgotPassword(email);
      this.forgotPasswordSuccess = t('login.forgotPassword.success');
      this.forgotPasswordEmail = '';
    } catch (error: any) {
      this.forgotPasswordError =
        error.response?.data?.error || t('login.forgotPassword.failure');
    } finally {
      this.isForgotPasswordSubmitting = false;
      this.render();
    }
  }

  private openForgotPasswordModal(): void {
    this.isForgotPasswordModalOpen = true;
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';
    this.render();
  }

  private closeForgotPasswordModal(): void {
    if (this.isForgotPasswordSubmitting) return;
    this.isForgotPasswordModalOpen = false;
    this.forgotPasswordError = '';
    this.forgotPasswordSuccess = '';
    this.forgotPasswordEmail = '';
    this.render();
  }

  private renderForgotPasswordModal(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className =
      'fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4';
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        this.closeForgotPasswordModal();
      }
    });

    const modal = document.createElement('div');
    modal.className = 'w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl';

    const title = document.createElement('h3');
    title.className = 'text-2xl font-bold text-white mb-2';
    title.textContent = t('login.forgotPassword.modalTitle');

    const description = document.createElement('p');
    description.className = 'text-sm text-gray-400 mb-4';
    description.textContent = t('login.forgotPassword.prompt');

    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.onsubmit = (event) => {
      event.preventDefault();
      void this.handleForgotPassword();
    };

    const emailLabel = document.createElement('label');
    emailLabel.className = 'block text-sm font-medium text-gray-300';
    emailLabel.textContent = t('login.forgotPassword.emailLabel');

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.value = this.forgotPasswordEmail;
    emailInput.placeholder = t('login.forgotPassword.emailPlaceholder');
    emailInput.className =
      'mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white outline-none focus:border-indigo-400';
    emailInput.disabled = this.isForgotPasswordSubmitting;
    emailInput.autofocus = true;
    emailInput.oninput = () => {
      this.forgotPasswordEmail = emailInput.value;
      if (this.forgotPasswordError) {
        this.forgotPasswordError = '';
      }
    };

    emailLabel.appendChild(emailInput);
    form.appendChild(emailLabel);

    if (this.forgotPasswordError) {
      const errorText = document.createElement('p');
      errorText.className = 'text-sm text-red-400';
      errorText.textContent = this.forgotPasswordError;
      form.appendChild(errorText);
    }

    if (this.forgotPasswordSuccess) {
      const successText = document.createElement('p');
      successText.className = 'text-sm text-emerald-400';
      successText.textContent = this.forgotPasswordSuccess;
      form.appendChild(successText);
    }

    const actions = document.createElement('div');
    actions.className = 'flex items-center justify-end gap-3 pt-2';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 transition';
    cancelBtn.textContent = t('login.forgotPassword.cancel');
    cancelBtn.disabled = this.isForgotPasswordSubmitting;
    cancelBtn.onclick = () => this.closeForgotPasswordModal();

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className =
      'rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition disabled:cursor-not-allowed disabled:opacity-70';
    submitBtn.disabled = this.isForgotPasswordSubmitting;
    submitBtn.textContent = this.isForgotPasswordSubmitting
      ? t('login.forgotPassword.submitting')
      : t('login.forgotPassword.submit');

    actions.append(cancelBtn, submitBtn);
    form.appendChild(actions);

    modal.append(title, description, form);
    overlay.appendChild(modal);

    return overlay;
  }

  private render2FAModal(): void {
    const twoFAPage = new TwoFactorPage(
      async () => {
        this.showSuccessMessage(t('login.success.twoFactor'));
        await new Promise((resolve) => setTimeout(resolve, 2000));
        window.location.href = '/';
      },
      () => {
        AuthService.clearPendingTwoFactor();
        this.render();
      }
    );

    twoFAPage.render();
    this.element.appendChild(twoFAPage.getElement());
  }

  private showSuccessMessage(message: string): void {
    const successDiv = document.createElement('div');
    successDiv.className =
      'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    successDiv.innerText = message;
    document.body.appendChild(successDiv);

    setTimeout(() => successDiv.remove(), 3000);
  }

  private buildLanguageSwitcher(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className =
      'absolute top-6 right-6 z-20 flex items-center gap-2 rounded-full border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-200 backdrop-blur-sm';

    const label = document.createElement('span');
    label.textContent = t('nav.languageLabel');

    const select = document.createElement('select');
    select.className =
      'rounded border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-white outline-none focus:border-blue-500';
    select.setAttribute('aria-label', t('nav.languageLabel'));

    availableLocales.forEach((locale) => {
      const option = document.createElement('option');
      option.value = locale;
      option.textContent = getLocaleLabel(locale);
      select.appendChild(option);
    });
    select.value = i18n.getLocale();

    select.addEventListener('change', () => {
      i18n.setLocale(select.value as typeof availableLocales[number]);
    });

    wrapper.append(label, select);
    return wrapper;
  }

  private buildLegalLink(
    path: string,
    label: string,
    className = 'text-indigo-400 hover:text-indigo-300 underline transition'
  ): HTMLAnchorElement {
    const link = document.createElement('a');
    link.href = path;
    link.target = '_blank';
    link.className = className;
    link.textContent = label;
    return link;
  }

  public onDestroy(): void {
    this.destroyOwnedUi();
  }

  private destroyOwnedUi(): void {
    this.background?.onDestroy();
    this.background = null;
  }
}
