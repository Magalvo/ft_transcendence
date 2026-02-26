import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { HyperspeedWrapper } from '../components/ui/HyperspeedWrapper';
import { hyperspeedPresets } from '../components/react/HyperspeedPresets';

export class HomePage extends AbstractComponent {
  constructor() {
    super("div", "min-h-screen relative overflow-hidden text-white");
  }

  public render(): void {
    this.element.innerHTML = '';

    const bg = new HyperspeedWrapper(hyperspeedPresets.one);
    bg.render();
    this.element.appendChild(bg.getElement());


    // 1. Navbar
    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

    // 2. Hero Section
    const hero = document.createElement('div');
    hero.className = 'flex flex-col items-center justify-center py-20 bg-gradient-to-b from-gray-800 to-gray-900';
    hero.innerHTML = `
        <h1 class="text-6xl font-extrabold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            FT_TRANSCENDENCE
        </h1>
        <p class="text-xl text-gray-400 mb-8">The ultimate retro pong experience.</p>
    `;

    // 3. Action Grid
    const grid = document.createElement('div');
    grid.className = 'container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 -mt-10';

    // Helper to create action cards
    const createActionCard = (title: string, desc: string, btnText: string, path: string, color: string) => {
        const card = new Card('hover:transform hover:-translate-y-2 transition duration-300 border-t-4 ' + color);
        
        const content = document.createElement('div');
        content.className = 'text-center p-4';
        content.innerHTML = `
            <h3 class="text-2xl font-bold mb-2">${title}</h3>
            <p class="text-gray-400 mb-6 h-12">${desc}</p>
        `;
        
        const btn = new Button(btnText, () => {
            window.history.pushState({}, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }, 'primary');
        btn.getElement().classList.add('w-full');

        card.getElement().appendChild(content);
        card.addChildren(btn);
        return card;
    };

    const playCard = createActionCard('Quick Match', 'Jump straight into a classic 1v1 pong game against AI or Local.', 'PLAY NOW', '/lobby', 'border-blue-500');
    const tournCard = createActionCard('Tournament', 'Create a bracket and challenge 3 friends to a championship.', 'ORGANIZE', '/tournament', 'border-purple-500');
    const profileCard = createActionCard('Your Profile', 'Check your stats, match history, and customize your avatar.', 'VIEW PROFILE', '/profile', 'border-green-500');

    grid.appendChild(playCard.getElement());
    grid.appendChild(tournCard.getElement());
    grid.appendChild(profileCard.getElement());

    this.element.appendChild(hero);
    this.element.appendChild(grid);
  }
}