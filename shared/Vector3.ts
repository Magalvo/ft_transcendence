// src/shared/Vector3.ts

export class Vector3 {
    // 1. Declarar as propriedades explicitamente
    public x: number;
    public y: number;
    public z: number;

    // 2. Receber os argumentos e atribuir manualmente
    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // Cria um clone para não alterar o original
    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }

    // Copia valores de outro vetor
    copyFrom(other: { x: number, y: number, z: number }): this {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        return this;
    }

    // Operações Matemáticas Básicas
    add(other: Vector3): Vector3 {
        return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    subtract(other: Vector3): Vector3 {
        return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    scale(scale: number): Vector3 {
        return new Vector3(this.x * scale, this.y * scale, this.z * scale);
    }

    // Usado nas tuas colisões (Teorema de Pitágoras 3D)
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    
    // Utilitário para o servidor enviar JSON (array é mais leve que objeto)
    asArray(): [number, number, number] {
        return [this.x, this.y, this.z];
    }
}