import { Socket } from "socket.io-client"; // Import necessário
import type { GameConfiguration } from "../server/index.js";
import {
    BABYLON,
    Ball,
    Paddle,
    Table,
    type HellMode,
    type Mov,
    type Objects2D,
    type Environment3D,
    type Side,
} from "./index.js";

// --- Main Objects (Meshes) ---
export interface GameObjects {
    table: Table;
    paddles: Paddle[];
    balls: Ball[];
}

// --- Modifiers/Events ---
export interface GameModifiers {
    // Score & Time
    score: { me: number, rival: number };
    time: number;
    step: number;
    // Hell Mode
    is_hell: boolean;
    hell_mode: HellMode;
    phaseTimer: number;
}

// --- Controllers e Input ---
export interface GameInput {
    // Controls
    keysPressed: boolean[];
    paddle_mov: Mov;
    // Players
    left_player_human: boolean;
    right_player_human: boolean;
}

// --- Flags & UI ---
export interface GameFlags {
    game_running: boolean;
    pause_screen: boolean;
    return_main_menu: boolean;
    camera_pos: number;
}

// --- Magic Balls ---
export interface MagicBallControl {
    magic_balls_ref: Ball[];
    next_magic_ball: number;
    readonly min_time: number;
    readonly max_time: number;
    readonly max_balls: number;
}

// -----------------------------------
// --- GLOBAL GAME DATA (GameData) ---
// -----------------------------------
export interface GameData {
    // Core
    scene: BABYLON.Scene;
    socket: Socket;
    mySide: Side;
    myIndex: number;
    gameConfigs: GameConfiguration;

    // Game Elements
    obj3D: GameObjects;
    obj2D: Objects2D;
    env3D: Environment3D;

    // Logic Groups
    mods: GameModifiers;
    input: GameInput;
    flags: GameFlags;
    magicBalls: MagicBallControl;
}