import {
    closeMainMenu,
    COUNTDOWN_MESSAGES,
    GameStatus,
    pauseScreen,
    showWarningMessage,
    syncGameStats,
    syncMagicBalls,
    syncPaddles,
    syncPlayingBalls,
    type GameData,
} from "../index";

export class HandleEvents {

    /* DECLARATIONS */

    private data: GameData;
    private lastCountdownValue: number = -1;

    constructor() {
        this.data = {} as GameData;
    }


    /* SET METHOD */


    public setData(data: GameData) {
        this.data = data;
    }


    /* PUBLIC METHODS */


    public initializeGame(server_data: { side: string }) {
        console.log("Player Side assigned:", server_data.side);
        this.data.mySide = server_data.side;
    }

    public gamePaused() {
        console.log("Game Paused by Server");
        // Temporarily flag running to allow UI creation
        this.data.flags.game_running = true;
        pauseScreen(this.data);
        this.data.flags.game_running = false;
    }

    public gameResumed() {
        console.log("Game Resumed");
        if (this.data.obj2D.guiPauseMenu) {
            this.data.obj2D.guiPauseMenu.dispose();
            this.data.obj2D.guiPauseMenu = undefined;
        }
        this.data.env.camera.detachControl();
        this.data.flags.game_running = true;
        this.data.flags.pause_screen = false;

        this.data.env.hellMusic.play();
        this.data.env.heavenMusic.play();
    }

    public socketMessage(server_data: any) {
        // Invert visual side if player is 'right'
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

    public gameState(serverState: any) {
        if (serverState.paddles) syncPaddles(this.data, serverState.paddles);
        if (serverState.balls) syncPlayingBalls(this.data, serverState.balls, serverState.isHell);
        if (serverState.magicBalls) syncMagicBalls(this.data, serverState.magicBalls);

        syncGameStats(this.data, serverState);
        this.handleGameStartTrigger(serverState.status);
        this.updateHellVisuals(serverState);
        this.handleCountdown(serverState.status, serverState.countdown);
    }


    /* PRIVATE METHODS */


    private handleCountdown(status: number, count: number) {
        if (status === GameStatus.COUNTDOWN) {
            closeMainMenu(this.data);
            if (count !== this.lastCountdownValue) {
                this.showCountdownMessage(count);
                this.lastCountdownValue = count;
            }
        } else if (status === GameStatus.RUNNING && this.lastCountdownValue !== 0) {
            // Trigger "GO" message
            this.showCountdownMessage(0);
            this.lastCountdownValue = 0;
        }
    }

    private showCountdownMessage(count: number) {
        const msgData = (COUNTDOWN_MESSAGES as any)[count];
        if (!msgData) return;

        showWarningMessage({
            scene: this.data.scene,
            message: msgData.text,
            pos: "big",
            color: msgData.color,
            duration: 1
        });
    }

    private updateHellVisuals(serverState: any) {
        if (serverState.isHell) {
            this.data.mods.devilElapsed = serverState.hellTimer;
            this.data.mods.goodElapsed = 0;
        } else {
            this.data.mods.goodElapsed = serverState.hellTimer;
            this.data.mods.devilElapsed = 0;
        }
    }

    private handleGameStartTrigger(status: number) {
        if (status === GameStatus.RUNNING && !this.data.flags.game_running) {
            console.log("GAME STARTED!");
            this.data.flags.game_running = true;
        }
    }
}