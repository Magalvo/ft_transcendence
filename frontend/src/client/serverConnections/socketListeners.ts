import { Socket } from "socket.io-client";
import {
    HandleEvents,
} from "../index"

/**
 * Setup socket listeners for game events
 * Note: These listeners MUST be removed in GameScene.dispose() to prevent memory leaks
 * Listeners added:
 * - connect, init, gamePaused, gameResumed, gameMessage, countdown, endGame, matchRecorded, gameState
 */
export function setupSocketListeners(socket: Socket, handleEvents: HandleEvents) {
    socket.on("connect", () => console.log("CLIENT: Connected to server!"));

    socket.on("init", (data) => handleEvents.initializeGame(data));

    socket.on("gamePaused", () => handleEvents.gamePaused());
    socket.on("gameResumed", () => handleEvents.gameResumed());
    socket.on("gameMessage", (data: any) => handleEvents.socketMessage(data));
    socket.on("countdown", (data: { count: number }) => handleEvents.onCountdown(data.count));
    socket.on("endGame", (data: { count: number }) => handleEvents.onEndGame(data.count));

    
    socket.on("matchRecorded", (data: { gameId: string; winner: string }) => {
        console.log("✅ Match recorded:", data);
       
        window.dispatchEvent(new CustomEvent('match-stats-updated', { 
            detail: { gameId: data.gameId, winner: data.winner }
        }));
    });

    
    socket.on("matchRecordError", (data: { message: string }) => {
        console.warn("⚠️ Match recording error:", data.message);
    
        window.dispatchEvent(new CustomEvent('match-recording-error', {
            detail: { message: data.message }
        }));
    });

    
    socket.on("gameState", (serverState: any) => handleEvents.gameState(serverState));
}
