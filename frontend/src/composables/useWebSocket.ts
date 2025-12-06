import { ref, computed, onMounted, onUnmounted } from 'vue';
import type {
  User,
  WebSocketMessage,
  WebSocketOutgoingMessage
} from '../types/websocket.types';
import { createMessageHandlers } from '../services/messageHandlers';

export function useWebSocket() {
  const ws = ref<WebSocket | null>(null);
  const userId = ref<string>('');
  const xml = ref<string>('');
  const users = ref<User[]>([]);
  const locks = ref<Record<string, string>>({});
  const lockDenied = ref<string | null>(null);
  const isConnected = ref(false);
  const error = ref<string>('');

  // Create message handlers with state references
  const { handleMessage } = createMessageHandlers({
    userId,
    xml,
    users,
    locks,
    lockDenied
  });

  const connect = () => {
    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
      ws.value = new WebSocket(wsUrl);

      ws.value.onopen = () => {
        isConnected.value = true;
        error.value = '';
      };

      ws.value.onmessage = (event) => {
        const msg: WebSocketMessage = JSON.parse(event.data);
        handleMessage(msg);
      };

      ws.value.onerror = () => {
        error.value = 'WebSocket error';
        isConnected.value = false;
      };

      ws.value.onclose = () => {
        isConnected.value = false;
      };
    } catch (e) {
      error.value = 'Failed to connect';
      console.error(e);
    }
  };

  const sendMessage = (msg: WebSocketOutgoingMessage) => {
    try {
      if (ws.value && isConnected.value) {
        ws.value.send(JSON.stringify(msg));
      } else {
        console.warn('WS not connected, dropping message:', msg);
      }
    } catch (e) {
      console.error('Failed to send WS message', e, msg);
    }
  };

  const updateXml = (newXml: string) => {
    sendMessage({
      type: 'update_xml',
      xml: newXml,
      by: userId.value
    });
  };

  const acquireLock = (elementId: string) => {
    // Do not allow locking the canvas element
    if (!elementId || elementId === 'canvas') return;
    sendMessage({
      type: 'acquire_lock',
      element_id: elementId,
      user_id: userId.value
    });
  };

  const releaseLock = (elementId: string) => {
    // Ignore attempts to release the canvas lock (canvas is never lockable)
    if (!elementId || elementId === 'canvas') return;
    sendMessage({
      type: 'release_lock',
      element_id: elementId,
      user_id: userId.value
    });
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    if (ws.value) {
      ws.value.close();
    }
  });

  return {
    userId: computed(() => userId.value),
    xml: computed(() => xml.value),
    users: computed(() => users.value),
    locks: computed(() => locks.value),
    isConnected: computed(() => isConnected.value),
    error: computed(() => error.value),
    updateXml,
    acquireLock,
    releaseLock,
    ws,
    // expose last denied lock id for UI components
    lockDenied: computed(() => lockDenied.value)
  };
}
