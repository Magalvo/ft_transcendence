import {
    COUNTDOWN_MESSAGES,
    ENDGAME_MESSAGES,
    GameScene,
    GameStatus,
    pauseScreen,
    resumeGame,
    showWarningMessage,
    syncGameStats,
    syncMagicBalls,
    syncPaddles,
    syncPlayingBalls,
    syncTable,
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

    /**
     * Recebe o evento 'init' do servidor.
     * Este é o momento em que preparamos tudo.
     */
    public initializeGame(serverData: any) {
        console.log("🔥 SERVER INIT RECEIVED. Building Scene...");
        
        // 1. Reset da flag para impedir processamento imediato
        this.isReady = false;

        // 2. Criar a cena (Síncrono, mas pesado)
        this.gameScene.resetScene(serverData.configs);

        // 3. Atualizar referências
        this.data = (this.gameScene as any).data;
        this.data.mySide = serverData.side;
        this.data.myIndex = serverData.index;

        console.log(`✅ Scene Ready. I am: ${serverData.side} [${serverData.index}]`);

        // 4. MARCAR COMO PRONTO E PROCESSAR FILA
        this.isReady = true;
        this.processQueue();
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
        // Se não estiver pronto, guarda na fila
        if (!this.isReady) {
            this.eventQueue.push(() => this.onCountdown(count));
            return;
        }

        const msgData = (COUNTDOWN_MESSAGES as any)[count];
        if (count > 0) {
            const fallback = { text: String(count), color: "white" };
            this.showCountdownMessage(msgData || fallback, 1);
        }
    }

    public onEndGame(count: number) {
        // Se não estiver pronto, guarda na fila (Evita o erro 'reading score of undefined')
        if (!this.isReady) {
            this.eventQueue.push(() => this.onEndGame(count));
            return;
        }

        let msgData: any;

        if (count == 3 || count == 2) {
            msgData = (ENDGAME_MESSAGES as any)[count];
        }
        
        if (count == 1) {
            // Acesso seguro aos mods
            if (this.data.mods && this.data.mods.score) {
                if (this.data.mods.score.me > this.data.mods.score.rival)
                    msgData = (ENDGAME_MESSAGES as any)['WON'];
                else if (this.data.mods.score.me < this.data.mods.score.rival)
                    msgData = (ENDGAME_MESSAGES as any)['LOST'];
                else
                    msgData = (ENDGAME_MESSAGES as any)['DRAW'];
            }
        }

        if (count == 0) {
            if (this.data.flags) {
                this.data.flags.return_main_menu = true;
            }
            // window.dispatchEvent(new Event('game-end')); 
        }

        if (!msgData) return;
        this.showCountdownMessage(msgData, 2);
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

    private showCountdownMessage(msgData: any, duration: number) {
        if (!this.data.scene) return;
        showWarningMessage({
            scene: this.data.scene,
            message: msgData.text,
            pos: "big",
            color: msgData.color,
            duration: duration
        });
    }

}