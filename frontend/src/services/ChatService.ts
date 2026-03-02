import { ApiClient } from './ApiClient';
import { TokenManager } from './TokenManager';

export interface ChatUser {
  id: string;
  username: string;
}

export interface ChatGroup {
  id_group: number;
  name: string;
  admin_id?: number;
  visibility?: GroupVisibility;
  owner_id?: string;
}

export type GroupVisibility = "public" | "private" | "protected";

export interface ChatMessage {
  id_message: string | number;
  id_usersender: string;
  sender_name: string;
  messagem: string;
  timestamp: number;
  is_game_invite?: boolean;
  invite_url?: string;
  invite_session?: string | null;
}

export interface PrivateChat {
  id_privatechat: number;
  id_user1: string;
  id_user2: string;
}

export interface GroupMember {
  id: string;
  username: string;
  role: "owner" | "admin" | "member";
  online?: boolean;
  is_banned?: boolean;
  muted_until: number | null;
}

export interface ChatListUser {
  id: string;
  username: string;
  online: boolean;
}

const mockUser: ChatUser = { id: '1', username: 'Player' };

export class ChatService {
  static async getCurrentUser(): Promise<ChatUser> {
    const cached = TokenManager.getUser();
    if (cached?.id && cached?.username) {
      return { id: String(cached.id), username: String(cached.username) };
    }

    try {
      const response = await ApiClient.get('/api/auth/me');
      const user = response.data;
      if (user?.id && user?.username) {
        return { id: String(user.id), username: String(user.username) };
      }
    } catch {
      // Fallback to mock user when auth profile is unavailable.
    }

    return mockUser;
  }

  static async getGroups(): Promise<ChatGroup[]> {
    const response = await ApiClient.get<ChatGroup[]>('/api/auth/groups');
    return response.data ?? [];
  }

  static async getUsers(): Promise<ChatListUser[]> {
    const response = await ApiClient.get<ChatListUser[]>("/api/auth/users");
    return response.data ?? [];
  }

  static async getGroupMessages(groupId: number): Promise<ChatMessage[]> {
    const response = await ApiClient.get<ChatMessage[]>(`/api/auth/groups/${groupId}/messages?limit=100`);
    const data = response.data ?? [];
    return [...data].sort((a, b) => a.timestamp - b.timestamp);
  }

  static async sendGroupMessage(groupId: number, userId: string, content: string): Promise<ChatMessage> {
    const response = await ApiClient.post<ChatMessage>(`/api/auth/groups/${groupId}/messages`, {
      id_usersender: userId,
      messagem: content,
    });
    return response.data;
  }

  static async createGroup(name: string, visibility: GroupVisibility, password?: string) {
    const response = await ApiClient.post("/api/auth/groups", { name, visibility, password });
    return response.data;
  }

  static async joinGroup(groupId: number, password?: string) {
    const response = await ApiClient.post(`/api/auth/groups/${groupId}/join`, { password });
    return response.data;
  }

  static async getGroupRole(groupId: number): Promise<"owner" | "admin" | "member"> {
    const response = await ApiClient.get<{ role: "owner" | "admin" | "member" }>(`/api/auth/groups/${groupId}/role`);
    return response.data.role;
  }

  static async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const response = await ApiClient.get<GroupMember[]>(`/api/auth/groups/${groupId}/members`);
    return response.data ?? [];
  }

  static async inviteMember(groupId: number, username: string) {
    await ApiClient.post(`/api/auth/groups/${groupId}/invite`, { username });
  }

  static async setAdmin(groupId: number, targetId: string, enabled: boolean) {
    await ApiClient.post(`/api/auth/groups/${groupId}/admins/${targetId}`, { enabled });
  }

  static async kick(groupId: number, targetId: string) {
    await ApiClient.post(`/api/auth/groups/${groupId}/kick/${targetId}`);
  }

  static async ban(groupId: number, targetId: string) {
    await ApiClient.post(`/api/auth/groups/${groupId}/ban/${targetId}`);
  }

  static async unban(groupId: number, targetId: string) {
    await ApiClient.post(`/api/auth/groups/${groupId}/unban/${targetId}`);
  }

  static async mute(groupId: number, targetId: string, seconds: number) {
    await ApiClient.post(`/api/auth/groups/${groupId}/mute/${targetId}`, { seconds });
  }

  static async unmute(groupId: number, targetId: string) {
    await ApiClient.post(`/api/auth/groups/${groupId}/unmute/${targetId}`);
  }

  static async updateChannelSettings(groupId: number, visibility: GroupVisibility, password?: string) {
    await ApiClient.post(`/api/auth/groups/${groupId}/settings`, { visibility, password });
  }

  static async getPrivateChats(): Promise<PrivateChat[]> {
    const response = await ApiClient.get<PrivateChat[]>("/api/auth/private");
    return response.data ?? [];
  }

  static async getOrCreatePrivateChat(targetId: string): Promise<PrivateChat> {
    const response = await ApiClient.post<PrivateChat>("/api/auth/private", { targetId });
    return response.data;
  }

  static async getPrivateMessages(chatId: number): Promise<ChatMessage[]> {
    const response = await ApiClient.get<ChatMessage[]>(`/api/auth/private/${chatId}/messages?limit=100`);
    return response.data ?? [];
  }

  static async sendPrivateMessage(chatId: number, content: string): Promise<ChatMessage> {
    const response = await ApiClient.post<ChatMessage>(`/api/auth/private/${chatId}/messages`, { messagem: content });
    return response.data;
  }

  static async blockUser(targetId: string) {
    await ApiClient.post(`/api/auth/blocks/${targetId}`);
  }

  static async unblockUser(targetId: string) {
    await ApiClient.post(`/api/auth/blocks/unblock/${targetId}`);
  }

  static async getBlockedUsers(): Promise<Array<{ id: string; username: string }>> {
    const response = await ApiClient.get<Array<{ id: string; username: string }>>("/api/auth/blocks");
    return response.data ?? [];
  }

  static async getUserProfile(userId: string) {
    const response = await ApiClient.get(`/api/auth/users/${userId}/profile`);
    return response.data;
  }
}
