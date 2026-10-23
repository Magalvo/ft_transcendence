import { io, type Socket } from 'socket.io-client';
import { WS_URL } from '../services/RuntimeConfig';
import { TokenManager } from '../services/TokenManager';

class SocketService {
  private socket: Socket | null = null;
  private readonly handleForceLogout = (): void => {
    this.disconnect();
    TokenManager.clearTokens();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  private readonly handleAuthRejected = (): void => {
    this.handleForceLogout();
  };

  private readonly handleAuthStateChanged = (): void => {
    this.syncSocketAuth(true);
  };

  private readonly handleStorageChange = (event: StorageEvent): void => {
    if (!TokenManager.isAuthStorageKey(event.key)) {
      return;
    }

    const hasToken = Boolean(TokenManager.getAccessToken());
    this.syncSocketAuth(hasToken);

    if (!hasToken && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(
        TokenManager.getAuthStateChangedEventName(),
        this.handleAuthStateChanged as EventListener,
      );
      window.addEventListener('storage', this.handleStorageChange);
    }
  }

  public init(url = WS_URL, userId?: string): Socket {
    void userId;
    const token = TokenManager.getAccessToken() || undefined;

    if (!this.socket) {
      const socketOptions: any = {
        auth: {
          ...(token ? { token } : {}),
        },
      };
      if (!token) {
        delete socketOptions.auth;
      }
      this.socket = io(url, socketOptions);
    } else {
      this.socket.auth = token ? { token } : {};
    }

    this.attachLifecycleListeners(this.socket);

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.off('forceLogout', this.handleForceLogout);
      this.socket.off('authRejected', this.handleAuthRejected);
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private attachLifecycleListeners(socket: Socket): void {
    socket.off('forceLogout', this.handleForceLogout);
    socket.on('forceLogout', this.handleForceLogout);
    socket.off('authRejected', this.handleAuthRejected);
    socket.on('authRejected', this.handleAuthRejected);
  }

  private syncSocketAuth(reconnectIfNeeded: boolean): void {
    if (!this.socket) {
      return;
    }

    const token = TokenManager.getAccessToken() || undefined;

    if (!token) {
      this.disconnect();
      return;
    }

    this.socket.auth = { token };

    if (!this.socket.connected && reconnectIfNeeded) {
      this.socket.connect();
    }
  }
}

export const socketService = new SocketService();
