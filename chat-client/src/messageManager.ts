import { nanoid } from 'nanoid';
import type { ChatMessage, WSMessage } from './types';

export class MessageManager {
	private messages: Map<string, ChatMessage> = new Map();

	addMessage(msg: ChatMessage): void {
		this.messages.set(msg.id_message, msg);
	}

	getMessagesByGroup(groupId: number): ChatMessage[] {
		return Array.from(this.messages.values()).filter(m => m.group_id === groupId);
	}

	getMessagesByPrivateChat(chatId: number): ChatMessage[] {
		return Array.from(this.messages.values()).filter(m => m.private_chat_id === chatId);
	}

	createWSMessage(
		type: 'group_message' | 'private_message',
		userId: number,
		username: string,
		content: string,
		chatId: number,
	): WSMessage & { type: string; groupId?: number; chatId?: number } {
		const baseMessage = {
			id_message: nanoid(),
			id_usersender: userId,
			sender_name: username,
			messagem: content,
			timestamp: Date.now(),
		};

		if (type === 'group_message') {
			return {
				type: 'group_message',
				groupId: chatId,
				data: { ...baseMessage, id_group: chatId } as any,
				sender_name: username,
			};
		} else {
			return {
				type: 'private_message',
				chatId: chatId,
				data: { ...baseMessage, id_privatechat: chatId } as any,
				sender_name: username,
			};
		}
	}

	formatMessage(rawMsg: any, type: 'group' | 'private'): ChatMessage {
		return {
			id_message: rawMsg.id_message,
			sender_id: rawMsg.id_usersender,
			sender_name: rawMsg.sender_name || `User ${rawMsg.id_usersender}`,
			content: rawMsg.messagem,
			timestamp: rawMsg.timestamp || Date.now(),
			type,
			group_id: type === 'group' ? rawMsg.id_group : undefined,
			private_chat_id: type === 'private' ? rawMsg.id_privatechat : undefined,
		};
	}
}

export const messageManager = new MessageManager();
