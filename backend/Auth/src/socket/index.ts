import { Server } from "socket.io";
import { Lobby } from "../game/Lobby.js"; 

export function setupSocketIO(httpServer: any) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const lobby = new Lobby(io);

  console.log("🎮 Lobby Socket.IO started");

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    lobby.addClient(socket.id);

    socket.on("lobby_setMode", (mode) =>
      lobby.setGameMode(socket.id, mode)
    );

    socket.on("lobby_setDuration", (duration) =>
      lobby.setGameDuration(socket.id, duration)
    );

    socket.on("lobby_setPowerUps", (enabled) =>
      lobby.setPowerUps(socket.id, enabled)
    );

    socket.on("lobby_movePlayer", (data) =>
      lobby.movePlayerToSlot(
        socket.id,
        data.targetId,
        data.side,
        data.slotIndex
      )
    );

    socket.on("lobby_addBot", (data) =>
      lobby.addBot(socket.id, data.side, data.slotIndex)
    );

    socket.on('lobby_moveToBench', (targetId: string) => {
        lobby.movePlayerToBench(socket.id, targetId);
    });

    socket.on("lobby_removeBot", (data) =>
      lobby.removeBot(socket.id, data.side, data.slotIndex)
    );

    socket.on("lobby_botLevel", (data) =>
      lobby.changeBotLevel(
        socket.id,
        data.side,
        data.slotIndex,
        data.delta
      )
    );

    socket.on("lobby_start", () =>
      lobby.startGame(socket.id)
    );

    socket.on("disconnect", () => {
      lobby.removeClient(socket.id);
      console.log("User disconnected:", socket.id);
    });
  });
}
