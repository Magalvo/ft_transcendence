

export interface RefreshToken {
  token: string;
  expires_at: string;
}

export interface DecodedToken {
  username: string;
  email?: string;
}