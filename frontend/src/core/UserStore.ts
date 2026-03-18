/**
 * UserStore - Centralized user state management
 * Manages global user data and provides reactive updates
 */

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

export type UserStoreListener = (user: UserProfile | null) => void;

class UserStoreClass {
  private currentUser: UserProfile | null = null;
  private listeners: Set<UserStoreListener> = new Set();

  /**
   * Set the current user and notify all listeners
   */
  setUser(user: UserProfile | null): void {
    this.currentUser = user;
    this.notifyListeners();
  }

  /**
   * Get the current user
   */
  getUser(): UserProfile | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Subscribe to user changes
   */
  subscribe(listener: UserStoreListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of user changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.currentUser);
    });
  }

  /**
   * Clear user data (logout)
   */
  clearUser(): void {
    this.currentUser = null;
    this.notifyListeners();
  }

  /**
   * Invalidate cached user data (force refresh on next getProfile call)
   */
  invalidateCache(): void {
    console.log('UserStore: Cache invalidated');
    this.currentUser = null;
    // Don't notify listeners - we just want to force a refresh on next fetch
  }

  /**
   * Update a specific field
   */
  updateField<K extends keyof UserProfile>(field: K, value: UserProfile[K]): void {
    if (this.currentUser) {
      this.currentUser[field] = value;
      this.notifyListeners();
    }
  }

  /**
   * Update wins and losses
   */
  updateStats(wins: number, losses: number): void {
    if (this.currentUser) {
      this.currentUser.wins = wins;
      this.currentUser.losses = losses;
      this.notifyListeners();
    }
  }

  /**
   * Update match history
   */
  updateMatches(matches: Match[]): void {
    if (this.currentUser) {
      this.currentUser.matches = matches;
      this.notifyListeners();
    }
  }

  /**
   * Update friends list
   */
  updateFriends(friends: Friend[]): void {
    if (this.currentUser) {
      this.currentUser.friends = friends;
      this.notifyListeners();
    }
  }
}

export const UserStore = new UserStoreClass();
