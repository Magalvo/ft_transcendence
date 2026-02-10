import {
    GameConfiguration,
    Vector3
} from "../game/index.js";

export class ServerTable {
    public pos: Vector3 = new Vector3(0, 0, 0);
    public width: number;
    public depth: number;

    constructor(config: GameConfiguration) {
        this.width = config.table.width;
        this.depth = config.table.depth;
    }

    public update() {
    }
}