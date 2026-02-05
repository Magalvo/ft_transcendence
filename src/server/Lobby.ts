import { Server } from 'socket.io';
import { GameConfiguration, GamePlayer, Game } from './index.js';

/* Tipos auxiliares para o Lobby */
export interface LobbySlot {
    index: number;
    side: 'left' | 'right';
    content: 'empty' | 'human' | 'bot';
    socketId?: string;
    botLevel?: number;
    playerName?: string;
}

export class Lobby {
    private io: Server;
    private clients: string[] = [];

    // Estado do Lobby
    public config: GameConfiguration;
    public slots: { left: LobbySlot[], right: LobbySlot[] };
    public bench: string[] = [];

    public gameInstance: Game | null = null;

    constructor(io: Server) {
        this.io = io;
        this.config = new GameConfiguration("normal", "one_for_one");
        this.slots = { left: [], right: [] };
        // Inicializa slots com a config default
        this.updateSlotsStructure();
    }

    // --- CLIENT MANAGEMENT ---

    public addClient(socketId: string) {
        this.clients.push(socketId);
        this.bench.push(socketId);
        this.broadcastState();
    }

    public removeClient(socketId: string) {
        this.clients = this.clients.filter(id => id !== socketId);
        this.bench = this.bench.filter(id => id !== socketId);
        this.vacateSlotIfOccupiedBy(socketId, 'left');
        this.vacateSlotIfOccupiedBy(socketId, 'right');

        if (this.gameInstance) {
            this.gameInstance.removePlayerBySocket(socketId);
        }

        this.broadcastState();
    }

    private vacateSlotIfOccupiedBy(socketId: string, side: 'left' | 'right') {
        const slot = this.slots[side].find(s => s.socketId === socketId);
        if (slot) {
            slot.content = 'empty';
            slot.socketId = undefined;
            slot.playerName = undefined;
        }
    }

    public isLeader(socketId: string): boolean {
        return this.clients.length > 0 && this.clients[0] === socketId;
    }

    // --- LOBBY ACTIONS ---

    public setGameMode(socketId: string, type: "one_for_one" | "two_for_two" | "three_for_three") {
        if (!this.isLeader(socketId)) return;

        // 1. Atualiza a Configuração
        this.config.setGameType(type);

        // 2. Reconstrói os Slots visuais (Adiciona/Remove conforme necessário)
        this.updateSlotsStructure();

        this.broadcastState();
    }

    public setGameDuration(socketId: string, duration: "fast" | "normal" | "long") {
        if (!this.isLeader(socketId)) return;
        this.config.setGameDuration(duration);
        this.broadcastState();
    }

    public setPowerUps(socketId: string, enabled: boolean) {
        if (!this.isLeader(socketId)) return;
        this.config.power_ups = enabled;
        this.broadcastState();
    }

    public movePlayerToSlot(socketId: string, targetSocketId: string, side: 'left' | 'right', slotIndex: number) {
        if (!this.isLeader(socketId)) return;
        if (!this.clients.includes(targetSocketId)) return;

        this.removeFromCurrentPosition(targetSocketId);

        const targetSlot = this.slots[side][slotIndex];
        if (!targetSlot) return;

        // Se o slot estava ocupado por humano, manda para banco
        if (targetSlot.content === 'human' && targetSlot.socketId) {
            this.bench.push(targetSlot.socketId);
        }

        targetSlot.content = 'human';
        targetSlot.socketId = targetSocketId;
        targetSlot.playerName = `Player ${targetSocketId.substr(0, 4)}`;

        this.broadcastState();
    }

    public addBot(socketId: string, side: 'left' | 'right', slotIndex: number) {
        if (!this.isLeader(socketId)) return;

        const slot = this.slots[side][slotIndex];
        if (slot) {
            if (slot.content === 'human' && slot.socketId) {
                this.bench.push(slot.socketId);
            }
            slot.content = 'bot';
            slot.botLevel = 5;
            slot.socketId = undefined;
        }
        this.broadcastState();
    }

    public removeBot(socketId: string, side: 'left' | 'right', slotIndex: number) {
        if (!this.isLeader(socketId)) return;

        const slot = this.slots[side][slotIndex];
        if (slot && slot.content === 'bot') {
            slot.content = 'empty';
            slot.botLevel = undefined;
        }
        this.broadcastState();
    }

    public changeBotLevel(socketId: string, side: 'left' | 'right', slotIndex: number, delta: number) {
        if (!this.isLeader(socketId)) return;
        const slot = this.slots[side][slotIndex];
        if (slot && slot.content === 'bot' && slot.botLevel !== undefined) {
            let newLevel = slot.botLevel + delta;
            if (newLevel < 1) newLevel = 1;
            if (newLevel > 10) newLevel = 10;
            slot.botLevel = newLevel;
        }
        this.broadcastState();
    }

    public startGame(socketId: string) {
        if (!this.isLeader(socketId)) return;

        // --- VALIDAÇÃO DE SEGURANÇA ---
        // Mesmo que o cliente tenha hackeado o botão, o servidor recusa se não estiver pronto
        if (!this.checkGameRequirements()) {
            console.log("Start Game rejected: Requirements not met.");
            return;
        }
        // ------------------------------

        console.log("Lobby Leader requested Start Game...");

        const finalPlayers: GamePlayer[] = [];

        // Helper para converter slot em GamePlayer
        const processSlot = (slot: LobbySlot, side: 'left' | 'right') => {
            if (slot.content === 'human' && slot.socketId) {
                finalPlayers.push(new GamePlayer('human', slot.socketId, side, slot.playerName || "Player"));
            } else if (slot.content === 'bot' && slot.botLevel) {
                finalPlayers.push(new GamePlayer('bot', slot.botLevel, side, "Bot Lvl " + slot.botLevel));
            }
        };

        this.slots.left.forEach(s => processSlot(s, 'left'));
        this.slots.right.forEach(s => processSlot(s, 'right'));

        this.gameInstance = new Game(this.io, this.config, finalPlayers);
        this.gameInstance.start();
        this.io.emit('gameStarted');
    }

    // --- HELPERS E VALIDAÇÕES ---

    /**
     * Verifica se o jogo pode começar.
     * Regra: TODOS os slots têm de estar preenchidos (Human ou Bot).
     */
    private checkGameRequirements(): boolean {
        // Verifica lado esquerdo
        const leftOk = this.slots.left.every(slot => slot.content !== 'empty');
        // Verifica lado direito
        const rightOk = this.slots.right.every(slot => slot.content !== 'empty');

        return leftOk && rightOk;
    }

    private updateSlotsStructure() {
        // Pega o número de slots atual da configuração (1, 2 ou 3)
        const size = this.config.players_per_side;

        // Cópia temporária para tentar preservar quem já lá está
        const oldLeft = [...this.slots.left];
        const oldRight = [...this.slots.right];

        this.slots.left = [];
        this.slots.right = [];

        for (let i = 0; i < size; i++) {
            // Se já existia um slot nesta posição (i), mantemos o conteúdo.
            // Se não existia (estamos a aumentar o tamanho), criamos um novo 'empty'.
            if (i < oldLeft.length) {
                this.slots.left.push(oldLeft[i]);
            } else {
                this.slots.left.push({ index: i, side: 'left', content: 'empty' });
            }

            if (i < oldRight.length) {
                this.slots.right.push(oldRight[i]);
            } else {
                this.slots.right.push({ index: i, side: 'right', content: 'empty' });
            }
        }

        // Se diminuímos o tamanho (ex: 3v3 -> 1v1), os jogadores nos slots extra vão para o banco
        for (let i = size; i < oldLeft.length; i++) {
            if (oldLeft[i].content === 'human' && oldLeft[i].socketId) this.bench.push(oldLeft[i].socketId!);
        }
        for (let i = size; i < oldRight.length; i++) {
            if (oldRight[i].content === 'human' && oldRight[i].socketId) this.bench.push(oldRight[i].socketId!);
        }
    }

    private removeFromCurrentPosition(socketId: string) {
        this.bench = this.bench.filter(id => id !== socketId);
        this.slots.left.forEach(slot => {
            if (slot.socketId === socketId) {
                slot.content = 'empty';
                slot.socketId = undefined;
                slot.playerName = undefined;
            }
        });
        this.slots.right.forEach(slot => {
            if (slot.socketId === socketId) {
                slot.content = 'empty';
                slot.socketId = undefined;
                slot.playerName = undefined;
            }
        });
    }

    private broadcastState() {
        // Enviamos para o front-end se está pronto para começar ou não
        const isReady = this.checkGameRequirements();

        this.io.emit('lobbyState', {
            config: this.config,
            slots: this.slots,
            bench: this.bench,
            leader: this.clients[0],
            isReadyToStart: isReady // <--- NOVA FLAG
        });
    }
}