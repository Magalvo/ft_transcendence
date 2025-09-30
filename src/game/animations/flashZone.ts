import { BABYLON, side } from "../../index.js";
import type { SceneData, Side, Table } from "../../index.js";

/**
 * Creates the flash mesh and its material.
 */
function createFlashPlane(
  data: SceneData,
  camp_side: Side,
  table: Table,
  baseWidth: number,
  initialScale: number
) {
  const anchorEdge = camp_side === side.left ? table.left_line : table.right_line;
  const plane = BABYLON.MeshBuilder.CreatePlane(
    "flashZone",
    { width: baseWidth, height: table.dimensions.z },
    data.scene
  );
  plane.position = new BABYLON.Vector3(
    camp_side === side.left
      ? anchorEdge + (baseWidth * initialScale) / 2
      : anchorEdge - (baseWidth * initialScale) / 2,
    table.upper_line + 0.05,
    table.pos.z
  );
  plane.rotation.x = Math.PI / 2;

  const mat = new BABYLON.StandardMaterial("flashMat", data.scene);
  mat.emissiveColor =
    data.good_side === side.right
      ? new BABYLON.Color3(0.7, 0.7, 1)
      : new BABYLON.Color3(1, 0.2, 0.2);
  mat.alpha = 0.0;
  mat.needAlphaBlending = () => true;
  plane.material = mat;

  plane.scaling = new BABYLON.Vector3(initialScale, 1, initialScale);

  return plane;
}

/**
 * Creates the alpha (fade in/out) animation.
 */
function createAlphaAnimation(totalFrames: number, fadeInEnd: number, holdEnd: number) {
  const animAlpha = new BABYLON.Animation(
    "flashAlpha",
    "material.alpha",
    60,
    BABYLON.Animation.ANIMATIONTYPE_FLOAT,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  animAlpha.setKeys([
    { frame: 0, value: 0 },
    { frame: fadeInEnd, value: 0.7 },
    { frame: holdEnd, value: 0.7 },
    { frame: totalFrames, value: 0 }
  ]);
  return animAlpha;
}

/**
 * Creates the scale animations for X and Z axes.
 */
function createScaleAnimations(
  totalFrames: number,
  fadeInEnd: number,
  initialScale: number,
  finalScale: number
) {
  const animScale = new BABYLON.Animation(
    "flashScale",
    "scaling.x",
    60,
    BABYLON.Animation.ANIMATIONTYPE_FLOAT,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  animScale.setKeys([
    { frame: 0, value: initialScale },
    { frame: fadeInEnd, value: 1 },
    { frame: totalFrames, value: finalScale }
  ]);
  const animScaleZ = animScale.clone();
  animScaleZ.targetProperty = "scaling.z";
  return [animScale, animScaleZ];
}

/**
 * Updates the plane's position to keep the fixed edge during animation.
 */
function updateFlashPlanePosition(
  plane: BABYLON.Mesh,
  camp_side: Side,
  table: Table,
  baseWidth: number
) {
  const scale = plane.scaling.x;
  plane.position.x = camp_side === side.left
    ? table.left_line + (baseWidth * scale) / 2
    : table.right_line - (baseWidth * scale) / 2;
}

/**
 * Main function: flashZone, using all helpers.
 */
export function flashZone(
  data: SceneData,
  camp_side: Side,
  table: Table
): void {
  const baseWidth = table.dimensions.x * 0.1;
  const initialScale = 0.4;
  const finalScale = 1.15;
  const fadeInEnd = 18;
  const holdEnd = 25;
  const totalFrames = 60;

  const plane = createFlashPlane(data, camp_side, table, baseWidth, initialScale);
  const animAlpha = createAlphaAnimation(totalFrames, fadeInEnd, holdEnd);
  const [animScale, animScaleZ] = createScaleAnimations(
    totalFrames, fadeInEnd, initialScale, finalScale
  );

  plane.animations = [animAlpha, animScale, animScaleZ];

  let animating = true;
  const observer = data.scene.onBeforeRenderObservable.add(() => {
    if (!animating) return;
    updateFlashPlanePosition(plane, camp_side, table, baseWidth);
  });

  data.scene.beginAnimation(plane, 0, totalFrames, false, 1, () => {
    animating = false;
    data.scene.onBeforeRenderObservable.remove(observer);
    plane.dispose();
  });
}