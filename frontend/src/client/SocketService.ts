import { io, type Socket } from 'socket.io-client';
import { WS_URL } from '../services/RuntimeConfig';
import { TokenManager } from '../services/TokenManager';

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

  public init(url = WS_URL, userId?: string): Socket {
    const cachedUserId = TokenManager.getUser()?.id as string | undefined;
    const effectiveUserId = userId || this.currentUserId || cachedUserId;
    const token = TokenManager.getAccessToken() || undefined;

    if (!this.socket) {
      const socketOptions: any = {
        auth: {
          ...(effectiveUserId ? { userId: effectiveUserId } : {}),
          ...(token ? { token } : {}),
        },
      };
      if (!effectiveUserId && !token) {
        delete socketOptions.auth;
      }
      this.socket = io(url, socketOptions);
    } else if (this.socket.auth) {
      this.socket.auth = {
        ...(this.socket.auth as object),
        ...(effectiveUserId ? { userId: effectiveUserId } : {}),
        ...(token ? { token } : {}),
      };
    }

    if (effectiveUserId && effectiveUserId !== this.currentUserId) {
      this.bindUserAuth(effectiveUserId);
    } else if (effectiveUserId && this.socket?.connected) {
      this.socket.emit('userAuth', { userId: effectiveUserId });
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
