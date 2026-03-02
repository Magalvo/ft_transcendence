import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { socketService } from '../client/SocketService';
import { UserStore } from '../core/UserStore';
import { router } from '../main';
import type { Socket } from 'socket.io-client';
import { TokenManager } from '../services/TokenManager';

type SlotContent = 'empty' | 'human' | 'bot';

interface LobbySlot {
    index: number;
    content: SlotContent;
    playerName?: string;
    socketId?: string;
    botLevel?: number;
}

interface BenchPlayer {
    socketId: string;
    username: string;
    userId?: string;
}

interface LobbyState {
    leader: string;
    isReadyToStart: boolean;
    config: {
        players_per_side?: number;
        paddles_per_side?: number;
        duration_label: string;
        power_ups: boolean;
    };
    slots: {
        left: LobbySlot[];
        right: LobbySlot[];
    };
    bench: BenchPlayer[];
    playerData?: Record<string, { userId: string; username: string }>;
}

export class LobbyPage extends AbstractComponent {
    private socket: Socket | null = null;
    private isLeader = false;
    private myId = '';
    private selectedBenchPlayer: string | null = null;
    private currentPowerUpsState = true;
    private isTransitioningToGame = false;
    private selectedLobbyId: string | null = null;

    private slotsLeftEl: HTMLElement | null = null;
    private slotsRightEl: HTMLElement | null = null;
    private benchListEl: HTMLElement | null = null;
    private leaderControls: HTMLElement | null = null;
    private btnStart: HTMLButtonElement | null = null;
    private leaderMsg: HTMLElement | null = null;
    private powerUpsButton: HTMLButtonElement | null = null;
    private btnLeave: HTMLButtonElement | null = null;

   
    private btnMode1: HTMLButtonElement | null = null;
    private btnMode2: HTMLButtonElement | null = null;
    private btnMode3: HTMLButtonElement | null = null;

    
    private btnDurFast: HTMLButtonElement | null = null;
    private btnDurNormal: HTMLButtonElement | null = null;
    private btnDurLong: HTMLButtonElement | null = null;

    private onSocketConnect = (): void => {
        this.myId = this.socket?.id ?? '';
        const userId = UserStore.getUser()?.id || TokenManager.getUser()?.id;
        if (userId) {
            this.socket?.emit('userAuth', { userId });
        }
        console.log(' Lobby: Socket connected, joining lobby');
        this.joinRequestedLobby();
    };

    private onLobbyState = (state: LobbyState): void => {
        this.renderLobby(state);
    };

    private onGameStarted = (): void => {
        console.log('🎮 Game starting, transitioning to game page');
        this.isTransitioningToGame = true;
        router.navigate('/game');
    };

    private onKicked = (data: { message: string }): void => {
        alert(data.message);
        console.log('👢 Player was kicked from lobby');
        router.navigate('/');
    };

    private onJoinLobbyError = (data: { message: string }): void => {
        alert(`Failed to join lobby: ${data.message}`);
        router.navigate('/find-game');
    };

    constructor() {
        super('div', 'flex flex-col h-screen bg-black overflow-auto');
    }

    public render(): void {
        this.element.innerHTML = '';

        const navbar = new Navbar();
        navbar.render();
        this.element.appendChild(navbar.getElement());

        const container = document.createElement('div');
        container.className = 'flex-1 w-full h-full p-5 bg-neutral-900 text-white';
        container.innerHTML = `
            <div id="lobby-view" class="flex flex-col items-center gap-5">
                <div class="text-center">
                    <h1 class="text-3xl font-bold">Game Lobby</h1>
                    <div id="leader-msg" class="hidden text-yellow-400 mt-2">👑 You are the Party Leader</div>
                </div>

                <div class="flex gap-3" id="leader-controls">
                    <button id="btn-mode-1" class="rounded bg-neutral-700 px-4 py-2 transition ring-offset-2">1 vs 1</button>
                    <button id="btn-mode-2" class="rounded bg-neutral-700 px-4 py-2 transition ring-offset-2">2 vs 2</button>
                    <button id="btn-mode-3" class="rounded bg-neutral-700 px-4 py-2 transition ring-offset-2">3 vs 3</button>
                </div>

                <div class="w-full max-w-5xl rounded bg-neutral-800 p-4">
                    <h3 class="text-center text-neutral-300 mb-3">Settings</h3>
                    <div class="flex flex-wrap justify-center gap-4" id="settings-controls">
                        <div class="flex items-center gap-2">
                            <span>Duration:</span>
                            <button id="btn-dur-fast" class="rounded bg-neutral-700 px-3 py-2 transition ring-offset-2">Fast</button>
                            <button id="btn-dur-normal" class="rounded bg-neutral-700 px-3 py-2 transition ring-offset-2">Normal</button>
                            <button id="btn-dur-long" class="rounded bg-neutral-700 px-3 py-2 transition ring-offset-2">Long</button>
                        </div>
                        <button id="btn-powerups" class="rounded bg-green-700 px-4 py-2 transition ring-offset-2">Power Ups: ON</button>
                    </div>
                </div>

                <div class="flex w-full max-w-5xl flex-col gap-4 lg:flex-row">
                    <div class="flex-1 rounded bg-neutral-800 p-3">
                        <h3 class="mb-3 text-center text-neutral-300">LEFT TEAM</h3>
                        <div id="slots-left" class="flex flex-col gap-2"></div>
                    </div>

                    <div class="w-full rounded border border-dashed border-neutral-600 bg-neutral-900 p-3 lg:w-64">
                        <h3 class="mb-3 text-center text-neutral-300">BENCH</h3>
                        <div id="bench-list" class="flex flex-col gap-2"></div>
                    </div>

                    <div class="flex-1 rounded bg-neutral-800 p-3">
                        <h3 class="mb-3 text-center text-neutral-300">RIGHT TEAM</h3>
                        <div id="slots-right" class="flex flex-col gap-2"></div>
                    </div>
                </div>

                <button id="btn-start" class="rounded bg-green-700 px-6 py-3 text-lg font-bold" disabled>
                    START GAME
                </button>

                <button id="btn-leave" class="rounded bg-red-700 px-6 py-3 text-lg font-bold hover:bg-red-800 transition">
                    LEAVE LOBBY
                </button>
            </div>
        `;

        this.slotsLeftEl = container.querySelector('#slots-left');
        this.slotsRightEl = container.querySelector('#slots-right');
        this.benchListEl = container.querySelector('#bench-list');
        this.leaderControls = container.querySelector('#leader-controls');
        this.btnStart = container.querySelector('#btn-start');
        this.leaderMsg = container.querySelector('#leader-msg');
        this.powerUpsButton = container.querySelector('#btn-powerups');

        this.btnMode1 = container.querySelector('#btn-mode-1');
        this.btnMode2 = container.querySelector('#btn-mode-2');
        this.btnMode3 = container.querySelector('#btn-mode-3');

        this.btnDurFast = container.querySelector('#btn-dur-fast');
        this.btnDurNormal = container.querySelector('#btn-dur-normal');
        this.btnDurLong = container.querySelector('#btn-dur-long');
        this.btnLeave = container.querySelector('#btn-leave');

        const params = new URLSearchParams(window.location.search);
        this.selectedLobbyId = params.get('id');

        this.bindUiActions();

        this.element.appendChild(container);

        this.initSocket();
    }

    private bindUiActions(): void {
        this.btnMode1?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_setMode', 'one_for_one');
        });
        this.btnMode2?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_setMode', 'two_for_two');
        });
        this.btnMode3?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_setMode', 'three_for_three');
        });

        this.btnDurFast?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_setDuration', 'fast');
        });
        this.btnDurNormal?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_setDuration', 'normal');
        });
        this.btnDurLong?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_setDuration', 'long');
        });

        this.powerUpsButton?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_setPowerUps', !this.currentPowerUpsState);
        });

        this.btnStart?.addEventListener('click', () => {
            if (!this.isLeader) return;
            this.socket?.emit('lobby_start');
        });

        this.btnLeave?.addEventListener('click', () => {
            console.log('Leaving lobby');
            if (confirm('Are you sure you want to leave the lobby?')) {
                this.leaveCurrentLobby();
               
                router.navigate('/');
            }
        });
    }

    private joinRequestedLobby(): void {
        if (!this.socket) return;

        const params = new URLSearchParams(window.location.search);
        const inviteSession = params.get('inviteSession');
        const lobbyId = params.get('id');

        if (lobbyId) {
            this.selectedLobbyId = lobbyId;
            console.log(`🎮 Joining specific lobby: ${lobbyId}`);
            this.socket.emit('joinLobbyById', { lobbyId });
            return;
        }

        if (inviteSession) {
            console.log(`🎮 Emitting joinLobby with invitation: ${inviteSession}`);
            this.socket.emit('joinLobby', { inviteSession });
            return;
        }

        this.socket.emit('joinLobby');
    }

    private leaveCurrentLobby(): void {
        if (!this.socket) return;

        if (this.selectedLobbyId) {
            this.socket.emit('leaveLobbyById', { lobbyId: this.selectedLobbyId });
            return;
        }

        this.socket.emit('lobby_leave');
    }

    private initSocket(): void {
        const currentUser = UserStore.getUser() || TokenManager.getUser();
        const userId = currentUser?.id;
        this.socket = socketService.init(undefined, userId);

        this.myId = this.socket?.id ?? '';
        console.log(` Lobby: My socket ID is ${this.myId}`);

        this.socket.on('connect', this.onSocketConnect);
        this.socket.on('lobbyState', this.onLobbyState);
        this.socket.on('gameStarted', this.onGameStarted);
        this.socket.on('kicked', this.onKicked);
        this.socket.on('joinLobbyError', this.onJoinLobbyError);


        if (this.socket.connected) {
            console.log('📡 Lobby: Socket already connected, joining lobby');
            this.joinRequestedLobby();
        }
    }

    private renderLobby(state: LobbyState): void {
        if (!this.slotsLeftEl || !this.slotsRightEl || !this.benchListEl || !this.btnStart || !this.leaderControls || !this.leaderMsg) {
            return;
        }

        this.isLeader = state.leader === this.myId;
        this.currentPowerUpsState = state.config.power_ups;

        // UI do Leader
        this.leaderControls.classList.toggle('hidden', !this.isLeader);
        this.leaderMsg.classList.toggle('hidden', !this.isLeader);

        // UI do Botão Start
        const ready = this.isLeader && state.isReadyToStart;
        this.btnStart.disabled = !ready;
        this.btnStart.textContent = this.isLeader ? (ready ? 'START GAME' : 'Fill all slots to start') : 'Waiting for Leader...';
        this.btnStart.classList.toggle('opacity-50', !ready);
        this.btnStart.classList.toggle('cursor-not-allowed', !ready);

        // Desativar visualmente botões de settings para não líderes
        const settingsBtns = [this.btnMode1, this.btnMode2, this.btnMode3, this.btnDurFast, this.btnDurNormal, this.btnDurLong, this.powerUpsButton];
        settingsBtns.forEach(btn => {
            if (btn) {
                btn.disabled = !this.isLeader;
                btn.classList.toggle('opacity-50', !this.isLeader);
                btn.classList.toggle('cursor-not-allowed', !this.isLeader);
            }
        });

        // HIGHLIGHT DOS MODOS
        const players = state.config.players_per_side || state.config.paddles_per_side;
        this.btnMode1?.classList.toggle('ring-2', players === 1);
        this.btnMode1?.classList.toggle('ring-yellow-400', players === 1);
        this.btnMode2?.classList.toggle('ring-2', players === 2);
        this.btnMode2?.classList.toggle('ring-yellow-400', players === 2);
        this.btnMode3?.classList.toggle('ring-2', players === 3);
        this.btnMode3?.classList.toggle('ring-yellow-400', players === 3);

        // HIGHLIGHT DAS DURAÇÕES
        const dur = state.config.duration_label;
        this.btnDurFast?.classList.toggle('ring-2', dur === 'fast');
        this.btnDurFast?.classList.toggle('ring-yellow-400', dur === 'fast');
        this.btnDurNormal?.classList.toggle('ring-2', dur === 'normal');
        this.btnDurNormal?.classList.toggle('ring-yellow-400', dur === 'normal');
        this.btnDurLong?.classList.toggle('ring-2', dur === 'long');
        this.btnDurLong?.classList.toggle('ring-yellow-400', dur === 'long');

        // BOTÃO DE POWER UPS
        if (this.powerUpsButton) {
            this.powerUpsButton.textContent = `Power Ups: ${this.currentPowerUpsState ? 'ON' : 'OFF'}`;
            this.powerUpsButton.classList.toggle('bg-green-700', this.currentPowerUpsState);
            this.powerUpsButton.classList.toggle('bg-red-700', !this.currentPowerUpsState);
        }

        this.renderTeamSlots(this.slotsLeftEl, state.slots.left, 'left', state.playerData);
        this.renderTeamSlots(this.slotsRightEl, state.slots.right, 'right', state.playerData);
        this.renderBench(state.bench);
    }

    private renderBench(bench: BenchPlayer[]): void {
        if (!this.benchListEl) return;
        this.benchListEl.innerHTML = '';

        bench.forEach((player) => {
            const playerEl = document.createElement('button');
            playerEl.type = 'button';
            playerEl.id = `bench-${player.socketId}`;
            playerEl.className = 'w-full rounded border border-transparent bg-neutral-700 px-3 py-2 text-left transition';
            playerEl.textContent = `👤 ${player.username}`;

            if (player.socketId === this.myId) playerEl.classList.add('ring-1', 'ring-yellow-400');

            if (this.selectedBenchPlayer === player.socketId) {
                playerEl.classList.remove('border-transparent');
                playerEl.classList.add('border-cyan-400', 'bg-neutral-600');
            }

            if (this.isLeader) {
                playerEl.addEventListener('click', () => {
                    this.selectedBenchPlayer = player.socketId;
                    this.renderBench(bench);
                });
            } else {
                playerEl.disabled = true;
                playerEl.classList.add('opacity-80', 'cursor-default');
            }

            this.benchListEl?.appendChild(playerEl);
        });
    }

    private renderTeamSlots(container: HTMLElement, slots: LobbySlot[], side: 'left' | 'right', playerData?: Record<string, { userId: string; username: string }>): void {
        container.innerHTML = '';

        slots.forEach((slot) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between rounded border-2 border-neutral-600 bg-neutral-700 px-3 py-3 h-[52px]';

            if (slot.content === 'empty') {
                row.classList.add('border-dashed', 'opacity-70');
                row.textContent = '[ Empty Slot ]';
                if (this.isLeader) {
                    row.classList.add('cursor-pointer', 'hover:bg-neutral-600');
                    row.addEventListener('click', () => {
                        if (!this.socket) return;
                        if (!this.selectedBenchPlayer) {
                            this.socket.emit('lobby_addBot', { side, slotIndex: slot.index });
                            return;
                        }

                        this.socket.emit('lobby_movePlayer', {
                            targetId: this.selectedBenchPlayer,
                            side,
                            slotIndex: slot.index,
                        });
                        this.selectedBenchPlayer = null;
                    });
                }
            } else if (slot.content === 'human') {
                const label = document.createElement('span');
                
                const displayName = slot.playerName || (slot.socketId && playerData?.[slot.socketId]?.username) || 'Player';
                label.textContent = `👤 ${displayName}`;
                row.appendChild(label);

                if (this.isLeader && slot.socketId) {
                    const actions = document.createElement('div');
                    actions.className = 'flex gap-1';

                    const toBenchBtn = document.createElement('button');
                    toBenchBtn.type = 'button';
                    toBenchBtn.className = 'rounded bg-neutral-800 hover:bg-neutral-600 px-2 py-1 text-xs transition';
                    toBenchBtn.textContent = 'To Bench';
                    toBenchBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.socket?.emit('lobby_moveToBench', slot.socketId);
                    });

                    const kickBtn = document.createElement('button');
                    kickBtn.type = 'button';
                    kickBtn.className = 'rounded bg-red-700 hover:bg-red-600 px-2 py-1 text-xs transition';
                    kickBtn.textContent = 'Kick';
                    kickBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to kick ${displayName}?`)) {
                            this.socket?.emit('lobby_kick', { socketId: slot.socketId });
                        }
                    });

                    actions.append(toBenchBtn, kickBtn);
                    row.appendChild(actions);
                }
            } else {
                row.classList.replace('bg-neutral-700', 'bg-blue-900');
                row.classList.replace('border-neutral-600', 'border-blue-500');

                const label = document.createElement('span');
                label.textContent = `🤖 Bot Lvl ${slot.botLevel ?? 1}`;
                row.appendChild(label);

                if (this.isLeader) {
                    const actions = document.createElement('div');
                    actions.className = 'flex gap-1';

                    const createBtn = (text: string, colorClass: string, onClick: () => void) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = `rounded ${colorClass} hover:opacity-80 px-2 py-1 text-xs transition`;
                        btn.textContent = text;
                        btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
                        return btn;
                    };

                    actions.append(
                        createBtn('-', 'bg-neutral-800', () => this.socket?.emit('lobby_botLevel', { side, slotIndex: slot.index, delta: -1 })),
                        createBtn('+', 'bg-neutral-800', () => this.socket?.emit('lobby_botLevel', { side, slotIndex: slot.index, delta: 1 })),
                        createBtn('X', 'bg-red-700', () => this.socket?.emit('lobby_removeBot', { side, slotIndex: slot.index }))
                    );
                    row.appendChild(actions);
                }
            }

            container.appendChild(row);
        });
    }

    public onDestroy(): void {
        console.log('🧹 Lobby cleanup: Removing listeners');
        
        if (this.socket) {
            if (!this.isTransitioningToGame) {
                console.log('🚪 Leaving lobby (navigating away)');
                this.leaveCurrentLobby();
            } else {
                console.log('🎮 Transitioning to game, keeping lobby state');
            }
            
            this.socket.off('connect', this.onSocketConnect);
            this.socket.off('lobbyState', this.onLobbyState);
            this.socket.off('gameStarted', this.onGameStarted);
            this.socket.off('kicked', this.onKicked);
            this.socket.off('joinLobbyError', this.onJoinLobbyError);
            
           
            console.log('Lobby listeners removed');
        }
    }
}
