
/* DEFAULT CONFIGURATIONS */
export class GameConfiguration {
    
    private _heaven_duration = 30;
    private _hell_duration = 20;
    /* --- ATTRIBUTES --- */
    // default options: 1 x 1
    private _paddles_per_side = 1;
    private _game_duration!: number;
    private _hell_rounds_amount!: number;
    private _power_ups = true;
    private _paddle = {
        width: 0.5,
        depth: 30,
        speed: 60,
        knockback_step: 4,
        knockback_recover: 0.5,
    };
    private _ball = {
        radius: 2,
        big_ball_size_mod: 2.5,
        speed: 50,
        min_amount: 1,
        max_amount: 5,
    };
    private _magic_ball = {
        effect_duration: 10,
        min_interval: 3,
        max_interval: 7,
        max_balls: 5,
    };
    private _table = {
        width: 170,
        depth: 90,
    };

    /* --- CONSTRUCTOR --- */
    constructor(
        duration: "fast" | "normal" | "long",
        type: "one_for_one" | "two_for_two" | "three_for_three"
    ) {
        this.setGameDuration(duration);
        this.setGameType(type);
    }

    /* --- GET METHODS --- */
    public get players_per_side() { return this._paddles_per_side; }
    public get game_duration() { return this._game_duration; }
    public get heaven_duration() { return this._heaven_duration; }
    public get hell_duration() { return this._hell_duration; }
    public get hell_rounds_amount() { return this._hell_rounds_amount; }
    public get power_ups() { return this._power_ups; }
    // elements
    public get paddle() { return this._paddle; }
    public get ball() { return this._ball; }
    public get magic_ball() { return this._magic_ball; }
    public get table() { return this._table; }

    /* --- SET METHODS --- */
    public set power_ups(state: boolean) { this._power_ups = state; }
    public setGameDuration(duration: "fast" | "normal" | "long") {
        if (duration == "fast")
            this._hell_rounds_amount = 2;
        if (duration == "normal")
            this._hell_rounds_amount = 4;
        if (duration == "long")
            this._hell_rounds_amount = 8;
        // game duration in seconds
        this._game_duration =
            this._hell_rounds_amount * (this._heaven_duration + 1)
            + this._hell_rounds_amount * this._hell_duration;
    }

    public setGameType(type: "one_for_one" | "two_for_two" | "three_for_three") {
        // 2 x 2 configurations
        if (type == "two_for_two") {
            this.ball.min_amount = 3;
            this.ball.max_amount = 10;
            this.ball.speed *= 1.7;
            this.table.depth *= 2;
        }
        // 3 x 3 configurations
        if (type == "three_for_three") {
        }
    }

    public toJSON() {
        return {
            paddles_per_side: this._paddles_per_side,
            game_duration: this._game_duration,
            hell_rounds_amount: this._hell_rounds_amount,
            power_ups: this._power_ups,
            paddle: this._paddle,
            ball: this._ball,
            magic_ball: this._magic_ball,
            table: this._table
        };
    }
}
