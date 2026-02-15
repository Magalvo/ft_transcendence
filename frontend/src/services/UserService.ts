// Define types based on Subject IV.3 [cite: 214, 221, 222]
export interface User {
    id: number;
    username: string;
    email: string;
    avatar: string;
    status: 'online' | 'offline' | 'ingame';
    stats: {
        wins: number;
        losses: number;
        rank: string;
    };
}

export interface MatchHistory {
    id: number;
    date: string;
    opponent: string;
    score: string;
    result: 'WIN' | 'LOSS';
}

export class UserService {
    // Mock Data - Replace with fetch('/api/users/me') later
    private static currentUser: User = {
        id: 1,
        username: "PongMaster42",
        email: "student@42.fr",
        avatar: "https://ui-avatars.com/api/?name=Pong+Master&background=0D8ABC&color=fff",
        status: "online",
        stats: { wins: 42, losses: 7, rank: "Gold" }
    };

    private static history: MatchHistory[] = [
        { id: 101, date: "2023-10-25", opponent: "BitHunter", score: "5-3", result: "WIN" },
        { id: 102, date: "2023-10-24", opponent: "NullPointer", score: "1-5", result: "LOSS" },
        { id: 103, date: "2023-10-20", opponent: "SegFault", score: "5-4", result: "WIN" }
    ];

    public static async getProfile(): Promise<User> {
        // Simulate network delay
        return new Promise(resolve => setTimeout(() => resolve(this.currentUser), 300));
    }

    public static async getHistory(): Promise<MatchHistory[]> {
        return this.history;
    }

    public static async updateAvatar(file: File): Promise<string> {
        console.log("Uploading file:", file.name);
        // Simulate upload and return a fake new URL [cite: 219]
        return URL.createObjectURL(file); 
    }
}