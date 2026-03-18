// User types - Sync with backend
export interface User {
  id: string;
  username: string;
  email: string;
  online: boolean;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'ingame';
  wins: number;
  losses: number;
  rank?: string;
  twoFactorEnabled?: boolean;
  matches: Match[];
  friends: Friend[];
  stats: {
    wins: number;
    losses: number;
    rank?: string;
  };
}

export interface Match {
  id: string;
  date: string;
  opponent: string;
  score: string;
  result: 'WIN' | 'LOSS';
}

export interface Friend {
  id: string;
  username: string;
  status: 'online' | 'offline' | 'ingame';
}

export interface MatchHistory {
  id: string;
  date: string;
  opponent: string;
  score: string;
  result: 'WIN' | 'LOSS';
}
