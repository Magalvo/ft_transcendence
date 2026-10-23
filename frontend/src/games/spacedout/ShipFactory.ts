import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { normalizeTeamName, type TeamName } from "./SpacedOutGameShared";

export class ShipFactory {
  public static createPilotShip(team: TeamName): THREE.Group {
    const fuselage = (): THREE.BufferGeometry => {
      const positions: number[] = [];
      const indices: number[] = [];
      const radialSegments = 32;
      const lengthSegments = 40;
      const radiusAt = (t: number): number =>
        t < 0.15
          ? 0.1 + t * 2.5
          : t < 0.35
            ? 0.5 + Math.sin((t - 0.15) * 10) * 0.15
            : t < 0.7
              ? 0.65 - (t - 0.35) * 0.3
              : 0.45 - (t - 0.7) * 1.2;

      for (let y = 0; y <= lengthSegments; y += 1) {
        const t = y / lengthSegments;
        const z = t * 10;
        const radius = Math.max(radiusAt(t), 0.05);
        for (let i = 0; i <= radialSegments; i += 1) {
          const theta = (i / radialSegments) * Math.PI * 2;
          positions.push(Math.cos(theta) * radius, Math.sin(theta) * radius, z);
        }
      }

      const ring = radialSegments + 1;
      for (let y = 0; y < lengthSegments; y += 1) {
        for (let i = 0; i < radialSegments; i += 1) {
          indices.push(
            y * ring + i,
            y * ring + i + ring,
            y * ring + i + 1,
            y * ring + i + ring,
            y * ring + i + ring + 1,
            y * ring + i + 1,
          );
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const wingSurface = (
      span: number,
      rootChord: number,
      tipChord: number,
      thicknessRoot: number,
      thicknessTip: number,
      dihedralScale: number,
      chordSegments: number,
      spanSegments: number,
    ): THREE.BufferGeometry => {
      const positions: number[] = [];
      const indices: number[] = [];

      for (let s = 0; s <= spanSegments; s += 1) {
        const spanT = s / spanSegments;
        const halfSpan = spanT * span;
        const chord = rootChord - spanT * (rootChord - tipChord);
        const thickness = thicknessRoot * (1 - spanT) + thicknessTip;
        const dihedral = dihedralScale * spanT;

        for (let c = 0; c <= chordSegments; c += 1) {
          const chordT = c / chordSegments;
          positions.push(
            chordT * chord,
            thickness * Math.sin(Math.PI * chordT) - thickness / 2 + dihedral,
            halfSpan,
          );
        }
      }

      const ring = chordSegments + 1;
      for (let s = 0; s < spanSegments; s += 1) {
        for (let c = 0; c < chordSegments; c += 1) {
          indices.push(
            s * ring + c,
            s * ring + c + ring,
            s * ring + c + 1,
            s * ring + c + ring,
            s * ring + c + ring + 1,
            s * ring + c + 1,
          );
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const canopy = new THREE.SphereGeometry(0.5, 24, 24);
    canopy.scale(1.2, 0.6, 1.0);
    canopy.translate(0, 0.6, 3.0);

    const wingRootBlend = new THREE.SphereGeometry(0.9, 24, 24);
    wingRootBlend.scale(1.6, 0.5, 1.0);
    wingRootBlend.translate(0, -0.15, 3.2);

    const wing = wingSurface(6, 2.0, 1.2, 0.25, 0.08, 0.2, 16, 24);
    wing.rotateY(Math.PI / 2);
    wing.translate(0.5, -0.2, 5.4);
    const wingMirror = wing.clone();
    wingMirror.scale(-1, 1, 1);

    const tail = wingSurface(3.2, 1.4, 0.8, 0.18, 0.05, 0.08, 12, 18);
    tail.rotateY(Math.PI / 2);
    tail.translate(-0.4, -0.05, 8.8);
    const tailMirror = tail.clone();
    tailMirror.scale(-1, 1, 1);

    const vTailPositions: number[] = [];
    const vTailIndices: number[] = [];
    for (let y = 0; y <= 20; y += 1) {
      const t = y / 20;
      const finHeight = t * 2.6;
      const thickness = 0.25 * (1 - t) + 0.05;
      const chord = 1.6 - t * 0.8;
      for (let i = 0; i <= 16; i += 1) {
        const theta = (i / 16) * Math.PI;
        vTailPositions.push(
          Math.cos(theta) * thickness,
          finHeight,
          Math.sin(theta) * chord,
        );
      }
    }
    for (let y = 0; y < 20; y += 1) {
      for (let i = 0; i < 16; i += 1) {
        vTailIndices.push(
          y * 17 + i,
          y * 17 + i + 17,
          y * 17 + i + 1,
          y * 17 + i + 17,
          y * 17 + i + 18,
          y * 17 + i + 1,
        );
      }
    }
    const vTail = new THREE.BufferGeometry();
    vTail.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vTailPositions, 3),
    );
    vTail.setIndex(vTailIndices);
    vTail.computeVertexNormals();
    vTail.rotateY(Math.PI);
    vTail.rotateZ(-0.08);
    vTail.translate(0, 0.2, 8.6);

    const wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(0, -0.5, 0);
    const strut = new THREE.CylinderGeometry(0.05, 0.05, 1);
    strut.translate(0, -0.2, 0);
    const gearRight = mergeGeometries([wheel, strut]);
    gearRight?.translate(0.8, -0.5, 2.5);
    const gearLeft = mergeGeometries([wheel.clone(), strut.clone()]);
    gearLeft?.translate(-0.8, -0.5, 2.5);

    const blade = new THREE.BoxGeometry(0.15, 2, 0.3);
    blade.translate(0, 0.5, 1.5);
    const bladeTwo = blade.clone();
    bladeTwo.rotateZ(Math.PI / 2);
    const propellerGeo = mergeGeometries([blade, bladeTwo]);

    const group = new THREE.Group();
    const accents: THREE.MeshBasicMaterial[] = [];
    const wire = (color: number) =>
      new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.9,
      });

    const fuselageMesh = new THREE.Mesh(fuselage(), wire(0x616161));
    fuselageMesh.userData.isFuselage = true;
    group.add(fuselageMesh);
    group.add(new THREE.Mesh(canopy, wire(0x1a1a1a)));
    group.add(new THREE.Mesh(wingRootBlend, wire(0x8b8b8b)));

    const wingMaterial = wire(0xff2222);
    accents.push(wingMaterial);
    group.add(new THREE.Mesh(wing, wingMaterial));
    group.add(new THREE.Mesh(wingMirror, wingMaterial));

    const tailMaterial = wire(0xff2222);
    accents.push(tailMaterial);
    group.add(new THREE.Mesh(tail, tailMaterial));
    group.add(new THREE.Mesh(tailMirror, tailMaterial));
    group.add(new THREE.Mesh(vTail, tailMaterial));

    if (gearRight) group.add(new THREE.Mesh(gearRight, wire(0x8b8b8b)));
    if (gearLeft) group.add(new THREE.Mesh(gearLeft, wire(0x8b8b8b)));

    if (propellerGeo) {
      const propeller = new THREE.Mesh(
        propellerGeo,
        new THREE.MeshBasicMaterial({ color: 0x8d8d8d, wireframe: true }),
      );
      propeller.position.set(0, 0, -1.4);
      group.add(propeller);
      group.userData.propeller = propeller;
    }

    group.userData.applyFactionColor = (teamName: TeamName) => {
      const color =
        normalizeTeamName(teamName) === "BLUE" ? 0x0088ff : 0xff2222;
      accents.forEach((material) => material.color.setHex(color));
    };

    group.scale.set(0.5, 0.5, 0.5);
    ShipFactory.applyTeamColor(group, team);
    return group;
  }

  public static applyTeamColor(
    ship: THREE.Group | null,
    team: TeamName,
  ): void {
    const applyFactionColor = ship?.userData.applyFactionColor as
      | ((teamName: TeamName) => void)
      | undefined;
    if (applyFactionColor) {
      applyFactionColor(team);
    }
  }
}
