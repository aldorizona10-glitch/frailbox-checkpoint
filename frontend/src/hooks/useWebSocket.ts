// @ts-nocheck - TODO: Fix types for v2. See V2-619.
/**
 * Hook for managing WebSocket connections with automatic reconnection,
 * heartbeat, queue management, and multiplexed subscriptions.
 *
 * This hook wraps the native WebSocket API with:
 * - Exponential backoff reconnection with jitter
 * - Configurable heartbeat (ping/pong)
 * - Message queue for offline messages
 * - Subscription management for multiplexed channels
 * - Connection state tracking
 * - Automatic cleanup on unmount
 *
 * The reconnection strategy uses truncated exponential backoff:
 *   delay = min(base_delay * 2^attempt, max_delay) + random(0, jitter_ms)
 *
 * TODO: Add support for WebSocket compression (permessage-deflate).
 * The extension is supported by the server but not requested by the client.
 * Enabling it would reduce bandwidth for verbose message types by ~60%.
 * The extension negotiation was implemented but then removed because it
 * caused compatibility issues with an older load balancer version.
 * The load balancer was upgraded in Q1 2024, so compression can now be
 * re-enabled. The configuration flag was added but never flipped.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  beginSocketConnection,
  clearPingTimers,
  clearPongTimer as clearLifecyclePongTimer,
  clearReconnectTimer,
  createWebSocketLifecycleState,
  isCurrentSocket,
  markIntentionalDisconnect,
  markMounted,
  markUnmounted,
  setPingTimer,
  setPongTimer,
  setReconnectTimer,
  shouldScheduleReconnect,
} from './webSocketLifecycle';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface WSMessage {
  type: string;
  channel?: string;
  payload: unknown;
  id?: string;
  timestamp?: number;
}

export interface WSSubscription {
  channel: string;
  filter?: Record<string, unknown>;
  callback: (data: unknown) => void;
}

export type WSConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface WSOptions {
  url: string;
  protocols?: string | string[];
  autoConnect?: boolean;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  reconnectJitter?: number;
  pingInterval?: number;
  pongTimeout?: number;
  messageQueueSize?: number;
  debug?: boolean;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WSMessage) => void;
}

export interface WSState {
  connectionState: WSConnectionState;
  lastMessage: WSMessage | null;
  reconnectAttempt: number;
  queueSize: number;
  subscriptions: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  errors: number;
  latencyMs: number | null;
}

interface QueuedMessage {
  message: WSMessage;
  timestamp: number;
  retries: number;
}

const DEFAULT_OPTIONS: Required<Omit<WSOptions, 'url' | 'protocols' | 'onOpen' | 'onClose' | 'onError' | 'onMessage'>> = {
  autoConnect: true,
  reconnect: true,
  maxReconnectAttempts: 10,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  reconnectJitter: 1000,
  pingInterval: 30000,
  pongTimeout: 10000,
  messageQueueSize: 100,
  debug: false,
};

export function useWebSocket(options: WSOptions) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lifecycleRef = useRef(createWebSocketLifecycleState());
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const subscriptionsRef = useRef<Map<string, WSSubscription>>(new Map());
  const reconnectAttemptRef = useRef(0);
  const messageIdRef = useRef(0);
  const pingStartRef = useRef(0);

  const [state, setState] = useState<WSState>({
    connectionState: 'disconnected',
    lastMessage: null,
    reconnectAttempt: 0,
    queueSize: 0,
    subscriptions: 0,
    totalMessagesSent: 0,
    totalMessagesReceived: 0,
    errors: 0,
    latencyMs: null,
  });

  const updateState = useCallback((partial: Partial<WSState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const isLiveSocket = useCallback((connectionId: number, ws: WebSocket, eventName: string) => {
    const live = isCurrentSocket(lifecycleRef.current, connectionId) && wsRef.current === ws;
    if (!live && mergedOptions.debug) {
      console.warn(`[WS] Ignored ${eventName} from a stale socket after cleanup`);
    }
    return live;
  }, [mergedOptions.debug]);

  const sendMessage = useCallback((message: WSMessage) => {
    const ws = wsRef.current;
    const msgStr = JSON.stringify(message);

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(msgStr);
      updateState({ totalMessagesSent: state.totalMessagesSent + 1 });
    } else {
      // Queue message for later delivery
      if (messageQueueRef.current.length < mergedOptions.messageQueueSize) {
        messageQueueRef.current.push({
          message,
          timestamp: Date.now(),
          retries: 0,
        });
        updateState({ queueSize: messageQueueRef.current.length });
      } else if (mergedOptions.debug) {
        console.warn('[WS] Message queue full, dropping message:', message.type);
      }
    }
  }, [mergedOptions, updateState, state.totalMessagesSent]);

  const subscribe = useCallback((subscription: WSSubscription) => {
    subscriptionsRef.current.set(subscription.channel, subscription);
    updateState({ subscriptions: subscriptionsRef.current.size });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'subscribe',
        channel: subscription.channel,
        payload: subscription.filter || {},
      });
    }
  }, [sendMessage, updateState]);

  const unsubscribe = useCallback((channel: string) => {
    subscriptionsRef.current.delete(channel);
    updateState({ subscriptions: subscriptionsRef.current.size });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'unsubscribe',
        channel,
        payload: null,
      });
    }
  }, [sendMessage, updateState]);

  const connect = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle.mounted) {
      if (mergedOptions.debug) {
        console.warn('[WS] Ignoring connect after component unmount');
      }
      return;
    }

    clearReconnectTimer(lifecycle);
    reconnectTimerRef.current = null;

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    updateState({ connectionState: 'connecting', reconnectAttempt: reconnectAttemptRef.current });

    try {
      const connectionId = beginSocketConnection(lifecycle);
      const ws = new WebSocket(mergedOptions.url, mergedOptions.protocols);
      wsRef.current = ws;

      ws.onopen = (event) => {
        if (!isLiveSocket(connectionId, ws, 'open')) return;
        reconnectAttemptRef.current = 0;
        updateState({ connectionState: 'connected', reconnectAttempt: 0 });

        // Resubscribe to all channels
        subscriptionsRef.current.forEach((sub, channel) => {
          sendMessage({
            type: 'subscribe',
            channel,
            payload: sub.filter || {},
          });
        });

        // Flush queued messages
        while (messageQueueRef.current.length > 0) {
          const queued = messageQueueRef.current.shift()!;
          sendMessage(queued.message);
        }
        updateState({ queueSize: 0 });

        // Start ping interval
        startPing();

        mergedOptions.onOpen?.(event);
      };

      ws.onmessage = (event) => {
        if (!isLiveSocket(connectionId, ws, 'message')) return;

        try {
          const message: WSMessage = JSON.parse(event.data);

          // Handle pong response
          if (message.type === 'pong') {
            const latency = Date.now() - pingStartRef.current;
            updateState({ latencyMs: latency });
            clearPongTimeout();
            return;
          }

          updateState({
            lastMessage: message,
            totalMessagesReceived: state.totalMessagesReceived + 1,
          });

          // Route to channel subscribers
          if (message.channel) {
            const sub = subscriptionsRef.current.get(message.channel);
            if (sub) {
              try {
                sub.callback(message.payload);
              } catch (err) {
                if (mergedOptions.debug) {
                  console.error(`[WS] Subscriber error for channel ${message.channel}:`, err);
                }
              }
            }
          }

          // Route to global message handler
          mergedOptions.onMessage?.(message);
        } catch (err) {
          if (mergedOptions.debug) {
            console.error('[WS] Failed to parse message:', err);
          }
        }
      };

      ws.onclose = (event) => {
        if (!isLiveSocket(connectionId, ws, 'close')) return;
        wsRef.current = null;
        stopPing();
        updateState({ connectionState: 'disconnected' });
        mergedOptions.onClose?.(event);
        scheduleReconnect(connectionId);
      };

      ws.onerror = (event) => {
        if (!isLiveSocket(connectionId, ws, 'error')) return;
        updateState(prev => ({ ...prev, errors: prev.errors + 1, connectionState: 'error' }));
        mergedOptions.onError?.(event);
      };
    } catch (err) {
      if (!lifecycle.mounted) return;
      updateState(prev => ({ ...prev, errors: prev.errors + 1, connectionState: 'error' }));
      if (mergedOptions.debug) {
        console.error('[WS] Connection error:', err);
      }
      scheduleReconnect(lifecycle.connectionId);
    }
  }, [mergedOptions, sendMessage, updateState, state.totalMessagesReceived]);

  const disconnect = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    markIntentionalDisconnect(lifecycle);
    reconnectTimerRef.current = null;

    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      wsRef.current = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Client disconnect');
      }
    }
    stopPing();
    reconnectAttemptRef.current = 0;
    if (lifecycle.mounted) {
      updateState({ connectionState: 'disconnected', reconnectAttempt: 0 });
    }
  }, [updateState]);

  const scheduleReconnect = useCallback((connectionId = lifecycleRef.current.connectionId) => {
    const lifecycle = lifecycleRef.current;
    if (!shouldScheduleReconnect(
      lifecycle,
      connectionId,
      mergedOptions.reconnect,
      reconnectAttemptRef.current,
      mergedOptions.maxReconnectAttempts
    )) {
      if (lifecycle.mounted && !lifecycle.intentionalDisconnect) {
        updateState({ connectionState: 'error' });
      }
      return;
    }

    const delay = Math.min(
      mergedOptions.reconnectBaseDelay * Math.pow(2, reconnectAttemptRef.current),
      mergedOptions.reconnectMaxDelay
    ) + Math.random() * mergedOptions.reconnectJitter;

    reconnectAttemptRef.current++;

    if (mergedOptions.debug) {
      console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptRef.current})`);
    }

    updateState({ connectionState: 'reconnecting', reconnectAttempt: reconnectAttemptRef.current });

    const timer = setTimeout(() => {
      reconnectTimerRef.current = null;
      lifecycle.reconnectTimer = null;
      if (isCurrentSocket(lifecycle, connectionId)) connect();
    }, delay);
    reconnectTimerRef.current = timer;
    setReconnectTimer(lifecycle, timer);
  }, [mergedOptions, connect, updateState]);

  const startPing = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    stopPing();
    const pingTimer = setInterval(() => {
      const ws = wsRef.current;
      if (lifecycle.mounted && ws?.readyState === WebSocket.OPEN) {
        pingStartRef.current = Date.now();
        ws.send(JSON.stringify({ type: 'ping' }));

        // Set pong timeout
        const pongTimer = setTimeout(() => {
          if (mergedOptions.debug) {
            console.warn('[WS] Pong timeout, closing connection');
          }
          updateState({ latencyMs: null });
          wsRef.current?.close(4000, 'Pong timeout');
        }, mergedOptions.pongTimeout);
        pongTimerRef.current = pongTimer;
        setPongTimer(lifecycle, pongTimer);
      }
    }, mergedOptions.pingInterval);
    pingTimerRef.current = pingTimer;
    setPingTimer(lifecycle, pingTimer);
  }, [mergedOptions, updateState]);

  const stopPing = useCallback(() => {
    clearPingTimers(lifecycleRef.current);
    pingTimerRef.current = null;
    pongTimerRef.current = null;
  }, []);

  const clearPongTimeout = useCallback(() => {
    clearLifecyclePongTimer(lifecycleRef.current);
    pongTimerRef.current = null;
  }, []);

  const send = useCallback((type: string, payload: unknown, channel?: string) => {
    const id = `msg_${++messageIdRef.current}`;
    sendMessage({
      id,
      type,
      channel,
      payload,
      timestamp: Date.now(),
    });
    return id;
  }, [sendMessage]);

  useEffect(() => {
    markMounted(lifecycleRef.current);
    if (mergedOptions.autoConnect) {
      connect();
    }
    return () => {
      const lifecycle = lifecycleRef.current;
      markUnmounted(lifecycle);
      reconnectTimerRef.current = null;
      pingTimerRef.current = null;
      pongTimerRef.current = null;

      if (wsRef.current) {
        const ws = wsRef.current;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        wsRef.current = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, 'Component unmount');
        }
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
