import * as THREE from "three";

type WarpPhase = "fade" | "warp" | "settle";

interface JoinWarpTransitionOptions {
  mount: HTMLElement;
  onPhaseChange?: (phase: WarpPhase) => void;
}

interface StarMeta {
  velocity: number;
  drift: number;
}

const STAR_COUNT = 1800;
const STAR_FIELD_DEPTH = 1800;
const STAR_FIELD_RADIUS = 220;

export class JoinWarpTransition {
  private readonly mount: HTMLElement;
  private readonly onPhaseChange?: (phase: WarpPhase) => void;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly stars: THREE.Points;
  private readonly starLines: THREE.LineSegments;
  private readonly starPositions: Float32Array;
  private readonly starLinePositions: Float32Array;
  private readonly starSprite: THREE.CanvasTexture;
  private readonly starMeta: StarMeta[] = [];
  private animationFrameId: number | null = null;
  private activePlay: Promise<void> | null = null;
  private activeResolver: (() => void) | null = null;
  private isDestroyed = false;
  private lastTick = 0;
  private playStartedAt = 0;
  private currentPhase: WarpPhase = "fade";

  public constructor(options: JoinWarpTransitionOptions) {
    this.mount = options.mount;
    this.onPhaseChange = options.onPhaseChange;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = "spacedout-transition-canvas";

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020409, 0.00095);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 3000);
    this.camera.position.z = 24;

    const geometry = new THREE.BufferGeometry();
    const lineGeometry = new THREE.BufferGeometry();
    this.starPositions = new Float32Array(STAR_COUNT * 3);
    this.starLinePositions = new Float32Array(STAR_COUNT * 6);
    const colors = new Float32Array(STAR_COUNT * 3);
    const lineColors = new Float32Array(STAR_COUNT * 6);

    for (let index = 0; index < STAR_COUNT; index += 1) {
      this.seedStar(index, true);

      const color = new THREE.Color().setHSL(
        0.54 + Math.random() * 0.06,
        0.95,
        0.72 + Math.random() * 0.18,
      );
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
      lineColors[index * 6] = color.r;
      lineColors[index * 6 + 1] = color.g;
      lineColors[index * 6 + 2] = color.b;
      lineColors[index * 6 + 3] = color.r;
      lineColors[index * 6 + 4] = color.g;
      lineColors[index * 6 + 5] = color.b;
    }

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.starPositions, 3),
    );
    (
      geometry.getAttribute("position") as THREE.BufferAttribute
    ).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.starLinePositions, 3),
    );
    (
      lineGeometry.getAttribute("position") as THREE.BufferAttribute
    ).setUsage(THREE.DynamicDrawUsage);
    lineGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(lineColors, 3),
    );

    this.starSprite = this.createStarSprite();

    const material = new THREE.PointsMaterial({
      size: 2,
      map: this.starSprite,
      alphaMap: this.starSprite,
      transparent: true,
      opacity: 0.96,
      alphaTest: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
      toneMapped: false,
    });
    const lineMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      toneMapped: false,
    });

    this.stars = new THREE.Points(geometry, material);
    this.stars.frustumCulled = false;
    this.starLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    this.starLines.frustumCulled = false;
    this.updateStarTrails(0);
    this.scene.add(this.starLines);
    this.scene.add(this.stars);
    this.mount.appendChild(this.renderer.domElement);

    this.resize();
  }

  public play(durationMs = 2800): Promise<void> {
    if (this.isDestroyed) {
      return Promise.resolve();
    }

    if (this.activePlay) {
      return this.activePlay;
    }

    this.playStartedAt = performance.now();
    this.lastTick = this.playStartedAt;
    this.setPhase("fade");
    this.activePlay = new Promise<void>((resolve) => {
      this.activeResolver = resolve;
    });
    this.animationFrameId = window.requestAnimationFrame((time) =>
      this.animate(time, durationMs),
    );
    return this.activePlay;
  }

  public resize(): void {
    if (this.isDestroyed) {
      return;
    }

    const width = Math.max(this.mount.clientWidth, window.innerWidth, 1);
    const height = Math.max(this.mount.clientHeight, window.innerHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public destroy(): void {
    this.isDestroyed = true;

    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.activeResolver?.();
    this.activeResolver = null;
    this.activePlay = null;

    this.stars.geometry.dispose();
    const material = this.stars.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material.dispose();
    }
    this.starLines.geometry.dispose();
    const lineMaterial = this.starLines.material;
    if (Array.isArray(lineMaterial)) {
      lineMaterial.forEach((entry) => entry.dispose());
    } else {
      lineMaterial.dispose();
    }
    this.starSprite.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private animate(time: number, durationMs: number): void {
    if (this.isDestroyed) {
      return;
    }

    const elapsed = time - this.playStartedAt;
    const deltaSeconds = Math.min((time - this.lastTick) / 1000, 0.05);
    this.lastTick = time;

    if (elapsed < 650) {
      this.setPhase("fade");
    } else if (elapsed < durationMs - 550) {
      this.setPhase("warp");
    } else {
      this.setPhase("settle");
    }

    const progress = THREE.MathUtils.clamp(elapsed / durationMs, 0, 1);
    const warpFactor = this.getWarpFactor(progress);
    this.advanceStars(deltaSeconds, warpFactor);

    this.camera.fov = THREE.MathUtils.lerp(72, 122, warpFactor);
    this.camera.position.z = THREE.MathUtils.lerp(24, 12, progress);
    this.camera.updateProjectionMatrix();

    const starMaterial = this.stars.material as THREE.PointsMaterial;
    starMaterial.size = THREE.MathUtils.lerp(1.85, 1.15, warpFactor);
    starMaterial.opacity = THREE.MathUtils.lerp(0.96, 0.14, warpFactor);

    const lineMaterial = this.starLines.material as THREE.LineBasicMaterial;
    lineMaterial.opacity =
      THREE.MathUtils.smoothstep(warpFactor, 0.08, 0.92) * 0.9;

    this.stars.rotation.z += deltaSeconds * (0.025 + warpFactor * 0.16);
    this.stars.rotation.x = Math.sin(elapsed * 0.001) * 0.03;
    this.starLines.rotation.copy(this.stars.rotation);

    this.renderer.render(this.scene, this.camera);

    if (progress >= 1) {
      this.finish();
      return;
    }

    this.animationFrameId = window.requestAnimationFrame((nextTime) =>
      this.animate(nextTime, durationMs),
    );
  }

  private finish(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const resolve = this.activeResolver;
    this.activeResolver = null;
    this.activePlay = null;
    resolve?.();
  }

  private setPhase(phase: WarpPhase): void {
    if (phase === this.currentPhase) {
      return;
    }

    this.currentPhase = phase;
    this.onPhaseChange?.(phase);
  }

  private getWarpFactor(progress: number): number {
    if (progress <= 0.18) {
      return THREE.MathUtils.smoothstep(progress / 0.18, 0, 1) * 0.25;
    }
    if (progress <= 0.78) {
      return THREE.MathUtils.smoothstep((progress - 0.18) / 0.66, 0, 1);
    }
    return THREE.MathUtils.smootherstep(1 - (progress - 0.84) / 0.22, 0, 1);
  }

  private advanceStars(deltaSeconds: number, warpFactor: number): void {
    const positions = this.starPositions;
    const movementScale = deltaSeconds * (180 + warpFactor * 2200);
    const lateralScale = deltaSeconds * warpFactor * 9;

    for (let index = 0; index < STAR_COUNT; index += 1) {
      const offset = index * 3;
      const meta = this.starMeta[index];

      positions[offset + 2] += movementScale * meta.velocity;
      positions[offset] += meta.drift * lateralScale;
      positions[offset + 1] -= meta.drift * lateralScale * 0.35;

      if (
        positions[offset + 2] > 40 ||
        Math.abs(positions[offset]) > STAR_FIELD_RADIUS * 1.8 ||
        Math.abs(positions[offset + 1]) > STAR_FIELD_RADIUS * 1.8
      ) {
        this.seedStar(index, false);
      }
    }

    const attribute = this.stars.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    attribute.needsUpdate = true;
    this.updateStarTrails(warpFactor);
  }

  private seedStar(index: number, initialSeed: boolean): void {
    const offset = index * 3;
    const radius = Math.pow(Math.random(), 0.45) * STAR_FIELD_RADIUS;
    const theta = Math.random() * Math.PI * 2;

    this.starPositions[offset] = Math.cos(theta) * radius;
    this.starPositions[offset + 1] = Math.sin(theta) * radius;
    this.starPositions[offset + 2] = initialSeed
      ? -Math.random() * STAR_FIELD_DEPTH
      : -STAR_FIELD_DEPTH * (0.72 + Math.random() * 0.28);

    this.starMeta[index] = {
      velocity: 0.6 + Math.random() * 1.45,
      drift: (Math.random() - 0.5) * 2.2,
    };
  }

  private updateStarTrails(warpFactor: number): void {
    const positions = this.starPositions;
    const linePositions = this.starLinePositions;
    const forwardSpeed = 180 + warpFactor * 2200;
    const trailStrength = Math.pow(
      THREE.MathUtils.smootherstep(warpFactor, 0.05, 1),
      1.1,
    );

    for (let index = 0; index < STAR_COUNT; index += 1) {
      const offset = index * 3;
      const lineOffset = index * 6;
      const meta = this.starMeta[index];
      const velocityX = meta.drift * warpFactor * 9;
      const velocityY = -meta.drift * warpFactor * 9 * 0.35;
      const velocityZ = forwardSpeed * meta.velocity;
      const directionLength =
        Math.hypot(velocityX, velocityY, velocityZ) || 1;
      const trailLength =
        (1.2 + trailStrength * 150) * (0.7 + meta.velocity * 0.3);

      linePositions[lineOffset] = positions[offset];
      linePositions[lineOffset + 1] = positions[offset + 1];
      linePositions[lineOffset + 2] = positions[offset + 2];
      linePositions[lineOffset + 3] =
        positions[offset] - (velocityX / directionLength) * trailLength;
      linePositions[lineOffset + 4] =
        positions[offset + 1] - (velocityY / directionLength) * trailLength;
      linePositions[lineOffset + 5] =
        positions[offset + 2] - (velocityZ / directionLength) * trailLength;
    }

    const trailAttribute = this.starLines.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    trailAttribute.needsUpdate = true;
  }

  private createStarSprite(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to create star sprite canvas.");
    }

    const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 26);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.95)");
    gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.42)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(32, 32, 26, 0, Math.PI * 2);
    context.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
}
