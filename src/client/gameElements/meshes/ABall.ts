import {
  BABYLON,
  Paddle,
  flashZone,
  spawnHitParticles,
  GameObject,
  Color3,
  PlayingBall,
  type GameObjectOptions,
  type ObjectValue,
  type GameData,
} from "../../index.js";


// Ball options type
export type BallOptions = GameObjectOptions & {
  radius: number;
  speed: ObjectValue<number> & { max: number };
};


// Ball: base class for all balls (movement, collisions, respawn)
export abstract class Ball extends GameObject {
  public radius: ObjectValue<number>;
  public speed: ObjectValue<number> & { max: number };
  public speed_modifier = 1;
  public angle = 0;
  public velocity = 0;
  public respawn_timer = 0;
  public flame_animation!: BABYLON.ParticleSystem;

  constructor(options: BallOptions) {
    super(options);
    this.radius = { value: options.radius, original: options.radius };
    this.speed = options.speed;
    this.mesh = this.createMesh(options.scene);
  }

  // Create Babylon mesh for the ball
  protected createMesh(scene: BABYLON.Scene): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateSphere(
      "ball",
      { diameter: this.radius.value * 2, segments: 32 },
      scene
    );
    mesh.position = this.pos.value;
    const mat = new BABYLON.StandardMaterial("ballMat", scene);
    mat.diffuseColor = new Color3(0.8, 0.95, 1.0);
    mat.alpha = 0.8;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0.09, 0.12, 0.18);
    mat.needDepthPrePass = true;
    mesh.material = mat;
    return mesh;
  }

  // Main update (to be implemented by subclasses)
  abstract update(...args: any[]): void;

  // Clean up mesh and particles
  public dispose() {
    this.mesh?.dispose();
  }

  // Paddle collision (AABB overlap)
  protected paddleCollisions(data: GameData) {
    for (let paddle of data.obj3D.paddles) {
      const overlap =
        Math.abs(this.pos.value.x - paddle.pos.value.x) - paddle.dimensions.value.x / 2 - this.radius.value <= 0 &&
        Math.abs(this.pos.value.y - paddle.pos.value.y) - paddle.dimensions.value.y / 2 - this.radius.value <= 0 &&
        Math.abs(this.pos.value.z - paddle.pos.value.z) - paddle.dimensions.value.z / 2 - this.radius.value <= 0;
      if (overlap)
        this.paddleCollisionAction(paddle, data);
    }
  }

  private paddleCollisionAction(paddle: Paddle, data: GameData) {
    // Side collision (X axis)
    if (this.pos.value.z > paddle.limits.near && this.pos.value.z < paddle.limits.far)
      spawnHitParticles(data.scene, this.pos.value);
    // Top/bottom collision (Z axis)
    if (this.pos.value.x > paddle.limits.left && this.pos.value.x < paddle.limits.right)
      spawnHitParticles(data.scene, this.pos.value);
  }

  // Wall collision and scoring
  protected wallCollisions(data: GameData) {
    const table = data.obj3D.table;
    // Z+ far wall
    if (this.limits.far >= table.limits.far)
      spawnHitParticles(data.scene, this.pos.value);
    // Z- near wall
    if (this.limits.near <= table.limits.near)
      spawnHitParticles(data.scene, this.pos.value);
    // X- left wall: score for right
    if (this.limits.left <= table.limits.left) {
      if (this instanceof PlayingBall) {
        flashZone(data, "left", table);
      }
    }
    // X+ right wall: score for left
    if (this.limits.right - this.radius.value >= table.limits.right) {
      if (this instanceof PlayingBall) {
        flashZone(data, "right", table);
      }
    }
  }
}