


export interface User {
  id: string;
  username: string;
  passwordHash?: string | null;
  twoFactorSecret?: string | null;
  tempTwoFactorSecret?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  online: boolean;
  resetToken?: string | null;
  resetExpires?: string | null;
}