import type { GameConfiguration, GamePlayer, GameStatus, Mov, ServerBall, ServerMagicBall, ServerPaddle, ServerTable } from "./index";

export interface IGameData {
    // Flow
    status: GameStatus;
    gameTime: number;
    phaseTimer: number;
    countdownTimer: number;
    lastCountdownInt: number;
    lastPauseToggle: number;

    // Entities
    balls: ServerBall[];
    magicBalls: ServerMagicBall[];
    paddlesLeft: ServerPaddle[];
    paddlesRight: ServerPaddle[];
    table: ServerTable;

    // Stats
    score: { left: number, right: number };
    scoreFlash: 'left' | 'right' | null;

    // Mechanics
    isHell: boolean;
    currentHellMode: number;
    magicBallTimer: number;
    nextMagicBallId: number;

    // Players
    players: GamePlayer[]; 
    
    // Inputs
    inputs: { left: Mov[], right: Mov[] };

    // Features / Configs
    configs: GameConfiguration;
}
