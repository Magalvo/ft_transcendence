import {
    COUNTDOWN_MESSAGES, ENDGAME_MESSAGES, GameScene, GameStatus, type GameData,
    pauseScreen, resumeGame, showWarningMessage, clearAllNotifications,
    syncGameStats, syncMagicBalls, syncPaddles, syncPlayingBalls, syncTable,
    disposeCountdown, showCountdownDisplay
} from "../index.js";

export class HandleEvents {
    private data: GameData = {} as GameData;
    private isReady = false;
    private queue: VoidFunction[] = [];
    private gameScene: GameScene;

    constructor(gameScene: GameScene) { this.gameScene = gameScene }

    /* --- INITIALIZATION --- */

    public initializeGame(serverData: any) {
        console.log("🔥 SERVER INIT");
        clearAllNotifications();
        disposeCountdown();

        this.isReady = false;

        // 1. Build 3D Scene
        this.gameScene.resetScene(serverData.configs);

        // 2. Link Data
        this.data = (this.gameScene as any).data;
        Object.assign(this.data, { mySide: serverData.side, myIndex: serverData.index });

        // 3. Wait for GPU compilation before signaling server
        this.data.scene?.executeWhenReady(() => {
            console.log("✅ GPU READY");
            this.isReady = true;
            this.flushQueue();
            this.data.socket?.emit('renderReady');
        });
    }

    /* --- GAME STATE SYNC (60 FPS) --- */

    public gameState(state: any) {
        if (!this.isReady || !this.data.scene) return;

        if (state.paddles) syncPaddles(this.data, state.paddles);
        if (state.balls) syncPlayingBalls(this.data, state.balls, state.isHell);
        if (state.magicBalls) syncMagicBalls(this.data, state.magicBalls);
        syncTable(this.data);
        syncGameStats(this.data, state);

        this.checkGameStart(state.status);
    }

    /* --- EVENTS --- */

    public onCountdown(count: number) {
        if (this.queueEvent(() => this.onCountdown(count))) return;

        const msg = (COUNTDOWN_MESSAGES as any)[count];
        if (msg && this.data.scene)
            showCountdownDisplay(this.data.scene, msg.text, msg.color, 1.0);
    }

    public onEndGame(count: number) {
        if (this.queueEvent(() => this.onEndGame(count))) return;

        let msg = (ENDGAME_MESSAGES as any)[count];

        // Determine Match Result
        if (count === 1 && this.data.mods?.score) {
            const { me, rival } = this.data.mods.score;
            const result = me > rival ? 'WON' : me < rival ? 'LOST' : 'DRAW';
            msg = (ENDGAME_MESSAGES as any)[result];
        }

        if (count === 0 && this.data.flags) this.data.flags.return_main_menu = true;

        if (msg && this.data.scene)
            showCountdownDisplay(this.data.scene, msg.text, msg.color, 2.0);
    }

    public socketMessage(d: any) {
        if (this.queueEvent(() => this.socketMessage(d))) return;

        // Flip visual side if player is on the right
        const pos = (this.data.mySide === 'right' && ['left', 'right'].includes(d.side))
            ? (d.side === 'left' ? 'right' : 'left')
            : d.side;

        showWarningMessage({
            scene: this.data.scene,
            message: d.message,
            pos: pos,
            color: d.color,
            duration: d.duration
        });
    }

    public gamePaused() {
        if (this.queueEvent(() => this.gamePaused())) return;
        if (this.data.flags) {
            this.data.flags.game_running = true; // Enable briefly for snapshot
            pauseScreen(this.data);
            this.data.flags.game_running = false;
        }
    }

    public gameResumed() {
        if (this.queueEvent(() => this.gameResumed())) return;
        resumeGame(this.data);
        if (this.data.flags) {
            this.data.flags.game_running = true;
            this.data.flags.pause_screen = false;
        }
    }

    /* --- HELPERS --- */

    private queueEvent(fn: VoidFunction): boolean {
        if (this.isReady) return false;
        this.queue.push(fn);
        return true;
    }

    private flushQueue() {
        if (!this.queue.length) return;
        console.log(`Processing ${this.queue.length} queued events...`);
        this.queue.forEach(fn => fn());
        this.queue = [];
    }

    private checkGameStart(status: GameStatus) {
        if (status === GameStatus.COUNTDOWN && this.data.flags && !this.data.flags.game_running) {
            this.data.flags.game_running = true;
            window.dispatchEvent(new Event('game-start'));
        }
    }
}