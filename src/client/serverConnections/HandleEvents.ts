import {
    COUNTDOWN_MESSAGES,
    ENDGAME_MESSAGES,
    GameScene,
    GameStatus,
    pauseScreen,
    resumeGame,
    showWarningMessage,
    clearAllNotifications,
    syncGameStats,
    syncMagicBalls,
    syncPaddles,
    syncPlayingBalls,
    syncTable,
    disposeCountdown,
    showCountdownDisplay,
    type GameData,
} from "../index.js";

export class HandleEvents {
    private data: GameData;
    private gameScene: GameScene;

    // --- CONTROLO DE FILA ---
    private isReady: boolean = false;
    private eventQueue: Array<() => void> = [];

    constructor(gameScene: GameScene) {
        this.data = {} as GameData;
        this.gameScene = gameScene;
    }

    public setData(data: GameData) {
        this.data = data;
    }

    public initializeGame(serverData: any) {
        console.log("🔥 SERVER INIT RECEIVED. Building Scene...");
        clearAllNotifications();
        disposeCountdown();
        this.isReady = false;
        this.gameScene.resetScene(serverData.configs);
        this.data = (this.gameScene as any).data;
        this.data.mySide = serverData.side;
        this.data.myIndex = serverData.index;
        if (this.data.scene) {
            this.data.scene.executeWhenReady(() => {
                console.log("✅ GPU Ready. Sending Signal to Server.");
                this.isReady = true;
                this.processQueue();

                if (this.data.socket) {
                    this.data.socket.emit('renderReady');
                }
            });
        }
    }

    /**
     * Executa todos os eventos que chegaram enquanto estávamos a carregar
     */
    private processQueue() {
        if (this.eventQueue.length > 0) {
            console.log(`Processing ${this.eventQueue.length} queued events...`);
            // Executa cada função guardada na ordem correta
            this.eventQueue.forEach(eventFn => eventFn());
            this.eventQueue = [];
        }
    }

    // --- GAME STATE (60 FPS) ---

    public gameState(serverState: any) {
        // Se não estiver pronto, ignoramos updates de estado (não vale a pena guardar na fila, 
        // pois o próximo update substitui este).
        if (!this.isReady || !this.data.scene) return;

        if (serverState.paddles) syncPaddles(this.data, serverState.paddles);
        if (serverState.balls) syncPlayingBalls(this.data, serverState.balls, serverState.isHell);
        if (serverState.magicBalls) syncMagicBalls(this.data, serverState.magicBalls);
        syncTable(this.data);

        syncGameStats(this.data, serverState);
        this.handleGameStartTrigger(serverState.status);
    }

    // --- EVENTS QUE PRECISAM DE ESPERAR ---

    public onCountdown(count: number) {
        if (!this.isReady) {
            this.eventQueue.push(() => this.onCountdown(count));
            return;
        }

        const msgData = (COUNTDOWN_MESSAGES as any)[count];
        // Se houver mensagem para este número (3, 2, 1, GO)
        if (msgData && this.data.scene) {
            // USA O NOVO SISTEMA
            showCountdownDisplay(this.data.scene, msgData.text, msgData.color, 1.0);
        }
    }

    public onEndGame(count: number) {
        if (!this.isReady) {
            this.eventQueue.push(() => this.onEndGame(count));
            return;
        }

        let msgData: any;

        if (count == 3 || count == 2) {
            msgData = (ENDGAME_MESSAGES as any)[count];
        }

        if (count == 1) {
            if (this.data.mods && this.data.mods.score) {
                if (this.data.mods.score.me > this.data.mods.score.rival)
                    msgData = (ENDGAME_MESSAGES as any)['WON'];
                else if (this.data.mods.score.me < this.data.mods.score.rival)
                    msgData = (ENDGAME_MESSAGES as any)['LOST'];
                else
                    msgData = (ENDGAME_MESSAGES as any)['DRAW'];
            }
        }

        if (count == 0 && this.data.flags) this.data.flags.return_main_menu = true;
        if (msgData && this.data.scene)
            showCountdownDisplay(this.data.scene, msgData.text, msgData.color, 2.0);
    }

    public socketMessage(server_data: any) {
        if (!this.isReady) {
            this.eventQueue.push(() => this.socketMessage(server_data));
            return;
        }

        let targetSide = server_data.side;
        if (this.data.mySide === 'right' && (server_data.side === 'left' || server_data.side === 'right')) {
            targetSide = (server_data.side === 'left') ? 'right' : 'left';
        }

        showWarningMessage({
            scene: this.data.scene,
            message: server_data.message,
            pos: targetSide,
            color: server_data.color,
            duration: server_data.duration
        });
    }

    public gamePaused() {
        if (!this.isReady) {
            this.eventQueue.push(() => this.gamePaused());
            return;
        }

        console.log("Game Paused by Server");
        if (this.data.flags) {
            this.data.flags.game_running = true;
            pauseScreen(this.data);
            this.data.flags.game_running = false;
        }
    }

    public gameResumed() {
        if (!this.isReady) {
            this.eventQueue.push(() => this.gameResumed());
            return;
        }

        console.log("Game Resumed");
        resumeGame(this.data);
        if (this.data.flags) {
            this.data.flags.game_running = true;
            this.data.flags.pause_screen = false;
        }
    }

    /* PRIVATE HELPER METHODS */

    private handleGameStartTrigger(status: GameStatus) {
        if (status === GameStatus.COUNTDOWN && this.data.flags && !this.data.flags.game_running) {
            this.data.flags.game_running = true;
            window.dispatchEvent(new Event('game-start'));
        }
    }
}