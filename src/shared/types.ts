// src/shared/types.ts

export const GameStatus = {
    WAITING: 0,
    RUNNING: 1,
    PAUSED: 2,
    ENDED: 3
} as const;

export type GameStatus = typeof GameStatus[keyof typeof GameStatus];

export interface IVector3 {
    x: number;
    y: number;
    z: number;
}

export interface IGameObject {
    position: IVector3;
    velocity: IVector3;
    size: IVector3;
}

export interface IBallState extends IGameObject {
    active: boolean;
    type: 'normal' | 'magic';
}

export interface IPaddleState extends IGameObject {
    side: 'left' | 'right';
}

export interface IGameState {
    paddles: IPaddleState[];
    balls: IBallState[];
    score: { left: number; right: number };
    status: GameStatus;
    time: number;
    hellTimer: number;
    isHell: boolean;
    activeHellMode: number;
}