export class GameConfiguration {
    /* --- SETTINGS & DEFAULTS --- */
    private readonly HEAVEN_DURATION = 30;
    private readonly HELL_DURATION = 20;

    // Game State
    private _players_per_side = 1;
    private _game_duration!: number;
    private _duration_label: "fast" | "normal" | "long" = "normal";
    private _hell_rounds_amount!: number;
    private _power_ups = true;

    // Base Configurations (Immutable references for resets)
    private readonly _base_paddle = {
        width: 0.5, depth: 30, speed: 60,
        knockback_step: 4, knockback_recover: 0.5
    };
    private readonly _base_ball = {
        radius: 2, big_ball_size_mod: 2.5, speed: 50,
        min_amount: 1, max_amount: 5
    };
    private readonly _base_table = { width: 170, depth: 90 };

    // Active Configurations (Mutable)
    private _paddle = { ...this._base_paddle };
    private _ball = { ...this._base_ball };
    private _table = { ...this._base_table };
    
    private _magic_ball = {
        effect_duration: 10,
        min_interval: 3, max_interval: 7, max_balls: 5
    };

    constructor(
        duration: "fast" | "normal" | "long",
        type: "one_for_one" | "two_for_two" | "three_for_three"
    ) {
        this.setGameDuration(duration);
        this.setGameType(type);
    }

    /* --- GETTERS --- */
    public get players_per_side() { return this._players_per_side; }
    public get game_duration() { return this._game_duration; }
    public get duration_label() { return this._duration_label; }
    public get hell_rounds_amount() { return this._hell_rounds_amount; }
    public get power_ups() { return this._power_ups; }
    public get hell_duration() { return this.HELL_DURATION; }
    public get heaven_duration() { return this.HEAVEN_DURATION; }

    public get paddle() { return this._paddle; }
    public get ball() { return this._ball; }
    public get magic_ball() { return this._magic_ball; }
    public get table() { return this._table; }

    public set power_ups(state: boolean) { this._power_ups = state; }

    /* --- LOGIC --- */

    /**
     * Sets game duration and calculates total match time based on rounds.
     */
    public setGameDuration(duration: "fast" | "normal" | "long") {
        this._duration_label = duration;
        
        switch (duration) {
            case "fast": this._hell_rounds_amount = 2; break;
            case "normal": this._hell_rounds_amount = 4; break;
            case "long": this._hell_rounds_amount = 8; break;
        }

        this._game_duration =
            this._hell_rounds_amount * (this.HEAVEN_DURATION + 1) +
            this._hell_rounds_amount * this.HELL_DURATION;
    }

    /**
     * Resets physics entities to base values and applies multipliers based on player count.
     */
    public setGameType(type: "one_for_one" | "two_for_two" | "three_for_three") {
        // Reset to base values
        this._paddle = { ...this._base_paddle };
        this._ball = { ...this._base_ball };
        this._table = { ...this._base_table };

        if (type === "one_for_one") {
            this._players_per_side = 1;
        } 
        else if (type === "two_for_two") {
            this._players_per_side = 2;
            this.applyMultipliers(1.5, 1.5, 1.7, 3, 8);
        } 
        else if (type === "three_for_three") {
            this._players_per_side = 3;
            this.applyMultipliers(2.0, 2.0, 2.2, 5, 10);
        }
    }

    private applyMultipliers(speed: number, width: number, depth: number, minBalls: number, maxBalls: number) {
        this._ball.speed *= speed;
        this._table.width *= width;
        this._table.depth *= depth;
        this._ball.min_amount = minBalls;
        this._ball.max_amount = maxBalls;
    }

    public toJSON() {
        return {
            paddles_per_side: this._players_per_side,
            game_duration: this._game_duration,
            duration_label: this._duration_label,
            hell_rounds_amount: this._hell_rounds_amount,
            power_ups: this._power_ups,
            paddle: this._paddle,
            ball: this._ball,
            magic_ball: this._magic_ball,
            table: this._table
        };
    }
}