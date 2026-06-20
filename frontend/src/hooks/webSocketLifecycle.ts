export type TimerHandle = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | number;
export type ClearTimeoutFn = (timer: TimerHandle) => void;
export type ClearIntervalFn = (timer: TimerHandle) => void;

export interface WebSocketLifecycleState {
  mounted: boolean;
  connectionId: number;
  intentionalDisconnect: boolean;
  reconnectTimer: TimerHandle | null;
  pingTimer: TimerHandle | null;
  pongTimer: TimerHandle | null;
}

export function createWebSocketLifecycleState(): WebSocketLifecycleState {
  return {
    mounted: false,
    connectionId: 0,
    intentionalDisconnect: false,
    reconnectTimer: null,
    pingTimer: null,
    pongTimer: null,
  };
}

export function markMounted(lifecycle: WebSocketLifecycleState): void {
  lifecycle.mounted = true;
  lifecycle.intentionalDisconnect = false;
}

export function markUnmounted(
  lifecycle: WebSocketLifecycleState,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout,
  clearIntervalFn: ClearIntervalFn = clearInterval
): void {
  lifecycle.mounted = false;
  lifecycle.intentionalDisconnect = true;
  lifecycle.connectionId += 1;
  clearReconnectTimer(lifecycle, clearTimeoutFn);
  clearPingTimers(lifecycle, clearIntervalFn, clearTimeoutFn);
}

export function beginSocketConnection(lifecycle: WebSocketLifecycleState): number {
  lifecycle.intentionalDisconnect = false;
  lifecycle.connectionId += 1;
  return lifecycle.connectionId;
}

export function markIntentionalDisconnect(
  lifecycle: WebSocketLifecycleState,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout,
  clearIntervalFn: ClearIntervalFn = clearInterval
): void {
  lifecycle.intentionalDisconnect = true;
  lifecycle.connectionId += 1;
  clearReconnectTimer(lifecycle, clearTimeoutFn);
  clearPingTimers(lifecycle, clearIntervalFn, clearTimeoutFn);
}

export function isCurrentSocket(
  lifecycle: WebSocketLifecycleState,
  connectionId: number
): boolean {
  return lifecycle.mounted && lifecycle.connectionId === connectionId;
}

export function shouldScheduleReconnect(
  lifecycle: WebSocketLifecycleState,
  connectionId: number,
  reconnectEnabled: boolean,
  reconnectAttempt: number,
  maxReconnectAttempts: number
): boolean {
  return (
    isCurrentSocket(lifecycle, connectionId) &&
    !lifecycle.intentionalDisconnect &&
    reconnectEnabled &&
    reconnectAttempt < maxReconnectAttempts
  );
}

export function setReconnectTimer(
  lifecycle: WebSocketLifecycleState,
  timer: TimerHandle,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout
): void {
  clearReconnectTimer(lifecycle, clearTimeoutFn);
  lifecycle.reconnectTimer = timer;
}

export function clearReconnectTimer(
  lifecycle: WebSocketLifecycleState,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout
): boolean {
  if (lifecycle.reconnectTimer === null) {
    return false;
  }
  clearTimeoutFn(lifecycle.reconnectTimer);
  lifecycle.reconnectTimer = null;
  return true;
}

export function setPingTimer(
  lifecycle: WebSocketLifecycleState,
  timer: TimerHandle,
  clearIntervalFn: ClearIntervalFn = clearInterval,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout
): void {
  clearPingTimers(lifecycle, clearIntervalFn, clearTimeoutFn);
  lifecycle.pingTimer = timer;
}

export function setPongTimer(
  lifecycle: WebSocketLifecycleState,
  timer: TimerHandle,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout
): void {
  clearPongTimer(lifecycle, clearTimeoutFn);
  lifecycle.pongTimer = timer;
}

export function clearPingTimers(
  lifecycle: WebSocketLifecycleState,
  clearIntervalFn: ClearIntervalFn = clearInterval,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout
): boolean {
  const clearedPing = lifecycle.pingTimer !== null;
  if (lifecycle.pingTimer !== null) {
    clearIntervalFn(lifecycle.pingTimer);
    lifecycle.pingTimer = null;
  }
  const clearedPong = clearPongTimer(lifecycle, clearTimeoutFn);
  return clearedPing || clearedPong;
}

export function clearPongTimer(
  lifecycle: WebSocketLifecycleState,
  clearTimeoutFn: ClearTimeoutFn = clearTimeout
): boolean {
  if (lifecycle.pongTimer === null) {
    return false;
  }
  clearTimeoutFn(lifecycle.pongTimer);
  lifecycle.pongTimer = null;
  return true;
}
