import { mov, type Mov } from "./index";

export class GamePlayer {

    /* --- ATTRIBUTES --- */
    private _type: "human" | "bot";
    private _socket_id?: string;
    private _level?: number;
    private _side: "left" | "right";
    private _state: "waiting" | "ready" = "waiting";
    public id: number = -1;
    public input: Mov = mov.null;
    public nick: string;

    /* --- CONSTRUCTORS --- */
    constructor(type: "human", socket_id: string, side: "left" | "right", name: string);
    constructor(type: "bot", level: number, side: "left" | "right", name: string);
    constructor(type: "human" | "bot", idOrLevel: string | number, side: "left" | "right", nick: string) {
        this._type = type;
        if (type == "human") {
            this._socket_id = idOrLevel as string;
        }
        else {
            this._level = idOrLevel as number;
            this.setReady();
        }
        this.nick = nick;
        this._side = side;
    };

    /* --- GET METHODS --- */
    public get type() { return this._type; }
    public get socket_id() { return this._socket_id; }
    public get level() { return this._level; }
    public get side() { return this._side; }
    public get state() { return this._state; }
    public get isReady() { return this._state === "ready"; }

    /* --- SET METHODS --- */
    public setReady() {
        this._state = "ready";
    }

}
