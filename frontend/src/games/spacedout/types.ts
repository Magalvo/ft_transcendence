export interface SpacedOutSocketPayload {
  type?: string;
  [key: string]: unknown;
}

export interface SpacedOutLogEntry {
  id: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface TerrainConfig {
  seed: number;
  noiseScale: number;
  heightAmplitude: number;
  noiseOctaves: number;
  persistence: number;
  lacunarity: number;
}

export type GameMode = "PVP" | "ARCADE";

export interface MatchSettings {
  gameMode: GameMode;
  botsEnabled: boolean;
}

export interface SpacedOutSessionUser {
  id: string;
  username: string;
  email?: string | null;
}

export interface SpacedOutSessionResponse {
  token: string;
  expiresInSeconds: number;
  wsUrl: string;
  user: SpacedOutSessionUser;
}
