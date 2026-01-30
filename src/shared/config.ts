export const SERVER_URL = "http://localhost:3000";

export const PADDLE_CONFIG = {
    width: 0.5,
    depth: 30,
    speed: 120, // 60
    knockback_step: 4,
    knockback_recover: 0.5,
}

export const BALL_CONFIG = {
    radius: 2,
    speed: 50, // 50
    big_ball_size_mod: 2.5,
    min_amount: 3, // 1
    max_amount: 5, // 5
}

export const MAGIC_BALL_CONFIG = {
    effect_duration: 10,
    min_interval: 3,
    max_interval: 7,
    max_balls: 5,
}

export const TABLE_CONFIG = {
    width: 300, // 170
    depth: 170, // 90
}