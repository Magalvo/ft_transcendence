
/* magic effects */
export const magicEffect = {
    null: 0,
    big: 1,
    small: 2,
    slow: 3,
    fast: 4,
    freeze: 5,
    thick: 6,
    end_list: 6
} as const;

export type MagicEffect = typeof magicEffect[keyof typeof magicEffect];


/* game status */
export const GameStatus = {
    WAITING: 0,
    RUNNING: 1,
    PAUSED: 2,
    COUNTDOWN: 3,
    ENDGAME: 4
} as const;

export type GameStatus = typeof GameStatus[keyof typeof GameStatus];


/* hell mods */
export const hellMode = {
    null: 0,
    inverted_keys: 1,
    small_paddles: 2,
    slow_paddles: 3,
    fast_balls: 4,
    big_balls: 5,
    multipleBalls: 6,
    twisted_view: 7,
    drunk_view: 8,
    end_list: 8
} as const;
export type HellMode = typeof hellMode[keyof typeof hellMode];


/* keyboard keys code */
export const keyCode = {
    A: 65, B: 66, C: 67, D: 68, E: 69, F: 70, G: 71,
    H: 72, I: 73, J: 74, K: 75, L: 76, M: 77, N: 78,
    O: 79, P: 80, Q: 81, R: 82, S: 83, T: 84, U: 85,
    V: 86, W: 87, X: 88, Y: 89, Z: 90,
    LEFT_ARROW: 37, UP_ARROW: 38, RIGHT_ARROW: 39, DOWN_ARROW: 40,
    SPACE: 32, ENTER: 13, ESC: 27, SHIFT: 16, CTRL: 17, ALT: 18,
} as const;
export type KeyCode = typeof keyCode[keyof typeof keyCode];


/* possible movements list */
export const mov = {
    null: "null",
    far: "far",
    near: "away",
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    invert_x: "invert_x",
    invert_z: "invert_y",
} as const;
export type Mov = typeof mov[keyof typeof mov];


/* side */
export const t_side = {
    left: 'left',
    right: 'right',
    spectator: 'spectator'
};
export type Side = typeof t_side[keyof typeof t_side];
