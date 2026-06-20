import test from 'node:test';
import assert from 'node:assert/strict';

import {
  beginSocketConnection,
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
  type TimerHandle,
} from './webSocketLifecycle.ts';

test('intentional disconnect clears timers and blocks reconnect for the old socket', () => {
  const lifecycle = createWebSocketLifecycleState();
  const clearedTimeouts: TimerHandle[] = [];
  const clearedIntervals: TimerHandle[] = [];
  const clearTimeoutFn = (timer: TimerHandle) => { clearedTimeouts.push(timer); };
  const clearIntervalFn = (timer: TimerHandle) => { clearedIntervals.push(timer); };

  markMounted(lifecycle);
  const socketId = beginSocketConnection(lifecycle);
  setReconnectTimer(lifecycle, 11, clearTimeoutFn);
  setPingTimer(lifecycle, 22, clearIntervalFn, clearTimeoutFn);
  setPongTimer(lifecycle, 33, clearTimeoutFn);

  markIntentionalDisconnect(lifecycle, clearTimeoutFn, clearIntervalFn);

  assert.equal(lifecycle.intentionalDisconnect, true);
  assert.equal(lifecycle.reconnectTimer, null);
  assert.equal(lifecycle.pingTimer, null);
  assert.equal(lifecycle.pongTimer, null);
  assert.deepEqual(clearedTimeouts, [11, 33]);
  assert.deepEqual(clearedIntervals, [22]);
  assert.equal(isCurrentSocket(lifecycle, socketId), false);
  assert.equal(shouldScheduleReconnect(lifecycle, socketId, true, 0, 10), false);
});

test('setting a reconnect timer replaces the previous timer instead of stacking loops', () => {
  const lifecycle = createWebSocketLifecycleState();
  const clearedTimeouts: TimerHandle[] = [];
  const clearTimeoutFn = (timer: TimerHandle) => { clearedTimeouts.push(timer); };

  markMounted(lifecycle);
  beginSocketConnection(lifecycle);
  setReconnectTimer(lifecycle, 101, clearTimeoutFn);
  setReconnectTimer(lifecycle, 202, clearTimeoutFn);

  assert.deepEqual(clearedTimeouts, [101]);
  assert.equal(lifecycle.reconnectTimer, 202);

  assert.equal(clearReconnectTimer(lifecycle, clearTimeoutFn), true);
  assert.equal(lifecycle.reconnectTimer, null);
  assert.deepEqual(clearedTimeouts, [101, 202]);
});

test('unmount invalidates stale socket events and remount starts a fresh lifecycle', () => {
  const lifecycle = createWebSocketLifecycleState();
  const clearedTimeouts: TimerHandle[] = [];
  const clearTimeoutFn = (timer: TimerHandle) => { clearedTimeouts.push(timer); };

  markMounted(lifecycle);
  const firstSocket = beginSocketConnection(lifecycle);
  setReconnectTimer(lifecycle, 44, clearTimeoutFn);

  markUnmounted(lifecycle, clearTimeoutFn);

  assert.equal(lifecycle.mounted, false);
  assert.equal(isCurrentSocket(lifecycle, firstSocket), false);
  assert.equal(shouldScheduleReconnect(lifecycle, firstSocket, true, 0, 10), false);
  assert.deepEqual(clearedTimeouts, [44]);

  markMounted(lifecycle);
  const secondSocket = beginSocketConnection(lifecycle);

  assert.notEqual(secondSocket, firstSocket);
  assert.equal(isCurrentSocket(lifecycle, secondSocket), true);
  assert.equal(shouldScheduleReconnect(lifecycle, secondSocket, true, 0, 10), true);
});
