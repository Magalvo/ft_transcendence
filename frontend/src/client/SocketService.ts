import { io, type Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private currentUserId: string | null = null;
  private requestUserAuthHandler: (() => void) | null = null;

  private bindUserAuth(userId: string): void {
    this.currentUserId = userId;
    if (!this.socket) return;

    if (this.requestUserAuthHandler) {
      this.socket.off('requestUserAuth', this.requestUserAuthHandler);
    }

    this.requestUserAuthHandler = () => {
      this.socket?.emit('userAuth', { userId });
    };

    this.socket.on('requestUserAuth', this.requestUserAuthHandler);

    if (this.socket.connected) {
      this.socket.emit('userAuth', { userId });
    }
  }

  public init(url = 'http://localhost:3000', userId?: string): Socket {
    if (!this.socket) {
      const socketOptions: any = {};
      if (userId) {
        socketOptions.auth = { userId };
      }
      this.socket = io(url, socketOptions);
    }

    if (userId && userId !== this.currentUserId) {
      this.bindUserAuth(userId);
    }

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      if (this.requestUserAuthHandler) {
        this.socket.off('requestUserAuth', this.requestUserAuthHandler);
        this.requestUserAuthHandler = null;
      }
      this.socket.disconnect();
      this.socket = null;
      this.currentUserId = null;
    }
  }
}

export const socketService = new SocketService();
