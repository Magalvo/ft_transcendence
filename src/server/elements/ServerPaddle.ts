import { Vector3 } from "../../shared/Vector3.js";
import { mov, type Mov } from "../../shared/strings.js";

export class ServerPaddle {
    public pos: Vector3;
    public side: 'left' | 'right';
    private speed: number = 60; // Velocidade base
    private tableLimits = { z: 90 }; // Limites da mesa (profundidade)
    private height = 6; // Altura da raquete (profundidade visual)

    constructor(side: 'left' | 'right', x: number) {
        this.side = side;
        this.pos = new Vector3(x, 3, 0); // Y=3 (altura do chão)
    }

    public update(deltaTime: number, moveCommand: Mov) {
        let dir = 0;

        // Converter comando (string) em direção numérica
        if (moveCommand === mov.far) dir = 1;      // "Cima" (Z positivo)
        if (moveCommand === mov.near) dir = -1;    // "Baixo" (Z negativo)

        // Aplicar movimento
        if (dir !== 0) {
            this.pos.z += dir * this.speed * deltaTime;
        }

        // Manter dentro da mesa (Clamping)
        const limit = (this.tableLimits.z / 2) - (this.height / 2);
        if (this.pos.z > limit) this.pos.z = limit;
        if (this.pos.z < -limit) this.pos.z = -limit;
    }
}