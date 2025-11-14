

export interface RefreshToken {
  id: number;
  username: string;
  token: string;
  expires_at: string;
}

export interface DecodedToken {
  username: string;
  email?: string;
}