// Microservices API client
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || true; // Enable mock by default

// Mock data
const mockUsers = [
	{ id: 1, username: 'Alice', avatar: 'alice' },
	{ id: 2, username: 'Bob', avatar: 'bob' },
	{ id: 3, username: 'Charlie', avatar: 'charlie' },
];

const mockGroups = [
	{ id_group: 1, admin_id: 1, name: 'Gaming' },
	{ id_group: 2, admin_id: 2, name: 'Work' },
	{ id_group: 3, admin_id: 1, name: 'Design' },
];

const mockPrivateChats = [
	{ id_privatechat: 1, id_user1: 1, id_user2: 2 },
	{ id_privatechat: 2, id_user1: 1, id_user2: 3 },
];

const mockMessages = {
	group_1: [
		{
			id_message: 'msg1',
			id_group: 1,
			id_usersender: 2,
			sender_name: 'Bob',
			messagem: 'Hey, want to play some games?',
			timestamp: Date.now() - 60000,
		},
		{
			id_message: 'msg2',
			id_group: 1,
			id_usersender: 1,
			sender_name: 'Alice',
			messagem: 'Sure! What game?',
			timestamp: Date.now() - 30000,
		},
	],
	group_2: [
		{
			id_message: 'msg3',
			id_group: 2,
			id_usersender: 2,
			sender_name: 'Bob',
			messagem: 'Project deadline is tomorrow',
			timestamp: Date.now() - 120000,
		},
	],
	group_3: [],
	chat_1: [
		{
			id_message: 'msg4',
			id_privatechat: 1,
			id_usersender: 2,
			sender_name: 'Bob',
			messagem: 'Hi Alice! How are you?',
			timestamp: Date.now() - 90000,
		},
	],
	chat_2: [],
};

// Mock implementation
const mockClient = {
	async getCurrentUser() {
		await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
		return mockUsers[0]; // Return first user as current
	},

	async getUser(userId: number) {
		await new Promise(resolve => setTimeout(resolve, 200));
		return mockUsers.find(u => u.id === userId) || { id: userId, username: `User ${userId}` };
	},

	async getGroups() {
		await new Promise(resolve => setTimeout(resolve, 300));
		return mockGroups;
	},

	async getGroupMessages(groupId: number, limit: number = 50) {
		await new Promise(resolve => setTimeout(resolve, 400));
		const key = `group_${groupId}`;
		const messages = (mockMessages as any)[key] || [];
		return messages.slice(-limit);
	},

	async createGroupMessage(groupId: number, userId: number, content: string) {
		await new Promise(resolve => setTimeout(resolve, 200));
		const msg = {
			id_message: `msg_${Date.now()}`,
			id_group: groupId,
			id_usersender: userId,
			sender_name: mockUsers.find(u => u.id === userId)?.username || `User ${userId}`,
			messagem: content,
			timestamp: Date.now(),
		};
		const key = `group_${groupId}`;
		if (!mockMessages[key as keyof typeof mockMessages]) {
			(mockMessages as any)[key] = [];
		}
		(mockMessages as any)[key].push(msg);
		return msg;
	},

	async getPrivateChats() {
		await new Promise(resolve => setTimeout(resolve, 300));
		return mockPrivateChats;
	},

	async getOrCreatePrivateChat(userId1: number, userId2: number) {
		await new Promise(resolve => setTimeout(resolve, 200));
		let chat = mockPrivateChats.find(
			c => (c.id_user1 === userId1 && c.id_user2 === userId2) ||
				(c.id_user1 === userId2 && c.id_user2 === userId1)
		);
		if (!chat) {
			chat = {
				id_privatechat: mockPrivateChats.length + 1,
				id_user1: userId1,
				id_user2: userId2,
			};
			mockPrivateChats.push(chat);
		}
		return chat;
	},

	async getPrivateChatMessages(chatId: number, limit: number = 50) {
		await new Promise(resolve => setTimeout(resolve, 400));
		const key = `chat_${chatId}`;
		const messages = (mockMessages as any)[key] || [];
		return messages.slice(-limit);
	},

	async createPrivateChatMessage(chatId: number, userId: number, content: string) {
		await new Promise(resolve => setTimeout(resolve, 200));
		const msg = {
			id_message: `msg_${Date.now()}`,
			id_privatechat: chatId,
			id_usersender: userId,
			sender_name: mockUsers.find(u => u.id === userId)?.username || `User ${userId}`,
			messagem: content,
			timestamp: Date.now(),
		};
		const key = `chat_${chatId}`;
		if (!mockMessages[key as keyof typeof mockMessages]) {
			(mockMessages as any)[key] = [];
		}
		(mockMessages as any)[key].push(msg);
		return msg;
	},
};

export const apiClient = USE_MOCK ? mockClient : {
	// User endpoints
	async getCurrentUser() {
		const response = await fetch(`${API_BASE}/users/me`, {
			credentials: 'include',
		});
		if (!response.ok) throw new Error('Failed to fetch current user');
		return response.json();
	},

	async getUser(userId: number) {
		const response = await fetch(`${API_BASE}/users/${userId}`, {
			credentials: 'include',
		});
		if (!response.ok) throw new Error(`Failed to fetch user ${userId}`);
		return response.json();
	},

	// Group endpoints
	async getGroups() {
		const response = await fetch(`${API_BASE}/groups`, {
			credentials: 'include',
		});
		if (!response.ok) throw new Error('Failed to fetch groups');
		return response.json();
	},

	async getGroupMessages(groupId: number, limit: number = 50) {
		const response = await fetch(`${API_BASE}/groups/${groupId}/messages?limit=${limit}`, {
			credentials: 'include',
		});
		if (!response.ok) throw new Error('Failed to fetch group messages');
		return response.json();
	},

	async createGroupMessage(groupId: number, userId: number, content: string) {
		const response = await fetch(`${API_BASE}/groups/${groupId}/messages`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id_usersender: userId, messagem: content }),
		});
		if (!response.ok) throw new Error('Failed to create group message');
		return response.json();
	},

	// Private chat endpoints
	async getPrivateChats() {
		const response = await fetch(`${API_BASE}/chats/private`, {
			credentials: 'include',
		});
		if (!response.ok) throw new Error('Failed to fetch private chats');
		return response.json();
	},

	async getOrCreatePrivateChat(userId1: number, userId2: number) {
		const response = await fetch(`${API_BASE}/chats/private`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id_user1: userId1, id_user2: userId2 }),
		});
		if (!response.ok) throw new Error('Failed to get/create private chat');
		return response.json();
	},

	async getPrivateChatMessages(chatId: number, limit: number = 50) {
		const response = await fetch(`${API_BASE}/chats/private/${chatId}/messages?limit=${limit}`, {
			credentials: 'include',
		});
		if (!response.ok) throw new Error('Failed to fetch private chat messages');
		return response.json();
	},

	async createPrivateChatMessage(chatId: number, userId: number, content: string) {
		const response = await fetch(`${API_BASE}/chats/private/${chatId}/messages`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id_usersender: userId, messagem: content }),
		});
		if (!response.ok) throw new Error('Failed to create private message');
		return response.json();
	},
};

export async function handleApiError(error: any): Promise<void> {
	console.error('API Error:', error.message);
	// Could emit event to UI for error notification
}
