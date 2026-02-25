import { io, type Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  public init(url = 'http://localhost:3000'): Socket {
    if (!this.socket) {
      this.socket = io(url);
    }
    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public setSocket(s: Socket | null) {
    this.socket = s;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
