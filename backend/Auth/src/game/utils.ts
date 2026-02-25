import { hellMode, magicEffect, mov, type Mov } from './index.js';

/**
 * Inverts input command (e.g., Up becomes Down).
 */
export function invertInput(cmd: Mov): Mov {
    if (cmd === mov.far) return mov.near;
    if (cmd === mov.near) return mov.far;
    return mov.null;
}

export function getHellModeName(id: number): string {
    switch (id) {
        case hellMode.inverted_keys: return "INVERTED KEYS";
        case hellMode.small_paddles: return "SMALL PADDLES";
        case hellMode.slow_paddles: return "SLOW PADDLES";
        case hellMode.fast_balls: return "FAST BALLS";
        case hellMode.big_balls: return "BIG BALLS";
        case hellMode.multipleBalls: return "MULTIBALL CHAOS";
        case hellMode.twisted_view: return "TWISTED VIEW";
        case hellMode.drunk_view: return "DRUNK VIEW";
        default: return "HELL MODE";
    }
}

export function getMagicEffectName(id: number): string {
    switch (id) {
        case magicEffect.big: return "BIG PADDLE";
        case magicEffect.small: return "SMALL PADDLE";
        case magicEffect.slow: return "SLOW MOTION";
        case magicEffect.fast: return "SPEED BOOST";
        case magicEffect.freeze: return "FROZEN PADDLE";
        case magicEffect.thick: return "THICK PADDLE";
        default: return "MYSTERY EFFECT";
    }
}