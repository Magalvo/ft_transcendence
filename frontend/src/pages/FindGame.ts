import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { UserStore } from '../core/UserStore';
import { socketService } from '../client/SocketService';
import { navigateTo } from '../core/AppRouter';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../core/UserStore';
import { formatTime, t } from '../services/I18nService';
import { getUserAvatarUrl } from '../shared/avatar';

interface GameLobby {
  id: string;
  leader: {
    id: string;
    username: string;
  };
  players: number;
  maxPlayers: number;
  mode: '1v1' | '2v2' | '3v3';
  isPrivate: boolean;
  code?: string;
  createdAt: number;
  status: 'waiting' | 'ready' | 'playing';
}

export class FindGamePage extends AbstractComponent {
  private navbar: Navbar | null = null;
  private socket: Socket | null = null;
  private lobbies: GameLobby[] = [];
  private currentUser: UserProfile | null = null;
  private userStoreSubscription: (() => void) | null = null;
  private lobbyListEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private filterModeEl: HTMLSelectElement | null = null;
  private filterTypeEl: HTMLSelectElement | null = null;
  private createLobbyModal: HTMLElement | null = null;
  private myLobbies = new Map<string, string>();
  private refreshTimer: number | null = null;
  private isRefreshing = false;

  private onSocketConnect = (): void => {
    this.isRefreshing = false;
    this.refreshLobbies();
  };

  private onSocketDisconnect = (): void => {
    this.isRefreshing = false;
  };

  private onAvailableLobbies = (lobbies: GameLobby[] | undefined): void => {
    this.lobbies = Array.isArray(lobbies) ? lobbies : [];
    this.isRefreshing = false;
    this.renderLobbies();
  };

  private onLobbyListChanged = (): void => {
    this.refreshLobbies();
  };

  private onLobbyUpdated = (updatedLobby: GameLobby): void => {
    const index = this.lobbies.findIndex((lobby) => lobby.id === updatedLobby.id);
    if (index !== -1) {
      this.lobbies[index] = updatedLobby;
    } else {
      this.lobbies.push(updatedLobby);
    }
    this.renderLobbies();
  };

  private onLobbyDeleted = (data: { lobbyId: string }): void => {
    const deletedLobby = this.lobbies.find((lobby) => lobby.id === data.lobbyId);
    const wasMyLobby = !!deletedLobby && this.currentUser?.id === deletedLobby.leader.id;

    this.lobbies = this.lobbies.filter((lobby) => lobby.id !== data.lobbyId);
    this.renderLobbies();

    if (wasMyLobby) {
      this.showToast(t('findGame.toast.removed'), 'success');
    }
  };

  private onLobbyCreated = (data: { lobbyId: string; code?: string }): void => {
    if (data.code) {
      this.myLobbies.set(data.lobbyId, data.code);
    }
    this.refreshLobbies();
    this.closeCreateModal();
  };

  private onJoinLobbySuccess = (data: { lobbyId: string }): void => {
    navigateTo(`/lobby?id=${encodeURIComponent(data.lobbyId)}`);
  };

  private onJoinLobbyError = (data: { message: string }): void => {
    alert(t('findGame.error.join', { message: data.message }));
  };

  private onDeleteLobbyError = (data: { message: string }): void => {
    this.showToast(t('findGame.error.remove', { message: data.message }), 'error');
  };

  private onSocketError = (error: unknown): void => {
    console.error('Socket error:', error);
  };

  constructor() {
    super('div', 'flex flex-col h-screen bg-black overflow-auto');
  }

  public async render(): Promise<void> {
    this.destroyOwnedUi();
    this.element.innerHTML = '';

    this.navbar = new Navbar();
    this.navbar.render();
    this.element.appendChild(this.navbar.getElement());

    const container = document.createElement('div');
    container.className = 'flex-1 w-full p-6 bg-neutral-900 text-white';
    container.innerHTML = `
      <div class="max-w-6xl mx-auto">
        <div class="mb-8">
          <h1 class="text-3xl font-bold mb-2">${t('findGame.title')}</h1>
          <p class="text-neutral-400">${t('findGame.subtitle')}</p>
        </div>

        <div class="flex gap-4 mb-6">
          <div class="flex-1">
            <input
              id="search-lobbies"
              type="text"
              placeholder="${t('findGame.searchPlaceholder')}"
              class="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            id="filter-mode"
            class="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
          >
            <option value="">${t('findGame.filter.allModes')}</option>
            <option value="1v1">${t('findGame.mode.1v1')}</option>
            <option value="2v2">${t('findGame.mode.2v2')}</option>
            <option value="3v3">${t('findGame.mode.3v3')}</option>
          </select>
          <select
            id="filter-type"
            class="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
          >
            <option value="">${t('findGame.filter.allTypes')}</option>
            <option value="public">${t('findGame.type.public')}</option>
            <option value="private">${t('findGame.type.private')}</option>
          </select>
          <button
            id="btn-create-lobby"
            class="px-6 py-2 rounded bg-blue-700 hover:bg-blue-600 font-medium transition"
          >
            ${t('findGame.action.createLobby')}
          </button>
          <button
            id="btn-refresh-lobbies"
            class="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 font-medium transition"
            title="${t('findGame.action.refreshTitle')}"
            aria-label="${t('findGame.action.refreshTitle')}"
          >
            ↻
          </button>
        </div>

        <div id="lobbies-container" class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <div class="col-span-full text-center text-neutral-400 py-8">${t('findGame.state.loading')}</div>
        </div>
      </div>
    `;

    this.element.appendChild(container);

    this.lobbyListEl = container.querySelector('#lobbies-container');
    this.searchInputEl = container.querySelector('#search-lobbies') as HTMLInputElement;
    this.filterModeEl = container.querySelector('#filter-mode') as HTMLSelectElement;
    this.filterTypeEl = container.querySelector('#filter-type') as HTMLSelectElement;

    this.searchInputEl?.addEventListener('input', () => this.renderLobbies());
    this.filterModeEl?.addEventListener('change', () => this.renderLobbies());
    this.filterTypeEl?.addEventListener('change', () => this.renderLobbies());
    container
      .querySelector('#btn-create-lobby')
      ?.addEventListener('click', () => this.openCreateModal());
    container
      .querySelector('#btn-refresh-lobbies')
      ?.addEventListener('click', () => this.refreshLobbies());

    this.setupUserSubscription();
    this.initSocket();
    this.startAutoRefresh();
  }

  private setupUserSubscription(): void {
    this.currentUser = UserStore.getUser();

    this.userStoreSubscription = UserStore.subscribe((user) => {
      this.currentUser = user;

      if (user?.id) {
        this.socket = socketService.init(undefined, user.id);
        if (this.socket?.connected) {
          this.refreshLobbies();
        }
      }

      this.renderLobbies();
    });
  }

  private startAutoRefresh(): void {
    this.refreshTimer = window.setInterval(() => {
      if (this.socket?.connected && !this.isRefreshing) {
        this.refreshLobbies();
      }
    }, 5000);
  }

  private refreshLobbies(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.socket?.emit('requestAvailableLobbies');
  }

  private initSocket(): void {
    const currentUser = UserStore.getUser();
    this.socket = socketService.init(undefined, currentUser?.id);

    this.socket.on('connect', this.onSocketConnect);
    this.socket.on('disconnect', this.onSocketDisconnect);
    this.socket.on('availableLobbies', this.onAvailableLobbies);
    this.socket.on('lobbyListChanged', this.onLobbyListChanged);
    this.socket.on('lobbyUpdated', this.onLobbyUpdated);
    this.socket.on('lobbyDeleted', this.onLobbyDeleted);
    this.socket.on('lobbyCreated', this.onLobbyCreated);
    this.socket.on('joinLobbySuccess', this.onJoinLobbySuccess);
    this.socket.on('joinLobbyError', this.onJoinLobbyError);
    this.socket.on('deleteLobbyError', this.onDeleteLobbyError);
    this.socket.on('error', this.onSocketError);

    if (this.socket.connected) {
      this.refreshLobbies();
    }
  }

  private renderLobbies(): void {
    if (!this.lobbyListEl) return;

    const searchTerm = (this.searchInputEl?.value || '').toLowerCase();
    const modeFilter = this.filterModeEl?.value || '';
    const typeFilter = this.filterTypeEl?.value || '';

    const filtered = this.lobbies.filter((lobby) => {
      const matchesSearch = lobby.leader.username.toLowerCase().includes(searchTerm);
      const matchesMode = !modeFilter || lobby.mode === modeFilter;
      const matchesType =
        !typeFilter || (typeFilter === 'public' ? !lobby.isPrivate : lobby.isPrivate);

      return matchesSearch && matchesMode && matchesType;
    });

    if (filtered.length === 0) {
      this.lobbyListEl.innerHTML = `
        <div class="col-span-full text-center text-neutral-400 py-8">
          ${t('findGame.state.empty')}
        </div>
      `;
      return;
    }

    this.lobbyListEl.innerHTML = '';
    filtered.forEach((lobby) => {
      const card = this.createLobbyCard(lobby);
      this.lobbyListEl?.appendChild(card);
    });
  }

  private createLobbyCard(lobby: GameLobby): HTMLElement {
    const card = document.createElement('div');
    card.className =
      'rounded-lg bg-neutral-800 border border-neutral-700 p-4 hover:border-neutral-600 transition';

    const isPrivate = lobby.isPrivate;
    const isFull = lobby.players >= lobby.maxPlayers;
    const isMyLobby = this.currentUser?.id === lobby.leader.id;
    const statusColor =
      lobby.status === 'playing' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300';

    card.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <div>
          <h3 class="text-lg font-bold text-white">${t('findGame.card.title', {
            leader: lobby.leader.username,
          })}</h3>
          <p class="text-sm text-neutral-400">
            ${isPrivate ? t('findGame.type.private') : t('findGame.type.public')} &bull; ${this.getModeLabel(lobby.mode)}
          </p>
        </div>
        <span class="px-2 py-1 rounded text-xs font-medium ${statusColor}">
          ${this.getStatusLabel(lobby.status)}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div class="bg-neutral-900 rounded p-2">
          <div class="text-neutral-400">${t('findGame.card.players')}</div>
          <div class="text-lg font-bold">${lobby.players}/${lobby.maxPlayers}</div>
        </div>
        <div class="bg-neutral-900 rounded p-2">
          <div class="text-neutral-400">${t('findGame.card.created')}</div>
          <div class="text-xs font-bold">${formatTime(lobby.createdAt)}</div>
        </div>
      </div>

      ${
        isPrivate && isMyLobby && this.myLobbies.has(lobby.id)
          ? `
        <div class="mb-3 p-2 bg-neutral-900 rounded border border-neutral-600">
          <div class="text-xs text-neutral-400 mb-1">${t('findGame.card.code')}</div>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-sm font-mono font-bold text-blue-400">${this.myLobbies.get(lobby.id) || ''}</code>
            <button class="copy-code-btn px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition" data-code="${this.myLobbies.get(lobby.id) || ''}">${t('findGame.card.copy')}</button>
          </div>
        </div>
      `
          : ''
      }

      <div class="flex gap-2">
        ${
          isMyLobby
            ? `
              <button class="flex-1 px-3 py-2 rounded bg-blue-700 hover:bg-blue-600 text-sm font-medium transition" data-action="manage" data-lobby-id="${lobby.id}">${t('findGame.card.manage')}</button>
              <button class="flex-1 px-3 py-2 rounded bg-red-700 hover:bg-red-600 text-sm font-medium transition" data-action="remove" data-lobby-id="${lobby.id}">${t('findGame.card.remove')}</button>
            `
            : `<button class="flex-1 px-3 py-2 rounded ${
                isFull ? 'bg-neutral-700 cursor-not-allowed opacity-50' : 'bg-green-700 hover:bg-green-600'
              } text-sm font-medium transition join-lobby-btn" data-lobby-id="${lobby.id}" ${isFull ? 'disabled' : ''}>
                ${isFull ? t('findGame.card.full') : t('findGame.card.join')}
              </button>`
        }
      </div>
    `;

    card.querySelector('.copy-code-btn')?.addEventListener('click', (event) => {
      const button = event.target as HTMLButtonElement;
      const code = button.dataset.code;
      if (!code) return;

      navigator.clipboard.writeText(code);
      button.textContent = t('findGame.card.copied');
      setTimeout(() => {
        button.textContent = t('findGame.card.copy');
      }, 2000);
    });

    card.querySelector('.join-lobby-btn')?.addEventListener('click', () => {
      this.joinLobby(lobby);
    });

    card.querySelector('[data-action="manage"]')?.addEventListener('click', () => {
      this.navigateToLobby(lobby.id);
    });

    card.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
      this.removeLobby(lobby.id);
    });

    return card;
  }

  private openCreateModal(): void {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-neutral-800 rounded-lg p-6 w-full max-w-md border border-neutral-700">
        <h2 class="text-2xl font-bold mb-4">${t('findGame.modal.title')}</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">${t('findGame.modal.gameMode')}</label>
            <select id="mode-select" class="w-full px-3 py-2 rounded bg-neutral-700 border border-neutral-600 focus:border-blue-500 outline-none">
              <option value="1v1">${t('findGame.mode.1v1')}</option>
              <option value="2v2">${t('findGame.mode.2v2')}</option>
              <option value="3v3">${t('findGame.mode.3v3')}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">${t('findGame.modal.lobbyType')}</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="lobby-type" value="public" checked class="w-4 h-4" />
                <span class="text-sm">${t('findGame.type.public')}</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="lobby-type" value="private" class="w-4 h-4" />
                <span class="text-sm">${t('findGame.modal.privateGenerate')}</span>
              </label>
            </div>
          </div>

          <div id="code-preview" class="hidden p-3 bg-neutral-900 rounded border border-neutral-600">
            <div class="text-xs text-neutral-400 mb-2">${t('findGame.modal.codePreview')}</div>
            <div class="flex items-center gap-2">
              <code id="preview-code" class="flex-1 text-sm font-mono font-bold text-blue-400"></code>
              <button id="copy-preview" type="button" class="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition">${t('findGame.card.copy')}</button>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button id="btn-cancel" type="button" class="flex-1 px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 font-medium transition">${t('findGame.modal.cancel')}</button>
            <button id="btn-create" type="button" class="flex-1 px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 font-medium transition">${t('findGame.modal.create')}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.createLobbyModal = modal;

    const radios = modal.querySelectorAll('input[name="lobby-type"]');
    const codePreview = modal.querySelector('#code-preview');
    const previewCode = modal.querySelector('#preview-code');

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        const isPrivate = (radio as HTMLInputElement).value === 'private';
        if (isPrivate && codePreview) {
          const code = this.generateLobbyCode();
          if (previewCode) previewCode.textContent = code;
          codePreview.classList.remove('hidden');
        } else if (codePreview) {
          codePreview.classList.add('hidden');
        }
      });
    });

    modal.querySelector('#copy-preview')?.addEventListener('click', () => {
      const code = (previewCode as HTMLElement)?.textContent;
      const button = modal.querySelector('#copy-preview') as HTMLButtonElement | null;
      if (!code || !button) return;

      navigator.clipboard.writeText(code);
      button.textContent = t('findGame.card.copied');
      setTimeout(() => {
        button.textContent = t('findGame.card.copy');
      }, 2000);
    });

    modal.querySelector('#btn-create')?.addEventListener('click', () => {
      const modeSelect = modal.querySelector('#mode-select') as HTMLSelectElement;
      const typeRadio = modal.querySelector(
        'input[name="lobby-type"]:checked'
      ) as HTMLInputElement;
      const mode = modeSelect.value;
      const isPrivate = typeRadio.value === 'private';
      const code = isPrivate ? (previewCode as HTMLElement)?.textContent || '' : '';

      this.createLobby(mode, isPrivate, code);
    });

    modal.querySelector('#btn-cancel')?.addEventListener('click', () => {
      this.closeCreateModal();
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        this.closeCreateModal();
      }
    });
  }

  private closeCreateModal(): void {
    if (this.createLobbyModal?.parentNode) {
      this.createLobbyModal.parentNode.removeChild(this.createLobbyModal);
      this.createLobbyModal = null;
    }
  }

  private generateLobbyCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private createLobby(mode: string, isPrivate: boolean, code: string): void {
    const user = this.currentUser;
    this.socket?.emit('createLobby', {
      mode,
      isPrivate,
      code: isPrivate ? code : undefined,
      leaderName: user?.username || t('findGame.user.unknown'),
      leaderAvatar: user ? getUserAvatarUrl(user) : null,
    });
  }

  private joinLobby(lobby: GameLobby): void {
    let privateCode: string | undefined;
    if (lobby.isPrivate) {
      const input = window.prompt(t('findGame.prompt.privateCode'));
      if (input === null) return;
      privateCode = input.trim().toUpperCase();
      if (!privateCode) {
        alert(t('findGame.validation.codeRequired'));
        return;
      }
    }

    const user = this.currentUser;
    this.socket?.emit('joinLobbyById', {
      lobbyId: lobby.id,
      code: privateCode,
      username: user?.username || t('findGame.user.unknown'),
      avatarUrl: user ? getUserAvatarUrl(user) : null,
    });
  }

  private navigateToLobby(lobbyId: string): void {
    navigateTo(`/lobby?id=${lobbyId}`);
  }

  private removeLobby(lobbyId: string): void {
    const confirmed = window.confirm(t('findGame.confirm.removeLobby'));
    if (!confirmed) return;

    this.socket?.emit('deleteLobby', { lobbyId });
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const toast = document.createElement('div');
    const baseClasses =
      'fixed top-4 right-4 z-[1000] px-4 py-3 rounded-md text-sm font-medium shadow-lg border';
    const variantClasses =
      type === 'success'
        ? 'bg-green-900 text-green-200 border-green-700'
        : 'bg-red-900 text-red-200 border-red-700';

    toast.className = `${baseClasses} ${variantClasses}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  public onDestroy(): void {
    this.destroyOwnedUi();

    if (this.socket) {
      this.socket.off('connect', this.onSocketConnect);
      this.socket.off('disconnect', this.onSocketDisconnect);
      this.socket.off('lobbyUpdated', this.onLobbyUpdated);
      this.socket.off('lobbyDeleted', this.onLobbyDeleted);
      this.socket.off('availableLobbies', this.onAvailableLobbies);
      this.socket.off('lobbyListChanged', this.onLobbyListChanged);
      this.socket.off('lobbyCreated', this.onLobbyCreated);
      this.socket.off('joinLobbySuccess', this.onJoinLobbySuccess);
      this.socket.off('joinLobbyError', this.onJoinLobbyError);
      this.socket.off('deleteLobbyError', this.onDeleteLobbyError);
      this.socket.off('error', this.onSocketError);
    }

    if (this.userStoreSubscription) {
      this.userStoreSubscription();
      this.userStoreSubscription = null;
    }

    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.closeCreateModal();
    this.lobbies = [];
    this.currentUser = null;
    this.isRefreshing = false;
  }

  private destroyOwnedUi(): void {
    this.navbar?.onDestroy();
    this.navbar = null;
  }

  private getModeLabel(mode: GameLobby['mode']): string {
    if (mode === '2v2') return t('findGame.mode.2v2');
    if (mode === '3v3') return t('findGame.mode.3v3');
    return t('findGame.mode.1v1');
  }

  private getStatusLabel(status: GameLobby['status']): string {
    if (status === 'playing') return t('findGame.status.playing');
    if (status === 'ready') return t('findGame.status.ready');
    return t('findGame.status.waiting');
  }
}
