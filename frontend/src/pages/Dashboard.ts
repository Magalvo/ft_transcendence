import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { UserService } from '../services/UserService';
import { UserStore } from '../core/UserStore';
import type { UserProfile } from '../core/UserStore';
import { HyperspeedWrapper } from '../components/ui/HyperspeedWrapper';
import { hyperspeedPresets } from '../components/react/HyperspeedPresets';
import { navigateTo } from '../core/AppRouter';
import { formatDateTime, t } from '../services/I18nService';
import { getUserAvatarUrl } from '../shared/avatar';

export class DashboardPage extends AbstractComponent {
  private navbar: Navbar | null = null;
  private background: HyperspeedWrapper | null = null;
  private friendsListEl: HTMLUListElement | null = null;
  private friendsRefreshTimer: number | null = null;
  private currentUserId: string | null = null;

  constructor() {
    super('div', 'min-h-screen relative text-white');
  }

  public async render(): Promise<void> {
    this.destroyOwnedUi();
    this.element.innerHTML = '';

    this.background = new HyperspeedWrapper(hyperspeedPresets.two);
    this.background.render();
    this.element.appendChild(this.background.getElement());

    this.navbar = new Navbar();
    this.navbar.render();
    this.element.appendChild(this.navbar.getElement());

    const container = document.createElement('div');
    container.className = 'container mx-auto p-6 mt-16 relative z-10';

    const gridDiv = document.createElement('div');
    gridDiv.className = 'grid grid-cols-1 md:grid-cols-3 gap-6';

    const user = await UserService.getProfile(true);
    this.currentUserId = user.id;

    const profileCard = this.buildProfileCard(user);
    const statsCard = this.buildStatsCard(user);
    const historyCard = this.buildHistoryCard(user);
    const friendsCard = this.buildFriendsCard(user);

    const leftColumn = document.createElement('div');
    leftColumn.className = 'space-y-6';
    leftColumn.appendChild(profileCard.getElement());
    leftColumn.appendChild(friendsCard.getElement());

    const rightColumn = document.createElement('div');
    rightColumn.className = 'md:col-span-2 space-y-6';
    rightColumn.appendChild(statsCard.getElement());
    rightColumn.appendChild(historyCard.getElement());

    gridDiv.appendChild(leftColumn);
    gridDiv.appendChild(rightColumn);
    container.appendChild(gridDiv);
    this.element.appendChild(container);
    this.startFriendsRefresh();
  }

  private buildProfileCard(user: UserProfile): Card {
    const card = new Card('flex flex-col items-center text-center space-y-4');

    const img = document.createElement('img');
    img.src = getUserAvatarUrl(user);
    img.className = 'w-32 h-32 rounded-full border-4 border-blue-500 object-cover';

    const name = document.createElement('h2');
    name.className = 'text-2xl font-bold';
    name.textContent = user.username;

    const status = document.createElement('span');
    const statusClasses =
      user.status === 'online'
        ? 'bg-green-900 text-green-300'
        : user.status === 'ingame'
          ? 'bg-blue-900 text-blue-300'
          : 'bg-gray-700 text-gray-300';
    status.className = `px-3 py-1 rounded-full text-sm ${statusClasses}`;
    status.textContent = `• ${this.getStatusLabel(user.status)}`;

    const editBtn = new Button(
      t('dashboard.profile.editProfile'),
      () => {
        navigateTo('/profile');
      },
      'secondary'
    );

    const findGameBtn = new Button(
      t('dashboard.profile.findGame'),
      () => {
        navigateTo('/find-game');
      },
      'primary'
    );

    const createGameBtn = new Button(
      t('dashboard.profile.createLobby'),
      () => {
        navigateTo('/lobby');
      },
      'secondary'
    );

    card.getElement().append(img, name, status);
    card.addChildren(editBtn, findGameBtn, createGameBtn);

    return card;
  }

  private buildStatsCard(user: UserProfile): Card {
    const card = new Card('flex justify-around items-center py-8');

    const createStat = (label: string, value: string | number, color: string) => {
      const div = document.createElement('div');
      div.className = 'text-center';
      div.innerHTML = `
        <div class="text-4xl font-bold ${color}">${value}</div>
        <div class="text-gray-400 text-sm uppercase tracking-wide">${label}</div>
      `;
      return div;
    };

    card
      .getElement()
      .appendChild(createStat(t('dashboard.stats.wins'), user.wins, 'text-green-500'));
    card
      .getElement()
      .appendChild(createStat(t('dashboard.stats.losses'), user.losses, 'text-red-500'));

    const total = user.wins + user.losses;
    const ratio = total === 0 ? 0 : Math.round((user.wins / total) * 100);
    card
      .getElement()
      .appendChild(createStat(t('dashboard.stats.winRate'), `${ratio}%`, 'text-blue-500'));

    return card;
  }

  private buildHistoryCard(user: UserProfile): Card {
    const card = new Card();
    const title = document.createElement('h3');
    title.className = 'text-xl font-bold mb-4 border-b border-gray-700 pb-2';
    title.textContent = t('dashboard.history.title');
    card.getElement().appendChild(title);

    if (user.matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-gray-500';
      empty.textContent = t('dashboard.history.empty');
      card.getElement().appendChild(empty);
      return card;
    }

    const list = document.createElement('ul');
    list.className = 'space-y-3';

    const recentMatches = user.matches.slice().reverse().slice(0, 5);

    recentMatches.forEach((match) => {
      const li = document.createElement('li');
      li.className =
        'flex justify-between items-center bg-gray-800 p-3 rounded hover:bg-gray-700 transition';
      const isWin = match.result === 'WIN';
      const resultLabel = isWin
        ? t('dashboard.history.winShort')
        : t('dashboard.history.lossShort');

      li.innerHTML = `
        <div class="flex items-center gap-3 flex-1">
          <div class="w-2 h-2 rounded-full ${isWin ? 'bg-green-500' : 'bg-red-500'}"></div>
          <div class="flex flex-col">
            <span class="font-bold">${match.opponent}</span>
            <span class="text-xs text-gray-500">${formatDateTime(match.date)}</span>
          </div>
        </div>
        <span class="font-mono font-bold ${isWin ? 'text-green-400' : 'text-red-400'}">
          ${match.score}
        </span>
        <span class="ml-2 text-sm font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}">
          ${resultLabel}
        </span>
      `;
      list.appendChild(li);
    });

    card.getElement().appendChild(list);

    if (user.matches.length > 5) {
      const viewMore = document.createElement('div');
      viewMore.className = 'mt-4 text-center';
      viewMore.innerHTML = `<span class="text-sm text-gray-400">${t(
        'dashboard.history.showingLast',
        { count: user.matches.length }
      )}</span>`;
      card.getElement().appendChild(viewMore);
    }

    return card;
  }

  private buildFriendsCard(user: UserProfile): Card {
    const card = new Card();

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold mb-4 border-b border-gray-700 pb-2';
    title.textContent = t('dashboard.friends.title');
    card.getElement().appendChild(title);

    const list = document.createElement('ul');
    list.className = 'space-y-2';
    this.friendsListEl = list;
    this.renderFriendsList(user.friends);
    card.getElement().appendChild(list);
    return card;
  }

  private renderFriendsList(friends: UserProfile['friends']): void {
    if (!this.friendsListEl) return;
    this.friendsListEl.innerHTML = '';

    if (!friends.length) {
      const empty = document.createElement('li');
      empty.className = 'text-sm text-gray-500';
      empty.textContent = t('profile.friends.empty');
      this.friendsListEl.appendChild(empty);
      return;
    }

    friends.forEach((friend) => {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center text-sm';
      const isOnline = friend.status === 'online';

      li.innerHTML = `
        <span>${friend.username}</span>
        <span class="w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}"
              title="${this.getStatusLabel(friend.status)}"></span>
      `;
      this.friendsListEl?.appendChild(li);
    });
  }

  private startFriendsRefresh(): void {
    if (this.friendsRefreshTimer !== null) window.clearInterval(this.friendsRefreshTimer);
    this.friendsRefreshTimer = window.setInterval(() => {
      void this.refreshFriendsStatuses();
    }, 10000);
  }

  private async refreshFriendsStatuses(): Promise<void> {
    if (!this.currentUserId) return;
    try {
      const friends = await UserService.fetchUserFriends(this.currentUserId);
      UserStore.updateFriends(friends);
      this.renderFriendsList(friends);
    } catch {
      // Keep existing status indicators on transient errors.
    }
  }

  private getStatusLabel(status: UserProfile['status']): string {
    if (status === 'online') return t('dashboard.status.online');
    if (status === 'ingame') return t('dashboard.status.ingame');
    return t('dashboard.status.offline');
  }

  public onDestroy(): void {
    this.destroyOwnedUi();
  }

  private destroyOwnedUi(): void {
    if (this.friendsRefreshTimer !== null) {
      window.clearInterval(this.friendsRefreshTimer);
      this.friendsRefreshTimer = null;
    }
    this.friendsListEl = null;
    this.currentUserId = null;
    this.navbar?.onDestroy();
    this.navbar = null;
    this.background?.onDestroy();
    this.background = null;
  }
}
