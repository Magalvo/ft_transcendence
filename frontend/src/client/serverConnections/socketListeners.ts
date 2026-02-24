import { Socket } from "socket.io-client";
import {
    HandleEvents,
} from "../index"

export function setupSocketListeners(socket: Socket, handleEvents: HandleEvents) {
    socket.on("connect", () => console.log("CLIENT: Connected to server!"));

    socket.on("init", (data) => handleEvents.initializeGame(data));

    socket.on("gamePaused", () => handleEvents.gamePaused());
    socket.on("gameResumed", () => handleEvents.gameResumed());
    socket.on("gameMessage", (data: any) => handleEvents.socketMessage(data));
    socket.on("countdown", (data: { count: number }) => handleEvents.onCountdown(data.count));
    socket.on("endGame", (data: { count: number }) => handleEvents.onEndGame(data.count));

    // Main Game State Update (60 FPS)
    socket.on("gameState", (serverState: any) => handleEvents.gameState(serverState));
}
