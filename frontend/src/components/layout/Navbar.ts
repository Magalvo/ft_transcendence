import { AbstractComponent } from '../../core/Component';

export class Navbar extends AbstractComponent {
  constructor() {
    super('nav', 'w-full bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center fixed top-0 z-50');
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
      { label: 'Chat', path: '/chat' }, 
      { label: 'Profile', path: '/profile' },
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

    this.element.appendChild(brand);
    this.element.appendChild(linksContainer);
  }

  
  private navigate(path: string): void {
    window.history.pushState({}, '', path);
    
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}