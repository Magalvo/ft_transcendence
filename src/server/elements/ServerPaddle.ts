import { Vector3 } from "../../shared/Vector3.ts";
import { mov, type Mov } from "../../shared/strings.ts";

export class ServerPaddle {
    public pos: Vector3;
    public side: 'left' | 'right';
    private speed: number = 60;
    private tableLimits = { z: 90 };
    public width: number = 0.5;   
    public depth: number = 30;

    constructor(side: 'left' | 'right', x: number) {
        this.side = side;
        this.pos = new Vector3(x, 3, 0);
    }

    public update(deltaTime: number, moveCommand: Mov) {
        let dir = 0;
        if (moveCommand === mov.far) dir = 1;
        if (moveCommand === mov.near) dir = -1;
        if (dir !== 0) {
            this.pos.z += dir * this.speed * deltaTime;
        }
        const limit = (this.tableLimits.z / 2) - (this.depth / 2);
        if (this.pos.z > limit) this.pos.z = limit;
        if (this.pos.z < -limit) this.pos.z = -limit;
    }

    public getBoundingBox() {
        return {
            left: this.pos.x - this.width / 2,
            right: this.pos.x + this.width / 2,
            near: this.pos.z - this.depth / 2,
            far: this.pos.z + this.depth / 2
        };
    }
}