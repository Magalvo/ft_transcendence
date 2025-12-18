// src/shared/types.ts

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
    time: number;
    isHell: boolean;
    hellMode: number;
}