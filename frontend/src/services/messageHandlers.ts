/**
 * WebSocket message handlers
 * Processes incoming WebSocket messages and updates application state
 */

import type { Ref } from 'vue';
import type {
  WebSocketMessage,
  User
} from '../types/websocket.types';

export function createMessageHandlers(state: {
  userId: Ref<string>;
  xml: Ref<string>;
  users: Ref<User[]>;
  locks: Ref<Record<string, string>>;
  lockDenied: Ref<string | null>;
}) {
  const handleInit = (msg: WebSocketMessage) => {
    state.userId.value = msg.user_id || '';
    state.xml.value = msg.xml || '';
    state.users.value = msg.users || [];
    state.locks.value = msg.locks || {};
  };

  const handleXmlUpdate = (msg: WebSocketMessage) => {
    if (msg.by !== state.userId.value) {
      state.xml.value = msg.xml || '';
    }
  };

  const handleUserJoin = (msg: WebSocketMessage) => {
    if (msg.user?.id) {
      // Add the new user if they are not already in the list
      if (!state.users.value.find((u) => u.id === msg.user!.id)) {
        state.users.value = [...state.users.value, msg.user];
      }
    }
  };

  const handleUserLeave = (msg: WebSocketMessage) => {
    state.users.value = state.users.value.filter(
      (u) => u.id !== msg.user_id
    );
  };

  const handleLockAcquired = (msg: WebSocketMessage) => {
    if (msg.element_id) {
      // Set single lock entry by replacing the locks object
      // to ensure reactivity (avoid in-place mutation)
      state.locks.value = {
        ...(state.locks.value || {}),
        [msg.element_id]: msg.user_id || ''
      };
    }
  };

  const handleLockDenied = (msg: WebSocketMessage) => {
    // Expose denied element id for UI feedback
    state.lockDenied.value = msg.element_id || null;
  };

  const handleLockReleased = (msg: WebSocketMessage) => {
    if (msg.element_id) {
      // Remove entry by creating a new object without the element key
      const { [msg.element_id]: _, ...rest } = state.locks.value || {};
      state.locks.value = rest;
    }
  };

  const handleLockReleaseFailed = (msg: WebSocketMessage) => {
    // Currently no special handling needed
    console.warn('Lock release failed:', msg);
  };

  const handleLocksUpdate = (msg: WebSocketMessage) => {
    // Backend broadcasts the full locks map
    if (msg.locks && typeof msg.locks === 'object') {
      state.locks.value = msg.locks;
    }
  };

  const handleMessage = (msg: WebSocketMessage) => {
    switch (msg.type) {
    case 'init':
      handleInit(msg);
      break;
    case 'xml_update':
      handleXmlUpdate(msg);
      break;
    case 'user_join':
      handleUserJoin(msg);
      break;
    case 'user_leave':
      handleUserLeave(msg);
      break;
    case 'lock_acquired':
      handleLockAcquired(msg);
      break;
    case 'lock_denied':
      handleLockDenied(msg);
      break;
    case 'lock_released':
      handleLockReleased(msg);
      break;
    case 'lock_release_failed':
      handleLockReleaseFailed(msg);
      break;
    case 'locks_update':
      handleLocksUpdate(msg);
      break;
    default:
      console.warn('Unknown message type:', msg.type);
    }
  };

  return {
    handleMessage
  };
}
