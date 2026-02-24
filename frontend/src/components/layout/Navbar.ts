import { AbstractComponent } from '../../core/Component';

export class Navbar extends AbstractComponent {
  constructor() {
    super('nav', 'w-full bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center fixed top-0 z-50 relative');
  }

  public render(): void {
    
    const brand = document.createElement('div');
    brand.className = 'text-xl font-bold tracking-wider text-blue-400 cursor-pointer';
    brand.textContent = 'FT_TRANSCENDENCE';
    brand.addEventListener('click', () => this.navigate('/'));

    
    const linksContainer = document.createElement('div');
    linksContainer.className = 'flex gap-6';

    
    const links = [
      { label: 'Game', path: '/game' },
      { label: 'Tournament', path: '/tournament' },
      { label: 'Chat', path: '/chat' }, 
    ];

    links.forEach(link => {
      const a = document.createElement('a');
      a.textContent = link.label;
      a.className = 'text-gray-300 hover:text-white cursor-pointer transition';
      
      
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(link.path);
      });
      
      linksContainer.appendChild(a);
    });

    const rightSide = document.createElement('div');
    rightSide.className = 'flex items-center gap-4';

    rightSide.appendChild(linksContainer);
    rightSide.appendChild(this.buildProfileImage());

    this.element.appendChild(brand);
    this.element.appendChild(rightSide);
  }

  private buildProfileImage(): HTMLElement {
    const profileImage = document.createElement('img');
    profileImage.src = 'https://cdn.intra.42.fr/users/ab00a9d8830ab9f89a054fed2479e9f1/small_dde-maga.JPG';
    profileImage.alt = 'Profile';
    profileImage.className = 'w-8 h-8 rounded-full cursor-pointer border border-gray-700';

    const wrapper = document.createElement('div');
    wrapper.className = 'relative';
    wrapper.appendChild(profileImage);

    profileImage.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showProfileOptions(wrapper, profileImage);
    });

    return wrapper;
  }

  private showProfileOptions(anchor: HTMLElement, trigger: HTMLElement): void {
    if (anchor.dataset.open === 'true') {
      this.removeExistingDropdown(anchor);
      return;
    }

    this.removeExistingDropdown(anchor);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'navbar-profile-menu absolute mt-2 w-48 bg-white rounded-md shadow-lg z-50 text-sm overflow-hidden';

    const profileLink = document.createElement('a');
    profileLink.textContent = 'Profile';
    profileLink.className = 'block px-4 py-2 text-gray-800 hover:bg-gray-200';
    profileLink.addEventListener('click', () => {
      this.removeExistingDropdown(anchor);
      this.navigate('/profile');
    });

    const logoutLink = document.createElement('a');
    logoutLink.textContent = 'Logout';
    logoutLink.className = 'block px-4 py-2 text-gray-800 hover:bg-gray-200';
    //logoutLink.addEventListener('click', () => this.logout());
    logoutLink.addEventListener('click', () => {
      this.removeExistingDropdown(anchor);
      this.navigate('/login');
    });

    optionsContainer.appendChild(profileLink);
    optionsContainer.appendChild(logoutLink);

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

    setTimeout(() => document.addEventListener('click', outsideClick, { once: true }), 0);
  }

  private logout(): void {
    this.removeExistingDropdown(document.createElement('div'));
    this.navigate('/login');
  }

  private removeExistingDropdown(anchor: HTMLElement): void {
    const existing = document.querySelector('.navbar-profile-menu');
    if (existing) existing.remove();
    delete anchor.dataset.open;
  }
  
  private navigate(path: string): void {
    window.history.pushState({}, '', path);
    
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}