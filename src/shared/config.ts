export const SERVER_URL = "http://localhost:3000";

export const HELL_DURATION = 10; // 20
export const HEAVEN_DURATION = 10; // 30
export const MAGIC_EFFECT_DURATION = 10; // 10
export const MAGIC_BALL_INTERVAL = 5; // 5
export const MAGIC_BALL_MAX = 5; // 5
export const GAME_DURATION = HELL_DURATION * 1 + HEAVEN_DURATION * 1; // *3, *4

export const COUNTDOWN_MESSAGES = {
  3: { text: "FATE AWAITS", color: "blue" },
  2: { text: "HELL RISES", color: "red" },
  1: { text: "PREPARE", color: "green" },
  0: { text: "CLASH !!!", color: "red" }
}

export const ENDGAME_MESSAGES = {
  3: { text: "TIME'S UP", color: "blue" },
  2: { text: "YOU...", color: "blue" },
  LOST: { text: "LOST", color: "red" },
  WON: { text: "WON", color: "green" },
  DRAW: { text: "DRAW", color: "blue" }
}