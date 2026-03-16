import { Server } from 'socket.io';
import { GameConfiguration, GamePlayer, Game } from './index.js';
import db from '../db.js';

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
    private roomId: string;
    private clients: string[] = [];
    private leader: string | null = null; // Explicitly track the leader
    private socketToUserMap: Map<string, string>;
    private userDataCache: Map<string, { id: string; username: string }> = new Map();
    private removeCallback?: () => void;

    public config: GameConfiguration;
    public slots: { left: LobbySlot[], right: LobbySlot[] } = { left: [], right: [] };
    public bench: string[] = [];
    public gameInstance: Game | null = null;

    constructor(io: Server, socketToUserMap: Map<string, string>, roomId = 'lobby:main') {
        this.io = io;
        this.socketToUserMap = socketToUserMap;
        this.roomId = roomId;
        this.config = new GameConfiguration("normal", "one_for_one");
        this.resizeSlots();
    }

    public setRemoveCallback(callback: () => void) {
        this.removeCallback = callback;
    }

    /* --- CLIENT MANAGEMENT --- */

    public hasClient(socketId: string): boolean {
        return this.clients.includes(socketId);
    }

    public getClientCount(): number {
        return this.clients.length;
    }

    public addClient(socketId: string) {
        // Prevent duplicate additions
        if (this.clients.includes(socketId)) {
            console.log(`⚠️ Lobby: ${socketId} already in lobby`);
            return;
        }
        
        this.clients.push(socketId);
        this.bench.push(socketId);

        const socket = this.io.sockets.sockets.get(socketId);
        socket?.join(this.roomId);

        // Set as leader if this is the first client
        if (this.leader === null) {
            this.leader = socketId;
            console.log(`👑 Lobby: ${socketId} set as leader`);
        }
        this.broadcastState();
    }

    public removeClient(socketId: string) {
        const socket = this.io.sockets.sockets.get(socketId);
        socket?.leave(this.roomId);

        this.clients = this.clients.filter(id => id !== socketId);
        this.clearPlayerFromSlots(socketId); // Removes from bench and slots
        this.gameInstance?.removePlayerBySocket(socketId);
        
        // If leader disconnects, assign next in line
        if (this.leader === socketId) {
            this.leader = this.clients.length > 0 ? this.clients[0] : null;
            if (this.leader) {
                console.log(`👑 Lobby: New leader is ${this.leader}`);
            }
        }
        
        this.broadcastState();
    }

    public isLeader(socketId: string): boolean {
        return this.leader === socketId;
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

    public async movePlayerToSlot(leaderId: string, targetId: string, side: 'left' | 'right', idx: number) {
        if (!this.isLeader(leaderId) || !this.clients.includes(targetId)) return;

        this.clearPlayerFromSlots(targetId); // Remove from current pos first

        const slot = this.slots[side][idx];
        if (!slot) return;

        // If slot occupied by human, send them to bench (Swap)
        if (slot.content === 'human' && slot.socketId) this.bench.push(slot.socketId);

        // Fetch username for the player (with fallback to socket auth data)
        let userId = this.socketToUserMap.get(targetId);
        
        // If not in map, try to get from socket's auth data
        if (!userId) {
            const socket = this.io.sockets.sockets.get(targetId);
            userId = socket?.data?.userId || socket?.handshake?.auth?.userId;
        }
        
        let playerName = `Player ${targetId.slice(0, 4)}`;
        if (userId) {
            const userData = await this.fetchUserData(userId);
            if (userData) {
                playerName = userData.username;
            }
        }

        Object.assign(slot, {
            content: 'human',
            socketId: targetId,
            playerName,
            botLevel: undefined
        });

        this.broadcastState();
    }

    public movePlayerToBench(leaderId: string, targetId: string) {
        if (!this.isLeader(leaderId)) return;
        if (!this.clients.includes(targetId)) return;
        this.clearPlayerFromSlots(targetId);
        this.bench.push(targetId);
        this.broadcastState();
    }

    public kickPlayer(leaderId: string, targetId: string) {
        if (!this.isLeader(leaderId)) {
            console.log(`❌ Kick attempt failed: ${leaderId} is not leader`);
            return;
        }
        if (!this.clients.includes(targetId)) {
            console.log(`❌ Kick attempt failed: ${targetId} not in lobby`);
            return;
        }
        if (leaderId === targetId) {
            console.log(`❌ Kick attempt failed: Leader cannot kick themselves`);
            return;
        }

        console.log(`👢 Kicking ${targetId} from lobby`);
        
        // Notify the kicked player
        this.io.to(targetId).emit('kicked', {
            message: '👢 You have been kicked from the lobby by the party leader'
        });

        // Remove the player
        this.removeClient(targetId);
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

    public async startGame(id: string) {
        if (!this.isLeader(id) || !this.canStart()) return;

        console.log("Starting Game...");

        const players: GamePlayer[] = [];
        const process = (s: LobbySlot) => {
            if (s.content === 'human' && s.socketId) {
                let userId = this.socketToUserMap.get(s.socketId);
                
                // Fallback to socket auth data if not in map
                if (!userId) {
                    const socket = this.io.sockets.sockets.get(s.socketId);
                    userId = socket?.data?.userId || socket?.handshake?.auth?.userId;
                }
                
                players.push(new GamePlayer('human', s.socketId, s.side, s.playerName || "Player", userId));
            }
            else if (s.content === 'bot' && s.botLevel)
                players.push(new GamePlayer('bot', s.botLevel, s.side, `Bot Lvl ${s.botLevel}`));
        };
        this.slots.left.forEach(process);
        this.slots.right.forEach(process);

        // Fetch usernames for spectators
        for (const socketId of this.bench) {
            let userId = this.socketToUserMap.get(socketId);
            
            // Fallback to socket auth data if not in map
            if (!userId) {
                const socket = this.io.sockets.sockets.get(socketId);
                userId = socket?.data?.userId || socket?.handshake?.auth?.userId;
            }
            
            let spectatorName = `Spectator ${socketId.slice(0, 4)}`;
            
            if (userId) {
                const userData = await this.fetchUserData(userId);
                if (userData) {
                    spectatorName = userData.username;
                }
            }
            
            players.push(new GamePlayer('human', socketId, 'spectator' as any, spectatorName, userId));
        }

        this.gameInstance = new Game(this.io, this.config, players, this.roomId, () => {
            this.gameInstance = null;
            if (this.removeCallback) this.removeCallback();
        });
        this.gameInstance.start();
        this.emitToLobby('gameStarted');
    }

    /* --- HELPERS --- */

    private canStart(): boolean {
        return [this.slots.left, this.slots.right].every(side => 
            side.every(s => s.content !== 'empty')
        );
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

    private async fetchUserData(userId: string) {
        if (this.userDataCache.has(userId)) {
            return this.userDataCache.get(userId)!;
        }

        try {
            const user = await db('users')
                .select('id', 'username')
                .where({ id: userId })
                .first();

            if (user) {
                this.userDataCache.set(userId, user);
                return user;
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }

        return null;
    }

    private async broadcastState() {
        const playerDataMap = new Map<string, { userId: string; username: string }>();
        
        for (const socketId of this.clients) {
            let userId = this.socketToUserMap.get(socketId);
            
            if (!userId) {
                const socket = this.io.sockets.sockets.get(socketId);
                userId = socket?.data?.userId || socket?.handshake?.auth?.userId;
            }
            
            if (userId) {
                const userData = await this.fetchUserData(userId);
                if (userData) {
                    playerDataMap.set(socketId, {
                        userId: userData.id,
                        username: userData.username
                    });
                }
            }
        }

        // Enhance bench data with player info
        const benchWithData = this.bench.map(socketId => ({
            socketId,
            username: playerDataMap.get(socketId)?.username || `Player ${socketId.slice(0, 4)}`,
            userId: playerDataMap.get(socketId)?.userId
        }));

        this.emitToLobby('lobbyState', {
            config: this.config,
            slots: this.slots,
            bench: benchWithData,
            leader: this.leader,
            isReadyToStart: this.canStart(),
            playerData: Object.fromEntries(playerDataMap)
        });
    }

    private emitToLobby(event: string, payload?: unknown): void {
        if (payload === undefined) {
            this.io.to(this.roomId).emit(event);
            return;
        }

        this.io.to(this.roomId).emit(event, payload);
    }

    /**
     * Public method to trigger broadcast from socket setup
     */
    public async broadcastStatePublic(): Promise<void> {
        await this.broadcastState();
    }

    /**
     * Get the current lobby state without broadcasting
     */
    public async getStatePublic() {
        const playerDataMap = new Map<string, { userId: string; username: string }>();
        
        for (const socketId of this.clients) {
            let userId = this.socketToUserMap.get(socketId);
            
            if (!userId) {
                const socket = this.io.sockets.sockets.get(socketId);
                userId = socket?.data?.userId || socket?.handshake?.auth?.userId;
            }
            
            if (userId) {
                const userData = await this.fetchUserData(userId);
                if (userData) {
                    playerDataMap.set(socketId, {
                        userId: userData.id,
                        username: userData.username
                    });
                }
            }
        }

        return {
            config: this.config,
            slots: this.slots,
            leader: this.leader,
            isReadyToStart: this.canStart(),
            playerData: Object.fromEntries(playerDataMap)
        };
    }
}