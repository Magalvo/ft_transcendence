// Database schema types
export type Group = {
	id_group: number;
	admin_id: number;
	name: string;
};

export type HistGroup = {
	id_message: string;
	id_group: number;
	id_usersender: number;
	messagem: string;
	timestamp?: number;
};

export type PrivateChat = {
	id_privatechat: number;
	id_user1: number;
	id_user2: number;
};

export type HistPrivateChat = {
	id_message: string;
	id_usersender: number;
	messagem: string;
	id_privatechat: number;
	timestamp?: number;
};

export type User = {
	id: number;
	username: string;
	avatar?: string;
};

// Unified message type for UI
export type ChatMessage = {
	id_message: string;
	sender_id: number;
	sender_name: string;
	content: string;
	timestamp: number;
	type: 'group' | 'private';
	group_id?: number;
	private_chat_id?: number;
};

// WebSocket message types
export type WSMessage =
	| { type: 'group_message'; data: HistGroup; sender_name: string }
	| { type: 'private_message'; data: HistPrivateChat; sender_name: string }
	| { type: 'error'; error: string };
