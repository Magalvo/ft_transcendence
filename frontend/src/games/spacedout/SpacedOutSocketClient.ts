import type { SpacedOutSocketPayload } from "./types";

type SocketEventMap = {
  open: Event;
  close: CloseEvent;
  error: Event;
  message: MessageEvent<string | ArrayBuffer>;
  binary: ArrayBuffer;
  json: SpacedOutSocketPayload;
};

type SocketEventName = keyof SocketEventMap;
type SocketListener<T extends SocketEventName> = (payload: SocketEventMap[T]) => void;

function buildSocketUrl(baseUrl: string, token?: string): string {
  const url = new URL(baseUrl, window.location.origin);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

export class SpacedOutSocketClient {
  private readonly url: string;
  private socket: WebSocket | null = null;
  private readonly handleOpen = (event: Event): void => {
    this.emit("open", event);
  };
  private readonly handleClose = (event: CloseEvent): void => {
    this.emit("close", event);
  };
  private readonly handleError = (event: Event): void => {
    this.emit("error", event);
  };
  private readonly handleMessage = (
    event: MessageEvent<string | ArrayBuffer>,
  ): void => {
    this.emit("message", event);

    if (event.data instanceof ArrayBuffer) {
      this.emit("binary", event.data);
      return;
    }

    if (typeof event.data !== "string") {
      return;
    }

    try {
      const payload = JSON.parse(event.data) as SpacedOutSocketPayload;
      this.emit("json", payload);
    } catch {
      // Ignore non-JSON strings from the game server.
    }
  };
  private listeners: { [K in SocketEventName]: Set<SocketListener<K>> } = {
    open: new Set<SocketListener<"open">>(),
    close: new Set<SocketListener<"close">>(),
    error: new Set<SocketListener<"error">>(),
    message: new Set<SocketListener<"message">>(),
    binary: new Set<SocketListener<"binary">>(),
    json: new Set<SocketListener<"json">>(),
  };

  constructor(baseUrl: string, token?: string) {
    this.url = buildSocketUrl(baseUrl, token);
  }

  public connect(): void {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return;
    }

    this.socket = new WebSocket(this.url);
    this.socket.binaryType = "arraybuffer";

    this.socket.addEventListener("open", this.handleOpen);
    this.socket.addEventListener("close", this.handleClose);
    this.socket.addEventListener("error", this.handleError);
    this.socket.addEventListener("message", this.handleMessage);
  }

  public sendJson(payload: SpacedOutSocketPayload): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(payload));
  }

  public sendBinary(payload: ArrayBuffer): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(payload);
  }

  public on<T extends SocketEventName>(eventName: T, listener: SocketListener<T>): () => void {
    const listeners = this.listeners[eventName] as Set<SocketListener<T>>;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  public disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.removeEventListener("open", this.handleOpen);
    this.socket.removeEventListener("close", this.handleClose);
    this.socket.removeEventListener("error", this.handleError);
    this.socket.removeEventListener("message", this.handleMessage);
    this.socket.close();
    this.socket = null;
  }

  private emit<T extends SocketEventName>(eventName: T, payload: SocketEventMap[T]): void {
    const listeners = this.listeners[eventName] as Set<SocketListener<T>>;
    listeners.forEach((listener) => listener(payload));
  }
}
