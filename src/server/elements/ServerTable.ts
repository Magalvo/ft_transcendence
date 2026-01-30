import {
    Vector3,
    TABLE_CONFIG
} from "../index.js";

export class ServerTable {
    public pos: Vector3 = new Vector3(0, 0, 0);
    public width: number = TABLE_CONFIG.width;
    public depth: number = TABLE_CONFIG.depth;

    constructor() {
    }

    // --- MAIN UPDATE ---
    public update() {
    }
}