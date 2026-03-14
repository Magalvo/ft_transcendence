import { ApiClient } from "./ApiClient";
import type { SpacedOutSessionResponse } from "../games/spacedout/types";

export class SpacedOutService {
  public static async createSession(): Promise<SpacedOutSessionResponse> {
    const response = await ApiClient.get<SpacedOutSessionResponse>("/api/auth/games/spacedout/session");
    return response.data;
  }
}
