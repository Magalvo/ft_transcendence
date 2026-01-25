// Define types to ensure strictness
export interface Match {
  id: number;
  opponent: string;
  result: 'WIN' | 'LOSS';
  score: string;
  date: string;
}

export interface UserProfile {
  username: string;
  avatarUrl: string; // Default or uploaded
  wins: number;
  losses: number;
  status: 'online' | 'offline' | 'ingame';
  matches: Match[];
  friends: { username: string; status: 'online' | 'offline' }[];
}

export class UserService {
 
  public static async getProfile(): Promise<UserProfile> {
    return {
      username: 'PongMaster42',
      avatarUrl: 'https://cdn.intra.42.fr/users/264153a7c38d3a37161dd2dd387b1103/dde-maga.JPG',
      wins: 42,
      losses: 5,
      status: 'online',
      matches: [
        { id: 1, opponent: 'BitHunter', result: 'WIN', score: '5 - 3', date: '2023-10-25' },
        { id: 2, opponent: 'NullPointer', result: 'LOSS', score: '4 - 5', date: '2023-10-24' },
      ],
      friends: [
        { username: 'Alice', status: 'online' },
        { username: 'Bob', status: 'offline' },
      ]
    };
  }
}