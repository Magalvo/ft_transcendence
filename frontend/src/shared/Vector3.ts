export class Vector3 {
    public x: number;
    public y: number;
    public z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }

    copyFrom(other: { x: number, y: number, z: number }): this {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        return this;
    }

    add(other: Vector3): Vector3 {
        return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    subtract(other: Vector3): Vector3 {
        return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    scale(scale: number): Vector3 {
        return new Vector3(this.x * scale, this.y * scale, this.z * scale);
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    
    asArray(): [number, number, number] {
        return [this.x, this.y, this.z];
    }
}