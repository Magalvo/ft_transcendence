import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { UserService } from '../services/UserService';
import type { UserProfile, Match } from '../types/User';

export class ProfilePage extends AbstractComponent {
  constructor() {
    super('div', 'min-h-screen bg-gray-900 text-white');
  }

  public async render(): Promise<void> {
    this.element.innerHTML = '';
    
    
    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

  
    const user = await UserService.getProfile(true);

    
    const container = document.createElement('div');
    container.className = 'container mx-auto p-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8';

    
    const identityCard = this.buildIdentityCard(user);
    
    
    const contentColumn = document.createElement('div');
    contentColumn.className = 'lg:col-span-2 space-y-8';
    
    const statsCard = this.buildStatsCard(user);
    const historyCard = this.buildHistoryCard(user.matches);

    contentColumn.appendChild(statsCard.getElement());
    contentColumn.appendChild(historyCard.getElement());

    container.appendChild(identityCard.getElement());
    container.appendChild(contentColumn);

    this.element.appendChild(container);
  }

  // --- Sub-Components ---

  private buildIdentityCard(user: Omit<UserProfile, 'avatarUrl'> & { avatarUrl?: string }): Card {
    const card = new Card('flex flex-col items-center text-center p-8');

    
    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'relative group w-32 h-32 mb-4 cursor-pointer';
    
    const img = document.createElement('img');
    img.src = user.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username);
    img.className = 'w-full h-full rounded-full object-cover border-4 border-blue-500 shadow-lg';
    
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200';
    overlay.innerHTML = '<span class="text-xs font-bold">CHANGE</span>';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    fileInput.onchange = async (e: any) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const newUrl = await UserService.updateAvatar(e.target.files[0]);
                img.src = newUrl;
                console.log('Avatar updated successfully');
            } catch (error) {
                console.error('Failed to update avatar:', error);
                alert('Failed to upload avatar');
            }
        }
    };

    avatarWrapper.onclick = () => fileInput.click();
    avatarWrapper.appendChild(img);
    avatarWrapper.appendChild(overlay);

    // User
    const name = document.createElement('h2');
    name.className = 'text-2xl font-bold';
    name.innerText = user.username;

    const email = document.createElement('p');
    email.className = 'text-gray-400 text-sm mb-4';
    email.innerText = user.email;

    const statusBadge = document.createElement('div');
    const statusColor = user.status === 'online' ? 'bg-green-500' : user.status === 'ingame' ? 'bg-blue-500' : 'bg-gray-500';
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-opacity-20 text-white border ${statusColor} border-opacity-50 flex items-center gap-2`;
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full ${statusColor}"></span> ${user.status}`;

    card.getElement().appendChild(avatarWrapper);
    card.getElement().appendChild(name);
    card.getElement().appendChild(email);
    card.getElement().appendChild(statusBadge);
    card.getElement().appendChild(fileInput);

    return card;
  }

  private buildStatsCard(user: Omit<UserProfile, 'avatarUrl'> & { avatarUrl?: string }): Card {
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
        ${statItem('Rank', user.stats.rank || 'Unranked', 'text-yellow-400')}
    `;
    return card;
  }

  private buildHistoryCard(matches: Match[]): Card {
    const card = new Card('p-0 overflow-hidden');
    
    const header = document.createElement('div');
    header.className = 'p-4 bg-gray-800 border-b border-gray-700 font-bold';
    header.innerText = 'Match History';

    const list = document.createElement('div');
    list.className = 'divide-y divide-gray-700';

    if (matches.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'p-8 text-center text-gray-500';
      emptyState.innerText = 'No matches played yet';
      list.appendChild(emptyState);
    } else {
      matches.forEach(match => {
        const row = document.createElement('div');
        row.className = 'p-4 flex justify-between items-center hover:bg-gray-800/50 transition';
        const isWin = match.result === 'WIN';
        
        row.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded bg-gray-700 flex items-center justify-center font-bold text-lg">
                    ${match.opponent.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div class="font-bold">${match.opponent}</div>
                    <div class="text-xs text-gray-500">${new Date(match.date).toLocaleDateString()}</div>
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
    }

    card.getElement().appendChild(header);
    card.getElement().appendChild(list);
    return card;
  }
}