
import { createLogger } from '../utils/logger';

export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface RpcEvent {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
}

export const RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TIMEOUT: -32000,
  NOT_CONNECTED: -32001,
} as const;

export interface PluginInfo {
  id: string;
  name: string;
  path: string;
  format: 'vst3' | 'au';
  manufacturer?: string;
  version?: string;
  category?: string;
}

export interface PluginState {
  id: string;
  loaded: boolean;
  editorOpen: boolean;
  parameterCount: number;
  latencySamples: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  method: string;
}

export class NativeBridge {
  private nextId = 1;
  private pending: Map<number, PendingRequest> = new Map();
  private eventHandlers: Map<string, Set<(params: Record<string, unknown>) => void>> = new Map();
  private connected = false;
  private mockMode = false;
  private timeoutMs = 5000;
  private log = createLogger('native/bridge');
  private listenersBound = false;
  private windowMessageHandler?: (event: MessageEvent) => void;
  private webviewMessageHandler?: (event: any) => void;
  private nativeEventHandler?: (event: any) => void;
  private nativeResponseHandler?: (data: any) => void;

  constructor(options?: { timeoutMs?: number; mockMode?: boolean }) {
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.mockMode = options?.mockMode ?? false;
    this.setupMessageListener();
    this.detectBridge();
  }

  private detectBridge(): void {
    if (typeof window === 'undefined') {
      this.mockMode = true;
      return;
    }
    if ((window as any).webkit?.messageHandlers?.native) {
      this.connected = true;
      return;
    }
    if ((window as any).chrome?.webview) {
      this.connected = true;
      return;
    }
    this.mockMode = true;
    this.log.warn('No native bridge available, using mock mode');
  }

  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;
    if (this.listenersBound) return;
    this.listenersBound = true;

    const isTrustedMessage = (event: MessageEvent) => {
      if (event.source && event.source !== window) return false;
      if (event.origin && event.origin !== window.location.origin && event.origin !== 'null') return false;
      return true;
    };

    // Generic postMessage listener (browser)
    this.windowMessageHandler = (event) => {
      if (!isTrustedMessage(event)) return;
      this.handleMessage(event.data);
    };
    window.addEventListener('message', this.windowMessageHandler);

    // WebView2 listener (native)
    if ((window as any).chrome?.webview) {
      this.webviewMessageHandler = (event: any) => {
        this.handleMessage(event.data);
      };
      (window as any).chrome.webview.addEventListener('message', this.webviewMessageHandler);
    }

    // JUCE WebBrowserComponent (as wired in this project) dispatches a CustomEvent.
    this.nativeEventHandler = (event: any) => {
      this.handleMessage(event?.detail);
    };
    window.addEventListener('native-event' as any, this.nativeEventHandler);

    // Allow native side to call window.__nativeResponse(...) with JSON-RPC objects.
    this.nativeResponseHandler = (data: any) => {
      this.handleMessage(data);
    };
    (window as any).__nativeResponse = this.nativeResponseHandler;
  }

  private handleMessage(data: unknown): void {
    let payload = data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return;
      }
    }
    if (!payload || typeof payload !== 'object') return;
    const msg = payload as Record<string, unknown>;
    if (msg.jsonrpc !== '2.0') return;
    if ('id' in msg && typeof msg.id === 'number') {
      this.handleResponse(msg as unknown as RpcResponse);
      return;
    }
    if ('method' in msg && typeof msg.method === 'string' && msg.method.startsWith('event.')) {
      this.handleEvent(msg as unknown as RpcEvent);
      return;
    }
  }

  private handleResponse(response: RpcResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.id);
    if (response.error) {
      pending.reject(new Error(`RPC Error [${response.error.code}]: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  private handleEvent(event: RpcEvent): void {
    const handlers = this.eventHandlers.get(event.method);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(event.params);
      } catch (e) {
        this.log.error('Event handler error', e);
      }
    }
  }

  private postMessage(msg: unknown): void {
    const json = typeof msg === 'string' ? msg : JSON.stringify(msg);
    if ((window as any).webkit?.messageHandlers?.native) {
      (window as any).webkit.messageHandlers.native.postMessage(json);
      return;
    }
    if ((window as any).chrome?.webview) {
      (window as any).chrome.webview.postMessage(json);
      return;
    }
    if (!this.mockMode) {
      this.log.warn('No native bridge available');
    }
  }

  async call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (this.mockMode) {
      return this.mockCall<T>(method, params);
    }
    if (!this.connected) {
      throw new Error('Native bridge not connected');
    }
    const id = this.nextId++;
    const request: RpcRequest = { jsonrpc: '2.0', id, method, params };
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
        method,
      });
      this.postMessage(request);
    });
  }

  on(event: string, handler: (params: Record<string, unknown>) => void): void {
    const eventName = event.startsWith('event.') ? event : `event.${event}`;
    let handlers = this.eventHandlers.get(eventName);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(eventName, handlers);
    }
    handlers.add(handler);
  }

  off(event: string, handler: (params: Record<string, unknown>) => void): void {
    const eventName = event.startsWith('event.') ? event : `event.${event}`;
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private async mockCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    this.log.debug(`Mock ${method}`, params);
    await new Promise(resolve => setTimeout(resolve, 50));
    switch (method) {
      case 'plugin.scan': return [] as unknown as T;
      case 'plugin.load': return { id: `mock-plugin-${Date.now()}` } as unknown as T;
      case 'plugin.unload': return undefined as unknown as T;
      case 'plugin.setParam': return undefined as unknown as T;
      case 'plugin.openEditor': return undefined as unknown as T;
      case 'plugin.closeEditor': return undefined as unknown as T;
      case 'midi.send': return undefined as unknown as T;
      case 'midi.setTuning': return undefined as unknown as T;
      case 'mts.register': return { clientId: `mock-mts-${Date.now()}` } as unknown as T;
      case 'mts.broadcast': return undefined as unknown as T;
      case 'mts.getClientCount': return 0 as unknown as T;
      default: throw new Error(`Unknown method: ${method}`);
    }
  }

  isConnected(): boolean { return this.connected; }
  isMockMode(): boolean { return this.mockMode; }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Bridge disposed'));
    }
    this.pending.clear();
    this.eventHandlers.clear();
    if (typeof window !== 'undefined') {
      if (this.windowMessageHandler) {
        window.removeEventListener('message', this.windowMessageHandler);
      }
      if (this.nativeEventHandler) {
        window.removeEventListener('native-event' as any, this.nativeEventHandler);
      }
      if (this.webviewMessageHandler && (window as any).chrome?.webview) {
        (window as any).chrome.webview.removeEventListener('message', this.webviewMessageHandler);
      }
      if ((window as any).__nativeResponse === this.nativeResponseHandler) {
        delete (window as any).__nativeResponse;
      }
    }
    this.listenersBound = false;
  }
}

export interface INativeBridge {
  scanPlugins(): Promise<PluginInfo[]>;
  loadPlugin(id: string): Promise<boolean>;
  unloadPlugin(id: string): Promise<void>;
  setPluginParam(id: string, paramIndex: number, value: number): Promise<void>;
  openEditor(id: string): Promise<void>;
  closeEditor(id: string): Promise<void>;
}

class NativeBridgeAdapter implements INativeBridge {
  constructor(private bridge: NativeBridge) {}
  async scanPlugins(): Promise<PluginInfo[]> {
    return this.bridge.call<PluginInfo[]>('plugin.scan');
  }
  async loadPlugin(path: string): Promise<boolean> {
    const result = await this.bridge.call<{ id: string }>('plugin.load', { path });
    return !!result?.id;
  }
  async unloadPlugin(id: string): Promise<void> {
    await this.bridge.call('plugin.unload', { id });
  }
  async setPluginParam(id: string, paramIndex: number, value: number): Promise<void> {
    await this.bridge.call('plugin.setParam', { id, paramIndex, value });
  }
  async openEditor(id: string): Promise<void> {
    await this.bridge.call('plugin.openEditor', { id });
  }
  async closeEditor(id: string): Promise<void> {
    await this.bridge.call('plugin.closeEditor', { id });
  }
}

export const nativeBridgeCore = new NativeBridge();
export const nativeBridge: INativeBridge = new NativeBridgeAdapter(nativeBridgeCore);

export const midiRpc = {
  send: (bytes: number[]) => nativeBridgeCore.call('midi.send', { bytes }),
  setTuning: (tuningTable: number[]) => nativeBridgeCore.call('midi.setTuning', { tuningTable }),
};

export const mtsRpc = {
  register: () => nativeBridgeCore.call<{ clientId: string }>('mts.register'),
  broadcast: (tuningTable: number[]) => nativeBridgeCore.call('mts.broadcast', { tuningTable }),
  getClientCount: () => nativeBridgeCore.call<number>('mts.getClientCount'),
};
