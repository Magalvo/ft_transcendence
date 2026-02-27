import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { UserService, User, MatchHistory } from '../services/UserService';

export class ProfilePage extends AbstractComponent {
  constructor() {
    super('div', 'min-h-screen bg-gray-900 text-white');
  }

  public async render(): Promise<void> {
    this.element.innerHTML = '';
    
    // Navbar
    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

    // Fetch Data
    const user = await UserService.getProfile();
    const history = await UserService.getHistory();

    // Main Layout
    const container = document.createElement('div');
    container.className = 'container mx-auto p-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8';

    // -- Left Column: Identity --
    const identityCard = this.buildIdentityCard(user);
    
    // -- Right Column: Stats & History --
    const contentColumn = document.createElement('div');
    contentColumn.className = 'lg:col-span-2 space-y-8';
    
    const statsCard = this.buildStatsCard(user);
    const historyCard = this.buildHistoryCard(history);

    contentColumn.appendChild(statsCard.getElement());
    contentColumn.appendChild(historyCard.getElement());

    container.appendChild(identityCard.getElement());
    container.appendChild(contentColumn);

    this.element.appendChild(container);
  }

  // --- Sub-Components ---

  private buildIdentityCard(user: User): Card {
    const card = new Card('flex flex-col items-center text-center p-8');

    // Avatar Wrapper with Edit Overlay
    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'relative group w-32 h-32 mb-4 cursor-pointer';
    
    const img = document.createElement('img');
    img.src = user.avatar;
    img.className = 'w-full h-full rounded-full object-cover border-4 border-blue-500 shadow-lg';
    
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200';
    overlay.innerHTML = '<span class="text-xs font-bold">CHANGE</span>';
    
    // Hidden File Input [cite: 219]
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    fileInput.onchange = async (e: any) => {
        if (e.target.files && e.target.files[0]) {
            const newUrl = await UserService.updateAvatar(e.target.files[0]);
            img.src = newUrl; // Update UI immediately
        }
    };

    avatarWrapper.onclick = () => fileInput.click();
    avatarWrapper.appendChild(img);
    avatarWrapper.appendChild(overlay);

    // User Info
    const name = document.createElement('h2');
    name.className = 'text-2xl font-bold';
    name.innerText = user.username;

    const email = document.createElement('p');
    email.className = 'text-gray-400 text-sm mb-4';
    email.innerText = user.email;

    const statusBadge = document.createElement('div');
    const statusColor = user.status === 'online' ? 'bg-green-500' : 'bg-gray-500';
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-opacity-20 text-white border ${statusColor} border-opacity-50 flex items-center gap-2`;
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full ${statusColor}"></span> ${user.status}`;

    card.getElement().appendChild(avatarWrapper);
    card.getElement().appendChild(name);
    card.getElement().appendChild(email);
    card.getElement().appendChild(statusBadge);
    card.getElement().appendChild(fileInput);

    return card;
  }

  private buildStatsCard(user: User): Card {
    const card = new Card('grid grid-cols-3 gap-4 text-center py-6');
    
    const statItem = (label: string, value: string | number, colorClass: string) => `
        <div>
            <div class="text-3xl font-black ${colorClass}">${value}</div>
            <div class="text-xs text-gray-500 uppercase font-bold mt-1">${label}</div>
        </div>
    `;

    card.getElement().innerHTML = `
        ${statItem('Wins', user.stats.wins, 'text-green-400')}
        ${statItem('Losses', user.stats.losses, 'text-red-400')}
        ${statItem('Rank', user.stats.rank, 'text-yellow-400')}
    `;
    return card;
  }

  private buildHistoryCard(history: MatchHistory[]): Card {
    const card = new Card('p-0 overflow-hidden'); // No padding for clean table look
    
    const header = document.createElement('div');
    header.className = 'p-4 bg-gray-800 border-b border-gray-700 font-bold';
    header.innerText = 'Match History';

    const list = document.createElement('div');
    list.className = 'divide-y divide-gray-700';

    history.forEach(match => {
        const row = document.createElement('div');
        row.className = 'p-4 flex justify-between items-center hover:bg-gray-800/50 transition';
        const isWin = match.result === 'WIN';
        
        row.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded bg-gray-700 flex items-center justify-center font-bold text-lg">
                    ${match.opponent.charAt(0)}
                </div>
                <div>
                    <div class="font-bold">${match.opponent}</div>
                    <div class="text-xs text-gray-500">${match.date}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="font-mono font-bold text-lg ${isWin ? 'text-green-400' : 'text-red-400'}">
                    ${match.score}
                </div>
                <div class="text-[10px] uppercase font-bold tracking-wider ${isWin ? 'text-green-600' : 'text-red-600'}">
                    ${match.result}
                </div>
            </div>
        `;
        list.appendChild(row);
    });

    card.getElement().appendChild(header);
    card.getElement().appendChild(list);
    return card;
  }
}