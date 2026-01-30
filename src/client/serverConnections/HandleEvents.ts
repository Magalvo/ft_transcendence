import {
    closeMainMenu,
    COUNTDOWN_MESSAGES,
    ENDGAME_MESSAGES,
    GameStatus,
    pauseScreen,
    showWarningMessage,
    syncGameStats,
    syncMagicBalls,
    syncPaddles,
    syncPlayingBalls,
    syncTable,
    type GameData,
    type Side,
} from "../index";

export class HandleEvents {

    /* DECLARATIONS */

    private data: GameData;

    constructor() {
        this.data = {} as GameData;
    }


    /* SET METHODS */


    public setData(data: GameData) {
        this.data = data;
    }


    /* PUBLIC METHODS */


    public initializeGame(data: any) {
        console.log("Player Side assigned:", data.side);
        this.data.mySide = data.side;
        this.data.gameFeatures = data.features;
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

    public onCountdown(count: number) {
        closeMainMenu(this.data);
        const msgData = (COUNTDOWN_MESSAGES as any)[count];
        if (!msgData) return;
        this.showCountdownMessage(msgData, 1);
    }

    public onEndGame(count: number) {
        let msgData: any;
        if (count == 3 || count == 2)
            msgData = ENDGAME_MESSAGES[count];
        if (count == 1) {
            if (this.data.mods.score.me > this.data.mods.score.rival)
                msgData = ENDGAME_MESSAGES['WON'];
            else if (this.data.mods.score.me < this.data.mods.score.rival)
                msgData = ENDGAME_MESSAGES['LOST'];
            else
                msgData = ENDGAME_MESSAGES['DRAW'];
        }
        if (count == 0)
            this.data.flags.return_main_menu = true;
        if (!msgData) return;
        this.showCountdownMessage(msgData, 2);
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
        if (serverState.table) syncTable(this.data, serverState.table);
        syncGameStats(this.data, serverState);
        this.handleGameStartTrigger(serverState.status);
        this.updateHellVisuals(serverState);
    }


    /* PRIVATE METHODS */

    private showCountdownMessage(msgData: any, duration: number) {
        showWarningMessage({
            scene: this.data.scene,
            message: msgData.text,
            pos: "big",
            color: msgData.color,
            duration: duration
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