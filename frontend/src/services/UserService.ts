import { ApiClient } from './ApiClient';
import { TokenManager } from './TokenManager';
import { UserStore, UserProfile, Friend } from '../core/UserStore';
import type { User, MatchHistory } from '../types/User';
import {
  getGeneratedAvatarUrl,
  getUserAvatarUrl,
  isGeneratedAvatarUrl,
  normalizeStoredAvatarUrl,
} from '../shared/avatar';

/**
 * UserService - Fetches and manages user data from the API
 * Syncs with global UserStore for reactive updates
 */
export class UserService {
  static async getIncomingFriendRequests(): Promise<Array<{ id: number; requesterId: string; username: string; createdAt: number }>> {
    const response = await ApiClient.get('/api/auth/friends/requests/incoming');
    return Array.isArray(response.data) ? response.data : [];
  }

  static async acceptFriendRequest(requestId: number): Promise<void> {
    await ApiClient.post(`/api/auth/friends/requests/${requestId}/accept`);
    await this.refreshProfile();
  }

  static async declineFriendRequest(requestId: number): Promise<void> {
    await ApiClient.post(`/api/auth/friends/requests/${requestId}/decline`);
  }

  /**
   * Get current user profile from API
   * Caches data if valid, otherwise fetches fresh
   * @param forceRefresh - If true, bypasses cache and fetches fresh data
   */
  static async getProfile(forceRefresh: boolean = false): Promise<UserProfile> {
    try {
      const cached = UserStore.getUser();
      const hasValidCache =
        cached && !forceRefresh && !TokenManager.isUserCacheExpired();

      if (hasValidCache) {
        console.log('Using cached user profile');
        return cached;
      }

      if (cached && !forceRefresh) {
        console.log('Cached user profile expired, fetching a fresh copy');
      }


      const userData = await this.fetchCurrentUser();
      console.log('📥 Fetched user data from API:', userData);

      const storedUser = TokenManager.getUser();
      const storedAvatarUrl = storedUser?.avatarUrl;

      const profile: UserProfile = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        avatarUrl:
          normalizeStoredAvatarUrl(userData.avatarUrl) ??
          normalizeStoredAvatarUrl(storedAvatarUrl) ??
          getGeneratedAvatarUrl(userData.username),
        status: userData.online ? 'online' : 'offline',
        wins: 0,
        losses: 0,
        twoFactorEnabled: userData.twoFactorEnabled,
        matches: [],
        friends: [],
        stats: {
          wins: 0,
          losses: 0,
          rank: 'Unranked'
        }
      };

      console.log('🖼️ Avatar URL set to:', profile.avatarUrl);

      const [stats, matches, friends] = await Promise.all([
        this.fetchUserStats(userData.id),
        this.fetchUserMatches(userData.id),
        this.fetchUserFriends(userData.id)
      ]);

      profile.wins = stats.wins;
      profile.losses = stats.losses;
      profile.rank = stats.rank;
      profile.stats = {
        wins: stats.wins,
        losses: stats.losses,
        rank: stats.rank
      };
      profile.matches = matches.map(match => ({
        ...match,
        id: String(match.id)
      }));
      profile.friends = friends;


      UserStore.setUser(profile);
      TokenManager.setUser(profile);

      console.log('✅ Profile stored in UserStore and TokenManager');
      return profile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);

      const cached = TokenManager.getUser();
      if (cached) {
        console.warn('Falling back to last stored user profile after fetch failure');
        UserStore.setUser(cached);
        return cached as UserProfile;
      }

      throw error;
    }
  }

  /**
   * Fetch only the current user's basic info
   */
  static async fetchCurrentUser(): Promise<User> {
    try {
      const response = await ApiClient.get('/api/auth/me');

      if (response.status === 200 && response.data) {
        return response.data;
      }

      throw new Error('Failed to fetch current user');
    } catch (error) {
      console.error('Error fetching current user:', error);
      throw error;
    }
  }

  /**
   * Fetch user stats (wins, losses, rank)
   */
  static async fetchUserStats(userId: string): Promise<{ wins: number; losses: number; rank?: string }> {
    try {
      const response = await ApiClient.get(`/api/auth/users/${userId}/stats`);

      if (response.status === 200 && response.data) {
        return {
          wins: Number(response.data.wins ?? 0),
          losses: Number(response.data.losses ?? 0),
          rank: response.data.rank ?? 'Unranked'
        };
      }

      // Return defaults if endpoint doesn't exist
      return { wins: 0, losses: 0, rank: 'Unranked' };
    } catch (error) {
      console.warn('Failed to fetch user stats, using defaults:', error);
      return { wins: 0, losses: 0, rank: 'Unranked' };
    }
  }

  /**
   * Fetch user match history
   */
  static async fetchUserMatches(userId: string): Promise<MatchHistory[]> {
    try {
      const response = await ApiClient.get(`/api/auth/users/${userId}/matches`);

      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data.map((match: any) => {
          const perspective = match.user_perspective ?? {};
          const userScore = Number(perspective.user_score ?? 0);
          const opponentScore = Number(perspective.opponent_score ?? 0);
          const won = Boolean(perspective.won);

          return {
            id: String(match.id ?? ''),
            date: match.ended_at ?? match.started_at ?? new Date().toISOString(),
            opponent: perspective.opponent_username || 'Unknown Player',
            score: `${userScore}-${opponentScore}`,
            result: won ? 'WIN' : 'LOSS'
          } as MatchHistory;
        });
      }

      return [];
    } catch (error) {
      console.warn('Failed to fetch user matches:', error);
      return [];
    }
  }

  /**
   * Fetch user friends list
   */
  static async fetchUserFriends(userId: string): Promise<Friend[]> {
    try {
      const response = await ApiClient.get(`/api/auth/users/${userId}/friends`);

      if (response.status === 200 && Array.isArray(response.data)) {
        return response.data;
      }

      return [];
    } catch (error) {
      console.warn('Failed to fetch user friends:', error);
      return [];
    }
  }

  /**
   * Get cached profile (doesn't fetch)
   */
  static getCachedProfile(): UserProfile | null {
    if (TokenManager.isUserCacheExpired()) {
      return null;
    }
    return UserStore.getUser();
  }

  /**
   * Refresh profile from server
   */
  static async refreshProfile(): Promise<UserProfile> {
    try {
      UserStore.clearUser();
      return await this.getProfile();
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      throw error;
    }
  }

  /**
   * Get match history
   */
  static async getHistory(): Promise<MatchHistory[]> {
    try {
      const profile = await this.getProfile();
      return profile.matches.map(match => ({
        ...match,
        id: String(match.id)
      }));
    } catch (error) {
      console.error('Failed to get match history:', error);
      return [];
    }
  }

  /**
   * Update user avatar
   */
  static async updateAvatar(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await ApiClient.post('/api/auth/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.status === 200 && response.data?.url) {

        const profile = UserStore.getUser();
        if (profile) {
          profile.avatarUrl = getUserAvatarUrl({
            username: profile.username,
            avatarUrl: response.data.url,
          });
          UserStore.setUser(profile);

          TokenManager.setUser(profile);
        }
        return response.data.url;
      }

      throw new Error('Failed to upload avatar');
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }
  }

  /**
   * Update user username
   */
  static async updateUsername(username: string): Promise<string> {
    try {
      const normalized = username.trim();
      if (normalized.length < 3 || normalized.length > 20) {
        throw new Error('Username must be between 3 and 20 characters');
      }

      const response = await ApiClient.post('/api/auth/users/username', {
        username: normalized
      });

      // Handle response - backend returns { success: true, username: "..." }
      let newUsername = response.data?.username || response.data?.data?.username;

      if (!newUsername) {
        throw new Error('Invalid response from server');
      }

      const profile = UserStore.getUser();
      if (profile) {
        profile.username = newUsername;
        if (!profile.avatarUrl || isGeneratedAvatarUrl(profile.avatarUrl)) {
          profile.avatarUrl = getGeneratedAvatarUrl(newUsername);
        }
        UserStore.setUser(profile);
        TokenManager.setUser(profile);
      }
      return newUsername;
    } catch (error: any) {
      console.error('Username update error:', error);

      // Extract meaningful error message
      let errorMessage = 'Failed to update username';

      if (error?.response?.status === 409) {
        errorMessage = 'Username already taken';
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Add friend by username
   */
  static async addFriend(username: string): Promise<void> {
    try {
      const normalized = username.trim();
      if (!normalized) {
        throw new Error('Username is required');
      }
      if (normalized.length < 3 || normalized.length > 20) {
        throw new Error('Username must be between 3 and 20 characters');
      }

      await ApiClient.post('/api/auth/friends/requests', { username: normalized });
    } catch (error: any) {
      console.error('Add friend error:', error);
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to add friend';
      throw new Error(message);
    }
  }

  static async removeFriend(friendId: string): Promise<void> {
    await ApiClient.post('/api/auth/friends/remove', { friendId });
    await this.refreshProfile();
  }

  /**
   * Get user by ID (for public profiles)
   */
  static async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const response = await ApiClient.get(`/api/auth/users/${userId}/profile`);

      if (response.status === 200 && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  }

  /**
   * Subscribe to profile changes
   */
  static subscribe(callback: (user: UserProfile | null) => void) {
    return UserStore.subscribe(callback);
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return UserStore.isAuthenticated();
  }
}

export type { User, UserProfile, MatchHistory, Match, Friend } from '../types/User';
