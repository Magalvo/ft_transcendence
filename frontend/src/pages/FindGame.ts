import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { UserStore } from '../core/UserStore';
import { socketService } from '../client/SocketService';
import { router } from '../main';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../core/UserStore';

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
  code?: string; // For private lobbies
  createdAt: number;
  status: 'waiting' | 'ready' | 'playing';
}

export class FindGamePage extends AbstractComponent {
  private socket: Socket | null = null;
  private lobbies: GameLobby[] = [];
  private currentUser: UserProfile | null = null;
  private userStoreSubscription: (() => void) | null = null;
  private lobbyListEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private filterModeEl: HTMLSelectElement | null = null;
  private filterTypeEl: HTMLSelectElement | null = null;
  private createLobbyModal: HTMLElement | null = null;
  private myLobbies: Map<string, string> = new Map();
  private refreshTimer: number | null = null;
  private isRefreshing = false;
  private onSocketConnect = (): void => {
    console.log('🔍 Connected to game finder');
    this.isRefreshing = false;
    this.refreshLobbies();
  };
  private onSocketDisconnect = (): void => {
    console.log('❌ Disconnected from game finder');
    this.isRefreshing = false;
  };
  private onAvailableLobbies = (lobbies: GameLobby[] | undefined): void => {
    const safeLobbies = Array.isArray(lobbies) ? lobbies : [];
    console.log('📋 Received lobbies:', safeLobbies.length);
    this.lobbies = safeLobbies;
    this.isRefreshing = false;
    this.renderLobbies();
  };
  private onLobbyListChanged = (): void => {
    console.log('🔄 Lobby list changed, refreshing...');
    this.refreshLobbies();
  };
  private onLobbyUpdated = (updatedLobby: GameLobby): void => {
    console.log('🔄 Lobby updated:', updatedLobby.id);
    // Find and update the specific lobby in the list
    const index = this.lobbies.findIndex(lobby => lobby.id === updatedLobby.id);
    if (index !== -1) {
      this.lobbies[index] = updatedLobby;
      this.renderLobbies();
    } else {
      // Lobby not in list, add it
      this.lobbies.push(updatedLobby);
      this.renderLobbies();
    }
  };
  private onLobbyDeleted = (data: { lobbyId: string }): void => {
    console.log('🗑️ Lobby deleted:', data.lobbyId);
    // Remove the lobby from the list
    this.lobbies = this.lobbies.filter(lobby => lobby.id !== data.lobbyId);
    this.renderLobbies();
  };
  private onLobbyCreated = (data: { lobbyId: string; code?: string }): void => {
    console.log('✅ Lobby created:', data);
    if (data.code) {
      this.myLobbies.set(data.lobbyId, data.code);
    }
    this.refreshLobbies();
    this.closeCreateModal();
  };
  private onJoinLobbySuccess = (data: { lobbyId: string }): void => {
    console.log('🎮 Successfully joined lobby:', data.lobbyId);
    router.navigate(`/lobby?id=${encodeURIComponent(data.lobbyId)}`);
  };
  private onJoinLobbyError = (data: { message: string }): void => {
    alert(`Failed to join lobby: ${data.message}`);
  };
  private onSocketError = (error: unknown): void => {
    console.error('🚨 Socket error:', error);
  };

  constructor() {
    super('div', 'flex flex-col h-screen bg-black overflow-auto');
  }

  public async render(): Promise<void> {
    this.element.innerHTML = '';

    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

    const container = document.createElement('div');
    container.className = 'flex-1 w-full p-6 bg-neutral-900 text-white';
    container.innerHTML = `
      <div class="max-w-6xl mx-auto">
        <div class="mb-8">
          <h1 class="text-3xl font-bold mb-2">Find a Game</h1>
          <p class="text-neutral-400">Browse lobbies or create your own</p>
        </div>

        <div class="flex gap-4 mb-6">
          <div class="flex-1">
            <input 
              id="search-lobbies" 
              type="text" 
              placeholder="Search by leader name..." 
              class="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
            />
          </div>
          <select 
            id="filter-mode" 
            class="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
          >
            <option value="">All Modes</option>
            <option value="1v1">1 vs 1</option>
            <option value="2v2">2 vs 2</option>
            <option value="3v3">3 vs 3</option>
          </select>
          <select 
            id="filter-type" 
            class="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
          >
            <option value="">All Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <button 
            id="btn-create-lobby" 
            class="px-6 py-2 rounded bg-blue-700 hover:bg-blue-600 font-medium transition"
          >
            Create Lobby
          </button>
          <button 
            id="btn-refresh-lobbies" 
            class="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 font-medium transition"
            title="Refresh lobby list"
          >
            🔄
          </button>
        </div>

        <div id="lobbies-container" class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <div class="col-span-full text-center text-neutral-400 py-8">Loading lobbies...</div>
        </div>
      </div>
    `;

    this.element.appendChild(container);

    this.lobbyListEl = container.querySelector('#lobbies-container');
    this.searchInputEl = container.querySelector('#search-lobbies') as HTMLInputElement;
    this.filterModeEl = container.querySelector('#filter-mode') as HTMLSelectElement;
    this.filterTypeEl = container.querySelector('#filter-type') as HTMLSelectElement;

    // Add event listeners
    this.searchInputEl?.addEventListener('input', () => this.renderLobbies());
    this.filterModeEl?.addEventListener('change', () => this.renderLobbies());
    this.filterTypeEl?.addEventListener('change', () => this.renderLobbies());
    container.querySelector('#btn-create-lobby')?.addEventListener('click', () => this.openCreateModal());
    container.querySelector('#btn-refresh-lobbies')?.addEventListener('click', () => this.refreshLobbies());

    // Initialize user subscription
    this.setupUserSubscription();
    
    // Initialize socket
    this.initSocket();
    
    // Start auto-refresh timer
    this.startAutoRefresh();
  }

  private setupUserSubscription(): void {
    // Get initial user
    this.currentUser = UserStore.getUser();
    
    // Subscribe to user changes
    this.userStoreSubscription = UserStore.subscribe((user) => {
      this.currentUser = user;
      console.log('👤 User data updated in FindGame:', user?.username);
      // Re-render to update "my lobbies" indicators if user changed
      this.renderLobbies();
    });
  }

  private startAutoRefresh(): void {
    // Refresh lobbies every 5 seconds
    this.refreshTimer = window.setInterval(() => {
      if (this.socket?.connected && !this.isRefreshing) {
        this.refreshLobbies();
      }
    }, 5000);
  }

  private refreshLobbies(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    console.log('🔄 Refreshing lobby list...');
    this.socket?.emit('requestAvailableLobbies');
  }

  private initSocket(): void {
    const currentUser = UserStore.getUser();
    const userId = currentUser?.id;
    this.socket = socketService.init('http://localhost:3000', userId);

    this.socket.on('connect', this.onSocketConnect);
    this.socket.on('disconnect', this.onSocketDisconnect);
    this.socket.on('availableLobbies', this.onAvailableLobbies);
    this.socket.on('lobbyListChanged', this.onLobbyListChanged);
    this.socket.on('lobbyUpdated', this.onLobbyUpdated);
    this.socket.on('lobbyDeleted', this.onLobbyDeleted);
    this.socket.on('lobbyCreated', this.onLobbyCreated);
    this.socket.on('joinLobbySuccess', this.onJoinLobbySuccess);
    this.socket.on('joinLobbyError', this.onJoinLobbyError);
    this.socket.on('error', this.onSocketError);

    if (this.socket.connected) {
      console.log('📡 Already connected, requesting lobbies');
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
      this.lobbyListEl.innerHTML =
        '<div class="col-span-full text-center text-neutral-400 py-8">No lobbies found. Create one!</div>';
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
          <h3 class="text-lg font-bold text-white">${lobby.leader.username}'s Game</h3>
          <p class="text-sm text-neutral-400">
            ${isPrivate ? '🔐 Private' : '🔓 Public'} • ${lobby.mode}
          </p>
        </div>
        <span class="px-2 py-1 rounded text-xs font-medium ${statusColor}">
          ${lobby.status.toUpperCase()}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div class="bg-neutral-900 rounded p-2">
          <div class="text-neutral-400">Players</div>
          <div class="text-lg font-bold">${lobby.players}/${lobby.maxPlayers}</div>
        </div>
        <div class="bg-neutral-900 rounded p-2">
          <div class="text-neutral-400">Created</div>
          <div class="text-xs font-bold">${new Date(lobby.createdAt).toLocaleTimeString()}</div>
        </div>
      </div>

      ${
        isPrivate && lobby.code
          ? `
        <div class="mb-3 p-2 bg-neutral-900 rounded border border-neutral-600">
          <div class="text-xs text-neutral-400 mb-1">Code</div>
          <div class="flex items-center gap-2">
            <code class="flex-1 text-sm font-mono font-bold text-blue-400">${lobby.code}</code>
            <button class="copy-code-btn px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition" data-code="${lobby.code}">Copy</button>
          </div>
        </div>
      `
          : ''
      }

      <div class="flex gap-2">
        ${
          isMyLobby
            ? `<button class="flex-1 px-3 py-2 rounded bg-blue-700 hover:bg-blue-600 text-sm font-medium transition" data-action="manage" data-lobby-id="${lobby.id}">Manage</button>`
            : `<button class="flex-1 px-3 py-2 rounded ${
                isFull ? 'bg-neutral-700 cursor-not-allowed opacity-50' : 'bg-green-700 hover:bg-green-600'
              } text-sm font-medium transition join-lobby-btn" data-lobby-id="${lobby.id}" ${isFull ? 'disabled' : ''}>
                ${isFull ? 'FULL' : 'JOIN'}
              </button>`
        }
      </div>
    `;

    // Copy code button
    card.querySelector('.copy-code-btn')?.addEventListener('click', (e) => {
      const code = (e.target as HTMLButtonElement).dataset.code;
      if (code) {
        navigator.clipboard.writeText(code);
        const btn = e.target as HTMLButtonElement;
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = original;
        }, 2000);
      }
    });

    // Join button
    card.querySelector('.join-lobby-btn')?.addEventListener('click', () => {
      const lobbyId = (card.querySelector('.join-lobby-btn') as HTMLElement).dataset.lobbyId;
      if (lobbyId) {
        this.joinLobby(lobbyId);
      }
    });

    // Manage button
    card.querySelector('[data-action="manage"]')?.addEventListener('click', () => {
      const lobbyId = (card.querySelector('[data-action="manage"]') as HTMLElement).dataset.lobbyId;
      if (lobbyId) {
        this.navigateToLobby(lobbyId);
      }
    });

    return card;
  }

  private openCreateModal(): void {
    const modal = document.createElement('div');
    modal.className =
      'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-neutral-800 rounded-lg p-6 w-full max-w-md border border-neutral-700">
        <h2 class="text-2xl font-bold mb-4">Create Lobby</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Game Mode</label>
            <select id="mode-select" class="w-full px-3 py-2 rounded bg-neutral-700 border border-neutral-600 focus:border-blue-500 outline-none">
              <option value="1v1">1 vs 1</option>
              <option value="2v2">2 vs 2</option>
              <option value="3v3">3 vs 3</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Lobby Type</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="lobby-type" value="public" checked class="w-4 h-4" />
                <span class="text-sm">Public</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="lobby-type" value="private" class="w-4 h-4" />
                <span class="text-sm">Private (generate code)</span>
              </label>
            </div>
          </div>

          <div id="code-preview" class="hidden p-3 bg-neutral-900 rounded border border-neutral-600">
            <div class="text-xs text-neutral-400 mb-2">Your Lobby Code</div>
            <div class="flex items-center gap-2">
              <code id="preview-code" class="flex-1 text-sm font-mono font-bold text-blue-400"></code>
              <button id="copy-preview" type="button" class="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 rounded text-xs transition">Copy</button>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button id="btn-cancel" type="button" class="flex-1 px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 font-medium transition">Cancel</button>
            <button id="btn-create" type="button" class="flex-1 px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 font-medium transition">Create</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.createLobbyModal = modal;

    // Handle lobby type radio change
    const radios = modal.querySelectorAll('input[name="lobby-type"]');
    const codePreview = modal.querySelector('#code-preview');
    const previewCode = modal.querySelector('#preview-code');

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        const isPrivate = (radio as HTMLInputElement).value === 'private';
        if (isPrivate && codePreview) {
          // Generate code
          const code = this.generateLobbyCode();
          if (previewCode) previewCode.textContent = code;
          codePreview.classList.remove('hidden');
        } else if (codePreview) {
          codePreview.classList.add('hidden');
        }
      });
    });

    // Copy code button
    modal.querySelector('#copy-preview')?.addEventListener('click', () => {
      const code = (previewCode as HTMLElement)?.textContent;
      if (code) {
        navigator.clipboard.writeText(code);
        const btn = modal.querySelector('#copy-preview') as HTMLButtonElement;
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = original;
        }, 2000);
      }
    });

    // Create button
    modal.querySelector('#btn-create')?.addEventListener('click', () => {
      const modeSelect = modal.querySelector('#mode-select') as HTMLSelectElement;
      const typeRadio = modal.querySelector('input[name="lobby-type"]:checked') as HTMLInputElement;
      const mode = modeSelect.value;
      const isPrivate = typeRadio.value === 'private';
      const code = isPrivate ? ((previewCode as HTMLElement)?.textContent || '') : '';

      this.createLobby(mode, isPrivate, code);
    });

    // Cancel button
    modal.querySelector('#btn-cancel')?.addEventListener('click', () => {
      this.closeCreateModal();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeCreateModal();
      }
    });
  }

  private closeCreateModal(): void {
    if (this.createLobbyModal && this.createLobbyModal.parentNode) {
      this.createLobbyModal.parentNode.removeChild(this.createLobbyModal);
      this.createLobbyModal = null;
    }
  }

  private generateLobbyCode(): string {
    // Generate a 6-character alphanumeric code like: ABC123
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private createLobby(mode: string, isPrivate: boolean, code: string): void {
    console.log(`📋 Creating ${isPrivate ? 'private' : 'public'} ${mode} lobby`);
    const user = this.currentUser;
    this.socket?.emit('createLobby', {
      mode,
      isPrivate,
      code: isPrivate ? code : undefined,
      leaderName: user?.username || 'Unknown',
      leaderAvatar: user?.avatarUrl || null,
    });
  }

  private joinLobby(lobbyId: string): void {
    console.log(`🎮 Attempting to join lobby ${lobbyId}`);
    const user = this.currentUser;
    this.socket?.emit('joinLobbyById', {
      lobbyId,
      username: user?.username || 'Unknown',
      avatarUrl: user?.avatarUrl || null,
    });
  }

  private navigateToLobby(lobbyId: string): void {
    console.log(`🎮 Navigating to lobby ${lobbyId}`);
    router.navigate(`/lobby?id=${lobbyId}`);
  }

  public onDestroy(): void {
    console.log('🧹 FindGame cleanup: Removing listeners and subscriptions');
    
    // Clean up socket listeners
    if (this.socket) {
      this.socket.off('connect', this.onSocketConnect);
      this.socket.off('disconnect', this.onSocketDisconnect);
      this.socket.off('availUpdated', this.onLobbyUpdated);
      this.socket.off('lobbyDeleted', this.onLobbyDeleted);
      this.socket.off('lobbyableLobbies', this.onAvailableLobbies);
      this.socket.off('lobbyListChanged', this.onLobbyListChanged);
      this.socket.off('lobbyCreated', this.onLobbyCreated);
      this.socket.off('joinLobbySuccess', this.onJoinLobbySuccess);
      this.socket.off('joinLobbyError', this.onJoinLobbyError);
      this.socket.off('error', this.onSocketError);
    }
    
    // Clean up user store subscription
    if (this.userStoreSubscription) {
      this.userStoreSubscription();
      this.userStoreSubscription = null;
    }
    
    // Clean up refresh timer
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Clean up modal
    this.closeCreateModal();
    
    // Reset state
    this.lobbies = [];
    this.currentUser = null;
    this.isRefreshing = false;
  }
}
