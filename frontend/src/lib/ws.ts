type Handler = (event: string, data: unknown) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private retry = 0;
  private url: string;

  constructor() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.url = `${proto}://${location.host}/ws`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        this.handlers.forEach((h) => h(msg.event, msg.data));
      } catch (e) {
        console.warn('WS parse error', e);
      }
    };
    ws.onclose = () => {
      this.ws = null;
      const delay = Math.min(2000 + this.retry * 1000, 10000);
      this.retry += 1;
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }
}

export const ws = new WSClient();
