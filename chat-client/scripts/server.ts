import WebSocket, {WebSocketServer} from "ws";

const wss = new WebSocketServer({
	port: 5273,
});

console.log("WebSocket server running on ws://localhost:5273");

wss.on("connection", (ws) =>{
	console.log("Client connected. Total clients:", wss.clients.size);

	ws.on("message", (data) => {
		console.log("Received message:", data.toString());
		console.log("Broadcasting to", wss.clients.size - 1, "other clients");

		wss.clients.forEach((client) => {
			if (client !== ws && client.readyState === WebSocket.OPEN) {
				console.log("   Sending to client");
				client.send(data.toString());
			}
		});
	});

	ws.on("close", () => {
		console.log("Client disconnected. Total clients:", wss.clients.size);
	});
});
