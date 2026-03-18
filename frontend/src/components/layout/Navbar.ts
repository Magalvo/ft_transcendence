import { AbstractComponent } from '../../core/Component';
import { navigateTo } from '../../core/AppRouter';
import { UserStore } from '../../core/UserStore';
import AuthService from '../../services/AuthService';
import {
  availableLocales,
  i18n,
  t,
  type Locale,
} from '../../services/I18nService';

export class Navbar extends AbstractComponent {
  private cleanupProfileImageSubscription: (() => void) | null = null;

  constructor() {
    super(
      'nav',
      'w-full bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center fixed top-0 z-50 relative'
    );
  }

  public render(): void {
    this.element.innerHTML = '';

    const brand = document.createElement('div');
    brand.className = 'text-xl font-bold tracking-wider text-blue-400 cursor-pointer';
    brand.textContent = 'FT_TRANSCENDENCE';
    brand.addEventListener('click', () => this.navigate('/'));

    const linksContainer = document.createElement('div');
    linksContainer.className = 'flex gap-6';

    const links = [
      { label: t('nav.createGame'), path: '/lobby' },
      { label: t('nav.findGame'), path: '/find-game' },
      { label: t('nav.spacedOut'), path: '/spacedout' },
      { label: t('nav.tournament'), path: '/tournament' },
      { label: t('nav.chat'), path: '/chat' },
      { label: t('nav.dashboard'), path: '/dashboard' },
    ];

    links.forEach((link) => {
      const anchor = document.createElement('a');
      anchor.textContent = link.label;
      anchor.className = 'text-gray-300 hover:text-white cursor-pointer transition';
      anchor.addEventListener('click', (event) => {
        event.preventDefault();
        this.navigate(link.path);
      });
      linksContainer.appendChild(anchor);
    });

    const rightSide = document.createElement('div');
    rightSide.className = 'flex items-center gap-4';
    rightSide.appendChild(linksContainer);
    rightSide.appendChild(this.buildLanguageSwitcher());
    rightSide.appendChild(this.buildProfileImage());

    this.element.appendChild(brand);
    this.element.appendChild(rightSide);
  }

  public onDestroy(): void {
    this.cleanupProfileImageSubscription?.();
    this.cleanupProfileImageSubscription = null;
  }

  private buildLanguageSwitcher(): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'flex items-center gap-2 text-sm text-gray-300';

    const text = document.createElement('span');
    text.textContent = t('nav.languageLabel');

    const select = document.createElement('select');
    select.className =
      'rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white outline-none focus:border-blue-500';
    select.setAttribute('aria-label', t('nav.languageLabel'));
    select.value = i18n.getLocale();

    availableLocales.forEach((locale) => {
      const option = document.createElement('option');
      option.value = locale;
      option.textContent = this.getLocaleLabel(locale);
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      i18n.setLocale(select.value as Locale);
    });

    wrapper.append(text, select);
    return wrapper;
  }

  private buildProfileImage(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative';

    const profileImage = document.createElement('img');
    profileImage.alt = t('nav.profileAlt');
    profileImage.className = 'w-8 h-8 rounded-full cursor-pointer border border-gray-700';

    const user = UserStore.getUser();
    profileImage.src =
      user?.avatarUrl ||
      'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff';

    this.cleanupProfileImageSubscription?.();
    this.cleanupProfileImageSubscription = UserStore.subscribe((updatedUser) => {
      if (!updatedUser) return;

      profileImage.src =
        updatedUser.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(updatedUser.username)}&background=0D8ABC&color=fff`;
    });

    profileImage.addEventListener('click', (event) => {
      event.stopPropagation();
      this.showProfileOptions(wrapper, profileImage);
    });

    wrapper.appendChild(profileImage);
    return wrapper;
  }

  private showProfileOptions(anchor: HTMLElement, trigger: HTMLElement): void {
    if (anchor.dataset.open === 'true') {
      this.removeExistingDropdown(anchor);
      return;
    }

    this.removeExistingDropdown(anchor);

    const optionsContainer = document.createElement('div');
    optionsContainer.className =
      'navbar-profile-menu absolute mt-2 w-48 bg-white rounded-md shadow-lg z-50 text-sm overflow-hidden';

    const profileLink = document.createElement('a');
    profileLink.textContent = t('nav.profile');
    profileLink.className = 'block px-4 py-2 text-gray-800 hover:bg-gray-200';
    profileLink.addEventListener('click', () => {
      this.removeExistingDropdown(anchor);
      this.navigate('/profile');
    });

    const logoutLink = document.createElement('a');
    logoutLink.textContent = t('nav.logout');
    logoutLink.className = 'block px-4 py-2 text-gray-800 hover:bg-gray-200';
    logoutLink.addEventListener('click', async () => {
      await this.logout();
      this.removeExistingDropdown(anchor);
    });

    optionsContainer.append(profileLink, logoutLink);

    const rect = trigger.getBoundingClientRect();
    optionsContainer.style.top = `${rect.bottom + window.scrollY}px`;
    optionsContainer.style.left = `${rect.right - 192 + window.scrollX}px`;

    document.body.appendChild(optionsContainer);

    anchor.dataset.open = 'true';
    const outsideClick = (event: MouseEvent) => {
      if (!optionsContainer.contains(event.target as Node)) {
        this.removeExistingDropdown(anchor);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', outsideClick, { once: true });
    }, 0);
  }

  private async logout(): Promise<void> {
    const user = UserStore.getUser();
    const userId = user?.id;

    try {
      const { socketService } = await import('../../client/SocketService');
      const socket = socketService.getSocket();
      if (socket && userId) {
        socket.emit('userLogout', { userId });
      }
      socketService.disconnect();
    } catch {
      // Ignore realtime logout cleanup failures.
    }

    UserStore.clearUser();
    await AuthService.logout();
  }

  private removeExistingDropdown(anchor: HTMLElement): void {
    const existing = document.querySelector('.navbar-profile-menu');
    if (existing) existing.remove();
    delete anchor.dataset.open;
  }

  private navigate(path: string): void {
    navigateTo(path);
  }

  private getLocaleLabel(locale: Locale): string {
    return locale === 'pt' ? t('nav.languageName.pt') : t('nav.languageName.en');
  }
}
