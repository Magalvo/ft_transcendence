import { Server } from 'socket.io';
import { GameConfiguration, GamePlayer, Game } from './index.js';

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
    private clients: string[] = []; // Index 0 is Leader

    public config: GameConfiguration;
    public slots: { left: LobbySlot[], right: LobbySlot[] } = { left: [], right: [] };
    public bench: string[] = [];
    public gameInstance: Game | null = null;

    constructor(io: Server) {
        this.io = io;
        this.config = new GameConfiguration("normal", "one_for_one");
        this.resizeSlots();
    }

    /* --- CLIENT MANAGEMENT --- */

    public addClient(socketId: string) {
        this.clients.push(socketId);
        this.bench.push(socketId);
        this.broadcastState();
    }

    public removeClient(socketId: string) {
        this.clients = this.clients.filter(id => id !== socketId);
        this.clearPlayerFromSlots(socketId); // Removes from bench and slots
        this.gameInstance?.removePlayerBySocket(socketId);
        this.broadcastState();
    }

    public isLeader(socketId: string): boolean {
        return this.clients[0] === socketId;
    }

    /* --- ACTIONS --- */

    public setGameMode(id: string, type: "one_for_one" | "two_for_two" | "three_for_three") {
        if (!this.isLeader(id)) return;
        this.config.setGameType(type);
        this.resizeSlots();
        this.broadcastState();
    }

    public setGameDuration(id: string, duration: "fast" | "normal" | "long") {
        if (!this.isLeader(id)) return;
        this.config.setGameDuration(duration);
        this.broadcastState();
    }

    public setPowerUps(id: string, enabled: boolean) {
        if (!this.isLeader(id)) return;
        this.config.power_ups = enabled;
        this.broadcastState();
    }

    public movePlayerToSlot(leaderId: string, targetId: string, side: 'left' | 'right', idx: number) {
        if (!this.isLeader(leaderId) || !this.clients.includes(targetId)) return;

        this.clearPlayerFromSlots(targetId); // Remove from current pos first

        const slot = this.slots[side][idx];
        if (!slot) return;

        // If slot occupied by human, send them to bench (Swap)
        if (slot.content === 'human' && slot.socketId) this.bench.push(slot.socketId);

        Object.assign(slot, {
            content: 'human',
            socketId: targetId,
            playerName: `Player ${targetId.slice(0, 4)}`,
            botLevel: undefined
        });

        this.broadcastState();
    }

    public addBot(id: string, side: 'left' | 'right', idx: number) {
        if (!this.isLeader(id)) return;
        const slot = this.slots[side][idx];
        if (slot) {
            if (slot.content === 'human' && slot.socketId) this.bench.push(slot.socketId);
            Object.assign(slot, { content: 'bot', botLevel: 5, socketId: undefined, playerName: undefined });
        }
        this.broadcastState();
    }

    public removeBot(id: string, side: 'left' | 'right', idx: number) {
        if (!this.isLeader(id)) return;
        const slot = this.slots[side][idx];
        if (slot?.content === 'bot') this.resetSlot(slot);
        this.broadcastState();
    }

    public changeBotLevel(id: string, side: 'left' | 'right', idx: number, delta: number) {
        if (!this.isLeader(id)) return;
        const slot = this.slots[side][idx];
        if (slot?.content === 'bot' && slot.botLevel !== undefined) {
            slot.botLevel = Math.max(1, Math.min(10, slot.botLevel + delta));
        }
        this.broadcastState();
    }

    public startGame(id: string) {
        if (!this.isLeader(id) || !this.canStart()) return;

        console.log("Starting Game...");

        const players: GamePlayer[] = [];
        const process = (s: LobbySlot) => {
            if (s.content === 'human' && s.socketId)
                players.push(new GamePlayer('human', s.socketId, s.side, s.playerName || "Player"));
            else if (s.content === 'bot' && s.botLevel)
                players.push(new GamePlayer('bot', s.botLevel, s.side, `Bot Lvl ${s.botLevel}`));
        };

        this.slots.left.forEach(process);
        this.slots.right.forEach(process);

        this.gameInstance = new Game(this.io, this.config, players);
        this.gameInstance.start();
        this.io.emit('gameStarted');
    }

    /* --- HELPERS --- */

    private canStart(): boolean {
        const sides = [this.slots.left, this.slots.right];
        const allSlotsFilled = sides.every(side => side.every(s => s.content !== 'empty'));
        const benchEmpty = this.bench.length === 0;
        return allSlotsFilled && benchEmpty;
    }

    private resizeSlots() {
        const size = this.config.players_per_side;

        (['left', 'right'] as const).forEach(side => {
            const arr = this.slots[side];

            // 1. Move overflowing humans to bench
            while (arr.length > size) {
                const removed = arr.pop();
                if (removed?.content === 'human' && removed.socketId) this.bench.push(removed.socketId);
            }

            // 2. Add missing slots (preserving existing ones)
            while (arr.length < size) {
                arr.push({ index: arr.length, side, content: 'empty' });
            }
        });
    }

    private clearPlayerFromSlots(socketId: string) {
        this.bench = this.bench.filter(id => id !== socketId);

        (['left', 'right'] as const).forEach(side => {
            this.slots[side].forEach(slot => {
                if (slot.socketId === socketId) this.resetSlot(slot);
            });
        });
    }

    private resetSlot(slot: LobbySlot) {
        Object.assign(slot, { content: 'empty', socketId: undefined, playerName: undefined, botLevel: undefined });
    }

    private broadcastState() {
        this.io.emit('lobbyState', {
            config: this.config,
            slots: this.slots,
            bench: this.bench,
            leader: this.clients[0],
            isReadyToStart: this.canStart()
        });
    }
}