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
    const nameContainer = document.createElement('div');
    nameContainer.className = 'flex items-center gap-2 justify-center mb-2';

    const name = document.createElement('h2');
    name.className = 'text-2xl font-bold';
    name.innerText = user.username;

    const editBtn = document.createElement('button');
    editBtn.className = 'text-gray-400 hover:text-blue-400 transition p-1';
    editBtn.innerHTML = '✏️';
    editBtn.click = () => this.showEditUsernameModal(user, name);
    editBtn.onclick = () => this.showEditUsernameModal(user, name);

    nameContainer.appendChild(name);
    nameContainer.appendChild(editBtn);

    const email = document.createElement('p');
    email.className = 'text-gray-400 text-sm mb-4';
    email.innerText = user.email;

    const statusBadge = document.createElement('div');
    const statusColor = user.status === 'online' ? 'bg-green-500' : user.status === 'ingame' ? 'bg-blue-500' : 'bg-gray-500';
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-opacity-20 text-white border ${statusColor} border-opacity-50 flex items-center gap-2`;
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full ${statusColor}"></span> ${user.status}`;

    card.getElement().appendChild(avatarWrapper);
    card.getElement().appendChild(nameContainer);
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

  private showEditUsernameModal(user: any, nameElement: HTMLElement): void {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 border border-gray-700';

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold mb-4 text-white';
    title.innerText = 'Edit Username';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-4';
    input.placeholder = 'Enter new username';
    input.value = user.username;
    input.minLength = 3;
    input.maxLength = 24;

    const error = document.createElement('p');
    error.className = 'text-red-400 text-sm mb-4 hidden';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex gap-3 justify-end';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition';
    cancelBtn.innerText = 'Cancel';
    cancelBtn.onclick = () => modal.remove();

    const saveBtn = document.createElement('button');
    saveBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50';
    saveBtn.innerText = 'Save';
    saveBtn.onclick = async () => {
      const newUsername = input.value.trim();

      if (!newUsername) {
        error.innerText = 'Username cannot be empty';
        error.classList.remove('hidden');
        return;
      }

      if (newUsername.length < 3 || newUsername.length > 24) {
        error.innerText = 'Username must be between 3 and 24 characters';
        error.classList.remove('hidden');
        return;
      }

      if (newUsername === user.username) {
        modal.remove();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      try {
        const updated = await UserService.updateUsername(newUsername);
        nameElement.innerText = updated;
        modal.remove();
      } catch (err: any) {
        const errorMsg = err?.message || err?.toString?.() || 'Failed to update username';
        error.innerText = errorMsg;
        error.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save';
      }
    };

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(saveBtn);

    modalContent.appendChild(title);
    modalContent.appendChild(input);
    modalContent.appendChild(error);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    input.focus();
    input.select();
  }
}
