import WebSocket, {WebSocketServer} from "ws";

interface WSClient {
	ws: WebSocket;
	userId?: number;
	groupSubscriptions: Set<number>;
	privateChatSubscriptions: Set<number>;
}

const wss = new WebSocketServer({ port: 5273 });
const clients = new Map<WebSocket, WSClient>();

console.log("WebSocket server running on ws://localhost:5273");

wss.on("connection", (ws) => {
	const client: WSClient = {
		ws,
		groupSubscriptions: new Set(),
		privateChatSubscriptions: new Set(),
	};
	clients.set(ws, client);

	console.log("Client connected. Total clients:", clients.size);

	ws.on("message", (data) => {
		try {
			const message = JSON.parse(data.toString());
			const client = clients.get(ws);
			if (!client) return;

			console.log("Received message:", message.type);

			switch (message.type) {
				case "auth":
					client.userId = message.userId;
					console.log(`User ${message.userId} authenticated`);
					break;

				case "subscribe_group":
					client.groupSubscriptions.add(message.groupId);
					console.log(`User ${client.userId} subscribed to group ${message.groupId}`);
					break;

				case "subscribe_private":
					client.privateChatSubscriptions.add(message.chatId);
					console.log(`User ${client.userId} subscribed to private chat ${message.chatId}`);
					break;

				case "group_message":
					broadcastToGroup(message.groupId, message, ws);
					break;

				case "private_message":
					broadcastToPrivateChat(message.chatId, message, ws);
					break;

				case "game_invite":
					// message should include target: 'group' | 'private' and the corresponding id
					if (message.target === 'group' && typeof message.groupId === 'number') {
						broadcastToGroup(message.groupId, message, ws);
					} else if (message.target === 'private' && typeof message.chatId === 'number') {
						broadcastToPrivateChat(message.chatId, message, ws);
					} else {
						console.warn('game_invite without valid target, broadcasting to all subscribers');
						clients.forEach((client) => {
							if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
								client.ws.send(JSON.stringify({ ...message, type: 'game_invite' }));
							}
						});
					}
					break;

				default:
					console.warn("Unknown message type:", message.type);
			}
		} catch (error) {
			console.error("Invalid message format:", error);
			ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
		}
	});

	ws.on("close", () => {
		clients.delete(ws);
		console.log("Client disconnected. Total clients:", clients.size);
	});

	ws.on("error", (error) => {
		console.error("WebSocket error:", error);
	});
});

function broadcastToGroup(groupId: number, message: any, sender: WebSocket) {
	let broadcastCount = 0;
	clients.forEach((client) => {
		if (client.groupSubscriptions.has(groupId) && client.ws !== sender && client.ws.readyState === WebSocket.OPEN) {
			client.ws.send(JSON.stringify({ ...message, type: "group_message" }));
			broadcastCount++;
		}
	});
	console.log(`Broadcasted to ${broadcastCount} clients in group ${groupId}`);
}

function broadcastToPrivateChat(chatId: number, message: any, sender: WebSocket) {
	let broadcastCount = 0;
	clients.forEach((client) => {
		if (client.privateChatSubscriptions.has(chatId) && client.ws !== sender && client.ws.readyState === WebSocket.OPEN) {
			client.ws.send(JSON.stringify({ ...message, type: "private_message" }));
			broadcastCount++;
		}
	});
	console.log(`Broadcasted to ${broadcastCount} clients in private chat ${chatId}`);
}
