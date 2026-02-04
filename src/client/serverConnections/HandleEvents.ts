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

    constructor(gameScene: GameScene) {
        this.data = {} as GameData; // Placeholder
        this.gameScene = gameScene;
    }

    public setData(data: GameData) {
        this.data = data;
    }

    /**
     * Recebe o evento 'init' do servidor.
     * Cria a cena nova e define o lado do jogador.
     */
    public initializeGame(serverData: any) {
        console.log("🔥 SERVER INIT RECEIVED:", serverData);

        // 1. Criar a cena com as configs do servidor
        this.gameScene.resetScene(serverData.configs);

        // 2. Atualizar a referência de dados locais
        this.data = (this.gameScene as any).data;

        // 3. Definir o lado do jogador
        this.data.mySide = serverData.side;
        this.data.myIndex = serverData.index;

        console.log(`Eu sou: ${serverData.side} (Index: ${serverData.index})`);
    }

    public gameState(serverState: any) {
        // Só sincroniza se a cena já estiver criada
        if (!this.data || !this.data.scene) return;

        if (serverState.paddles) syncPaddles(this.data, serverState.paddles);
        if (serverState.balls) syncPlayingBalls(this.data, serverState.balls, serverState.isHell);
        if (serverState.magicBalls) syncMagicBalls(this.data, serverState.magicBalls);
        syncTable(this.data);

        syncGameStats(this.data, serverState);
        this.handleGameStartTrigger(serverState.status);
        // this.updateHellVisuals(serverState);
    }

    // --- GAME CONTROL EVENTS ---

    public gamePaused() {
        console.log("Game Paused by Server");
        // Força a flag para permitir criar o menu, se necessário
        this.data.flags.game_running = true; 
        pauseScreen(this.data);
        // Atualiza estado interno
        this.data.flags.game_running = false; 
    }

    public gameResumed() {
        console.log("Game Resumed");
        resumeGame(this.data);
        
        this.data.flags.game_running = true;
        this.data.flags.pause_screen = false;
    }

    // --- MESSAGING EVENTS ---

    public onCountdown(count: number) {
        // Fecha o menu principal se ainda estiver aberto (lógica antiga)
        // closeMainMenu(this.data); 
        
        // Tenta ir buscar a mensagem ao dicionário antigo
        const msgData = (COUNTDOWN_MESSAGES as any)[count];
        
        // Se não existir (ex: count = 0), ou mostramos "GO" ou ignoramos
        if (count >= 0) {
            // Se msgData for undefined, usamos um fallback simples
            const fallback = { text: String(count), color: "white" };
            this.showCountdownMessage(msgData || fallback, 1);
        }
    }

    public onEndGame(count: number) {
        let msgData: any;

        // Mensagens de contagem decrescente para o fim (3, 2...)
        if (count == 3 || count == 2) {
            msgData = (ENDGAME_MESSAGES as any)[count];
        }
        
        // No último segundo (1), decide quem ganhou e mostra a mensagem final
        if (count == 1) {
            if (this.data.mods.score.me > this.data.mods.score.rival)
                msgData = (ENDGAME_MESSAGES as any)['WON'];
            else if (this.data.mods.score.me < this.data.mods.score.rival)
                msgData = (ENDGAME_MESSAGES as any)['LOST'];
            else
                msgData = (ENDGAME_MESSAGES as any)['DRAW'];
        }

        // Quando chega a 0, volta ao menu
        if (count == 0) {
            this.data.flags.return_main_menu = true;
            // Aqui podes disparar um evento para mostrar o Lobby HTML novamente, se quiseres
            // window.dispatchEvent(new Event('game-end')); 
        }

        if (!msgData) return;
        this.showCountdownMessage(msgData, 2);
    }

    public socketMessage(server_data: any) {
        // Lógica antiga para inverter o lado visual da mensagem se formos o jogador da direita
        let targetSide = server_data.side;
        if (this.data.mySide === 'right' && (server_data.side === 'left' || server_data.side === 'right')) {
            targetSide = (server_data.side === 'left') ? 'right' : 'left';
        }

        showWarningMessage({
            scene: this.data.scene,
            message: server_data.message,
            pos: targetSide, // Usa o lado ajustado visualmente
            color: server_data.color,
            duration: server_data.duration
        });
    }

    /* PRIVATE HELPER METHODS */

    private handleGameStartTrigger(status: GameStatus) {
        // Se o servidor entrou em Countdown, o jogo vai começar -> esconde o Lobby
        if (status === GameStatus.COUNTDOWN && !this.data.flags.game_running) {
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