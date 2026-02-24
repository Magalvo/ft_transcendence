import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { GameScene } from '../client/GameScene';
import { io, type Socket } from 'socket.io-client';

type SlotContent = 'empty' | 'human' | 'bot';

interface LobbySlot {
    index: number;
    content: SlotContent;
    playerName?: string;
    socketId?: string;
    botLevel?: number;
}

interface LobbyState {
    leader: string;
    isReadyToStart: boolean;
    config: {
        players_per_side: number;
        duration_label: string;
        power_ups: boolean;
    };
    slots: {
        left: LobbySlot[];
        right: LobbySlot[];
    };
    bench: string[];
}

export class GamePage extends AbstractComponent {
    private gameScene: GameScene | null = null;
    private socket: Socket | null = null;
    private isLeader = false;
    private myId = '';
    private selectedBenchPlayer: string | null = null;
    private currentPowerUpsState = true;
    private gameStarted = false;

    private lobbyView: HTMLElement | null = null;
    private gameView: HTMLElement | null = null;
    private slotsLeftEl: HTMLElement | null = null;
    private slotsRightEl: HTMLElement | null = null;
    private benchListEl: HTMLElement | null = null;
    private leaderControls: HTMLElement | null = null;
    private btnStart: HTMLButtonElement | null = null;
    private leaderMsg: HTMLElement | null = null;
    private powerUpsButton: HTMLButtonElement | null = null;

    constructor() {
        super('div', 'flex flex-col h-screen bg-black overflow-hidden');
    }

    public render(): void {
        this.element.innerHTML = '';
        this.gameStarted = false;

        const navbar = new Navbar();
        navbar.render();
        this.element.appendChild(navbar.getElement());

        const container = document.createElement('div');
        container.className = 'flex-1 w-full h-full overflow-auto bg-neutral-900 text-white';
        container.innerHTML = `
            <div id="lobby-view" class="flex flex-col items-center gap-5 p-5">
                <div class="text-center">
                    <h1 class="text-3xl font-bold">Game Lobby</h1>
                    <div id="leader-msg" class="hidden text-yellow-400 mt-2">👑 You are the Party Leader</div>
                </div>

                <div class="flex gap-3" id="leader-controls">
                    <button id="btn-mode-1" class="rounded bg-neutral-700 px-4 py-2">1 vs 1</button>
                    <button id="btn-mode-2" class="rounded bg-neutral-700 px-4 py-2">2 vs 2</button>
                    <button id="btn-mode-3" class="rounded bg-neutral-700 px-4 py-2">3 vs 3</button>
                </div>

                <div class="w-full max-w-5xl rounded bg-neutral-800 p-4">
                    <h3 class="text-center text-neutral-300 mb-3">Settings</h3>
                    <div class="flex flex-wrap justify-center gap-4" id="settings-controls">
                        <div class="flex items-center gap-2">
                            <span>Duration:</span>
                            <button id="btn-dur-fast" class="rounded bg-neutral-700 px-3 py-2">Fast</button>
                            <button id="btn-dur-normal" class="rounded bg-neutral-700 px-3 py-2">Normal</button>
                            <button id="btn-dur-long" class="rounded bg-neutral-700 px-3 py-2">Long</button>
                        </div>
                        <button id="btn-powerups" class="rounded bg-green-700 px-4 py-2">Power Ups: ON</button>
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
            </div>

            <div id="game-view" class="hidden h-full w-full">
                <canvas id="renderCanvas" class="h-full w-full outline-none"></canvas>
            </div>
        `;

        this.lobbyView = container.querySelector('#lobby-view');
        this.gameView = container.querySelector('#game-view');
        this.slotsLeftEl = container.querySelector('#slots-left');
        this.slotsRightEl = container.querySelector('#slots-right');
        this.benchListEl = container.querySelector('#bench-list');
        this.leaderControls = container.querySelector('#leader-controls');
        this.btnStart = container.querySelector('#btn-start');
        this.leaderMsg = container.querySelector('#leader-msg');
        this.powerUpsButton = container.querySelector('#btn-powerups');

        this.bindUiActions(container);
        this.element.appendChild(container);
        this.gameScene = new GameScene();
        this.initSocket();
    }

    private bindUiActions(container: HTMLElement): void {
        const mode1 = container.querySelector<HTMLButtonElement>('#btn-mode-1');
        const mode2 = container.querySelector<HTMLButtonElement>('#btn-mode-2');
        const mode3 = container.querySelector<HTMLButtonElement>('#btn-mode-3');
        const durFast = container.querySelector<HTMLButtonElement>('#btn-dur-fast');
        const durNormal = container.querySelector<HTMLButtonElement>('#btn-dur-normal');
        const durLong = container.querySelector<HTMLButtonElement>('#btn-dur-long');

        mode1?.addEventListener('click', () => this.socket?.emit('lobby_setMode', 'one_for_one'));
        mode2?.addEventListener('click', () => this.socket?.emit('lobby_setMode', 'two_for_two'));
        mode3?.addEventListener('click', () => this.socket?.emit('lobby_setMode', 'three_for_three'));
        durFast?.addEventListener('click', () => this.socket?.emit('lobby_setDuration', 'fast'));
        durNormal?.addEventListener('click', () => this.socket?.emit('lobby_setDuration', 'normal'));
        durLong?.addEventListener('click', () => this.socket?.emit('lobby_setDuration', 'long'));
        this.powerUpsButton?.addEventListener('click', () => this.socket?.emit('lobby_setPowerUps', !this.currentPowerUpsState));
        this.btnStart?.addEventListener('click', () => this.socket?.emit('lobby_start'));
    }

    private initSocket(): void {
        this.socket = io('http://localhost:3000');

        this.socket.on('connect', () => {
            this.myId = this.socket?.id ?? '';
        });

        this.socket.on('lobbyState', (state: LobbyState) => {
            this.renderLobby(state);
        });

        this.socket.on('gameStarted', () => {
            this.handleGameStarted();
        });
    }

    private handleGameStarted(): void {
        if (this.gameStarted || !this.socket || !this.gameView || !this.lobbyView || !this.gameScene) {
            return;
        }

        this.gameStarted = true;
        this.lobbyView.classList.add('hidden');
        this.gameView.classList.remove('hidden');

        const canvas = this.gameView.querySelector<HTMLCanvasElement>('#renderCanvas');
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            canvas.focus();
        }

        this.gameScene.startConnection(this.socket);
        this.socket.emit('requestGameInit');
    }

    private renderLobby(state: LobbyState): void {
        if (!this.slotsLeftEl || !this.slotsRightEl || !this.benchListEl || !this.btnStart || !this.leaderControls || !this.leaderMsg) {
            return;
        }

        this.isLeader = state.leader === this.myId;
        this.currentPowerUpsState = state.config.power_ups;

        this.leaderControls.classList.toggle('hidden', !this.isLeader);
        this.leaderMsg.classList.toggle('hidden', !this.isLeader);

        this.updateButtonStates(state);

        const ready = this.isLeader && state.isReadyToStart;
        this.btnStart.disabled = !ready;
        this.btnStart.textContent = this.isLeader
            ? (ready ? 'START GAME' : 'Fill all slots to start')
            : 'Waiting for Leader...';
        this.btnStart.classList.toggle('opacity-50', !ready);
        this.btnStart.classList.toggle('cursor-not-allowed', !ready);

        this.renderTeamSlots(this.slotsLeftEl, state.slots.left, 'left');
        this.renderTeamSlots(this.slotsRightEl, state.slots.right, 'right');
        this.renderBench(state.bench);
    }

    private renderBench(bench: string[]): void {
        if (!this.benchListEl) {
            return;
        }

        this.benchListEl.innerHTML = '';
        bench.forEach((playerId) => {
            const player = document.createElement('button');
            player.type = 'button';
            player.id = `bench-${playerId}`;
            player.className = 'w-full rounded border border-transparent bg-neutral-700 px-3 py-2 text-left';
            player.textContent = `Player ${playerId.slice(0, 4)}`;

            if (playerId === this.myId) {
                player.classList.add('ring-1', 'ring-yellow-400');
            }

            if (this.selectedBenchPlayer === playerId) {
                player.classList.remove('border-transparent');
                player.classList.add('border-cyan-400');
            }

            if (this.isLeader) {
                player.addEventListener('click', () => {
                    this.selectedBenchPlayer = playerId;
                    this.renderBench(bench);
                });
            } else {
                player.disabled = true;
                player.classList.add('opacity-80', 'cursor-default');
            }

            this.benchListEl?.appendChild(player);
        });
    }

    private updateButtonStates(state: LobbyState): void {
        const setButtonState = (id: string, active: boolean): void => {
            const button = this.element.querySelector<HTMLButtonElement>(`#${id}`);
            if (!button) {
                return;
            }

            button.disabled = !this.isLeader;
            button.classList.toggle('bg-blue-700', active);
            button.classList.toggle('bg-neutral-700', !active);
            button.classList.toggle('opacity-40', !this.isLeader && !active);
            button.classList.toggle('cursor-not-allowed', !this.isLeader);
        };

        setButtonState('btn-mode-1', state.config.players_per_side === 1);
        setButtonState('btn-mode-2', state.config.players_per_side === 2);
        setButtonState('btn-mode-3', state.config.players_per_side === 3);

        setButtonState('btn-dur-fast', state.config.duration_label === 'fast');
        setButtonState('btn-dur-normal', state.config.duration_label === 'normal');
        setButtonState('btn-dur-long', state.config.duration_label === 'long');

        if (this.powerUpsButton) {
            this.powerUpsButton.disabled = !this.isLeader;
            this.powerUpsButton.classList.toggle('cursor-not-allowed', !this.isLeader);
            this.powerUpsButton.classList.toggle('bg-green-700', state.config.power_ups);
            this.powerUpsButton.classList.toggle('bg-red-700', !state.config.power_ups);
            this.powerUpsButton.textContent = `Power Ups: ${state.config.power_ups ? 'ON' : 'OFF'}`;
        }
    }

    private renderTeamSlots(container: HTMLElement, slots: LobbySlot[], side: 'left' | 'right'): void {
        container.innerHTML = '';

        slots.forEach((slot) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between rounded border-2 border-neutral-600 bg-neutral-700 px-3 py-3';

            if (slot.content === 'empty') {
                row.classList.add('border-dashed', 'opacity-70');
                row.textContent = '[ Empty Slot ]';
                if (this.isLeader) {
                    row.classList.add('cursor-pointer');
                    row.addEventListener('click', () => {
                        if (!this.socket || !this.selectedBenchPlayer) {
                            this.socket?.emit('lobby_addBot', { side, slotIndex: slot.index });
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
                label.textContent = `👤 ${slot.playerName ?? 'Player'}`;
                row.appendChild(label);

                if (this.isLeader && slot.socketId) {
                    const action = document.createElement('button');
                    action.type = 'button';
                    action.className = 'rounded bg-neutral-800 px-2 py-1 text-xs';
                    action.textContent = 'To Bench';
                    action.addEventListener('click', () => {
                        this.selectedBenchPlayer = slot.socketId ?? null;
                    });
                    row.appendChild(action);
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

                    const minus = document.createElement('button');
                    minus.type = 'button';
                    minus.className = 'rounded bg-neutral-800 px-2 py-1 text-xs';
                    minus.textContent = '-';
                    minus.addEventListener('click', () => {
                        this.socket?.emit('lobby_botLevel', { side, slotIndex: slot.index, delta: -1 });
                    });

                    const plus = document.createElement('button');
                    plus.type = 'button';
                    plus.className = 'rounded bg-neutral-800 px-2 py-1 text-xs';
                    plus.textContent = '+';
                    plus.addEventListener('click', () => {
                        this.socket?.emit('lobby_botLevel', { side, slotIndex: slot.index, delta: 1 });
                    });

                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.className = 'rounded bg-red-700 px-2 py-1 text-xs';
                    remove.textContent = 'X';
                    remove.addEventListener('click', () => {
                        this.socket?.emit('lobby_removeBot', { side, slotIndex: slot.index });
                    });

                    actions.append(minus, plus, remove);
                    row.appendChild(actions);
                }
            }

            container.appendChild(row);
        });
    }

    public onDestroy(): void {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }

        if (this.gameScene) {
            this.gameScene.dispose();
            this.gameScene = null;
        }

        this.selectedBenchPlayer = null;
        this.lobbyView = null;
        this.gameView = null;
        this.slotsLeftEl = null;
        this.slotsRightEl = null;
        this.benchListEl = null;
        this.leaderControls = null;
        this.btnStart = null;
        this.leaderMsg = null;
        this.powerUpsButton = null;
    }
}