import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { TerrainConfig } from "./types";
import type { SpacedOutSocketClient } from "./SpacedOutSocketClient";
import {
  DEFAULT_TERRAIN_CONFIG,
  SCALE_Z,
  WORLD_RADIUS,
} from "./SpacedOutGameShared";

const CHUNK_SIZE = 64;
const MAP_CHUNKS_X = 12;
const MAP_CHUNKS_Y = 12;

export class TerrainSystem {
  private readonly terrainGroup: THREE.Group;
  private terrainConfig: TerrainConfig = { ...DEFAULT_TERRAIN_CONFIG };
  private worldGrid: number[][] | null = null;

  public constructor(terrainGroup: THREE.Group) {
    this.terrainGroup = terrainGroup;
  }

  public get config(): TerrainConfig {
    return { ...this.terrainConfig };
  }

  public get grid(): number[][] | null {
    return this.worldGrid;
  }

  public setConfig(config: TerrainConfig): void {
    this.terrainConfig = { ...config };
  }

  public getTerrainHeightAtNormal(normal: THREE.Vector3): number {
    if (!this.worldGrid) {
      return 0;
    }

    const phi = Math.acos(normal.y);
    const theta = Math.atan2(normal.z, normal.x);
    const mapRows = this.worldGrid.length;
    const mapCols = this.worldGrid[0].length;
    const rRow = Math.round((phi / Math.PI) * (mapRows - 1));
    const rCol = Math.round(
      ((Math.PI - theta) / (2 * Math.PI)) * (mapCols - 1),
    );
    const safeRow = Math.max(0, Math.min(rRow, mapRows - 1));
    const safeCol = Math.max(0, Math.min(rCol, mapCols - 1));

    return Math.max(0, this.worldGrid[safeRow][safeCol] * SCALE_Z);
  }

  public rebuild(): void {
    this.clearTerrain();

    const grid = this.generateSeamlessWorld(MAP_CHUNKS_X, MAP_CHUNKS_Y);
    this.worldGrid = grid;
    let minZ = Infinity;
    for (const row of grid) {
      for (const value of row) {
        minZ = Math.min(minZ, value);
      }
    }

    this.terrainGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(WORLD_RADIUS + minZ * SCALE_Z - 500, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000b18 }),
      ),
    );

    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(WORLD_RADIUS, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x071f67,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    ocean.renderOrder = 1;
    this.terrainGroup.add(ocean);

    const totalRows = grid.length;
    const totalCols = grid[0].length;
    const geometries: THREE.BufferGeometry[] = [];
    const origin = new THREE.Vector3(0, 0, 0);

    for (let row = 0; row < totalRows - 1; row += CHUNK_SIZE) {
      for (let col = 0; col < totalCols - 1; col += CHUNK_SIZE) {
        geometries.push(
          this.createChunkGeometry(
            grid,
            row,
            col,
            4,
            totalRows,
            totalCols,
            origin,
          ),
        );
      }
    }

    const merged = mergeGeometries(geometries);
    if (merged) {
      this.terrainGroup.add(
        new THREE.Mesh(
          merged,
          new THREE.MeshBasicMaterial({
            vertexColors: true,
            wireframe: true,
            transparent: false,
            opacity: 1,
          }),
        ),
      );
    }

    geometries.forEach((geometry) => geometry.dispose());
  }

  public uploadCollisionMap(socketClient: SpacedOutSocketClient): boolean {
    if (!this.worldGrid || this.worldGrid.length === 0) {
      return false;
    }

    const mapRows = this.worldGrid.length;
    const mapCols = this.worldGrid[0].length;
    if (mapCols === 0) {
      return false;
    }

    for (const row of this.worldGrid) {
      if (row.length !== mapCols) {
        return false;
      }
    }

    const buffer = new ArrayBuffer(8 + mapRows * mapCols * 4);
    const header = new Uint32Array(buffer, 0, 2);
    const flatGrid = new Float32Array(buffer, 8);

    header[0] = mapRows;
    header[1] = mapCols;

    let index = 0;
    for (let row = 0; row < mapRows; row += 1) {
      for (let col = 0; col < mapCols; col += 1) {
        flatGrid[index] = this.worldGrid[row][col];
        index += 1;
      }
    }

    socketClient.sendBinary(buffer);
    return true;
  }

  private clearTerrain(): void {
    while (this.terrainGroup.children.length > 0) {
      const child = this.terrainGroup.children[0];
      this.terrainGroup.remove(child);
      this.disposeObject(child);
    }
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else if (material) material.dispose();
    });
  }

  private generateSeamlessWorld(
    chunksX: number,
    chunksY: number,
  ): number[][] {
    const rows = chunksY * CHUNK_SIZE + 1;
    const cols = chunksX * CHUNK_SIZE + 1;
    const grid: number[][] = [];

    for (let row = 0; row < rows; row += 1) {
      const phi = Math.PI * (row / (rows - 1));
      const terrainRow: number[] = [];

      for (let col = 0; col < cols; col += 1) {
        const theta = 2 * Math.PI * (col / (cols - 1));
        const nx = Math.sin(phi) * Math.cos(theta);
        const ny = Math.cos(phi);
        const nz = Math.sin(phi) * Math.sin(theta);
        let elevation = 0;
        let amplitude = this.terrainConfig.heightAmplitude;
        let scale = this.terrainConfig.noiseScale;

        for (
          let octave = 0;
          octave < this.terrainConfig.noiseOctaves;
          octave += 1
        ) {
          const offset = this.terrainConfig.seed + octave * 100;
          elevation +=
            Math.sin(nx * scale + offset) *
            Math.cos(ny * scale - offset) *
            Math.sin(nz * scale + offset) *
            amplitude;
          amplitude *= this.terrainConfig.persistence;
          scale *= this.terrainConfig.lacunarity;
        }

        terrainRow.push(elevation < 0 ? elevation * 0.3 : elevation + 200);
      }

      grid.push(terrainRow);
    }

    return grid;
  }

  private createChunkGeometry(
    grid: number[][],
    startRow: number,
    startCol: number,
    step: number,
    totalRows: number,
    totalCols: number,
    centerXYZ: THREE.Vector3,
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    const endRow = Math.min(startRow + CHUNK_SIZE, totalRows - 1);
    const endCol = Math.min(startCol + CHUNK_SIZE, totalCols - 1);
    const chunkRows = Math.floor((endRow - startRow) / step) + 1;
    const chunkCols = Math.floor((endCol - startCol) / step) + 1;

    for (let row = startRow; row <= endRow; row += step) {
      for (let col = startCol; col <= endCol; col += step) {
        const rawZ = grid[row][col];
        if (rawZ <= -500) color.setHex(0x0a1e3f);
        else if (rawZ < 0) color.setHex(0x00469e);
        else if (rawZ < 200) color.setHex(0x387c44);
        else if (rawZ < 1000) color.setHex(0x8a9a5b);
        else if (rawZ < 3000) color.setHex(0x8b7355);
        else color.setHex(0xffffff);
        colors.push(color.r, color.g, color.b);

        const point = this.getSphericalXYZ(
          row,
          col,
          totalRows,
          totalCols,
          rawZ,
        );
        vertices.push(
          point.x - centerXYZ.x,
          point.y - centerXYZ.y,
          point.z - centerXYZ.z,
        );
      }
    }

    for (let row = 0; row < chunkRows - 1; row += 1) {
      for (let col = 0; col < chunkCols - 1; col += 1) {
        const a = row * chunkCols + col;
        const b = row * chunkCols + col + 1;
        const c = (row + 1) * chunkCols + col;
        const d = (row + 1) * chunkCols + col + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private getSphericalXYZ(
    row: number,
    col: number,
    totalRows: number,
    totalCols: number,
    rawZ: number,
  ): THREE.Vector3 {
    const phi = Math.PI * (row / (totalRows - 1));
    const theta = Math.PI - 2 * Math.PI * (col / (totalCols - 1));
    const radius = WORLD_RADIUS + rawZ * SCALE_Z;
    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }
}
