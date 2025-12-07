<template>
  <div class="editor-container">
    <div class="status-bar">
      <div class="status">
        <span :class="{ connected: isConnected, disconnected: !isConnected }">
          {{ isConnected ? "● Connected" : "● Disconnected" }}
        </span>
        <span class="user-id">ID: {{ userId }}</span>
      </div>
      <div class="users-info">
        <strong>Online Users ({{ users.length }}):</strong>
        <span v-if="users.length > 0" class="user-list">
          {{ users.map((u) => u.id).join(", ") }}
        </span>
        <span v-else class="user-list">You are alone</span>
      </div>
    </div>
    <div v-if="lockDeniedToast" class="lock-denied-toast">
      {{ lockDeniedToast }}
    </div>
    <div ref="canvasContainer" class="canvas" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { useWebSocket } from '../composables/useWebSocket';
import { useBpmnLocking } from '../composables/useBpmnLocking';
import { useBpmnOverlays } from '../composables/useBpmnOverlays';
import { useBpmnEvents } from '../composables/useBpmnEvents';
import { useBpmnLoader } from '../composables/useBpmnLoader';

const canvasContainer = ref<HTMLDivElement | null>(null);
const modeler = ref<BpmnModeler | null>(null);
const lockDeniedToast = ref<string | null>(null);
let lockDeniedTimeout: ReturnType<typeof setTimeout> | null = null;

const {
  userId,
  xml,
  users,
  isConnected,
  updateXml,
  acquireLock,
  releaseLock,
  locks,
  lockDenied
} = useWebSocket();

// Toast notification handler
const showLockDeniedToast = (message: string) => {
  lockDeniedToast.value = message;
  if (lockDeniedTimeout) clearTimeout(lockDeniedTimeout);
  lockDeniedTimeout = setTimeout(() => {
    lockDeniedToast.value = null;
  }, 2500);
};

// Initialize composables
const lockingComposable = useBpmnLocking(
  modeler,
  userId,
  locks,
  acquireLock,
  releaseLock,
  showLockDeniedToast
);

const overlaysComposable = useBpmnOverlays(modeler, locks);

const loaderComposable = useBpmnLoader(
  modeler,
  xml,
  overlaysComposable.rerenderOverlays
);

const eventsComposable = useBpmnEvents(
  modeler,
  canvasContainer,
  lockingComposable.tryAcquireLock,
  lockingComposable.releaseCurrentLock
);

onMounted(async () => {
  if (!canvasContainer.value) return;

  // Initialize BPMN modeler
  modeler.value = new BpmnModeler({
    container: canvasContainer.value
  });

  // Load initial diagram
  await loaderComposable.loadInitialDiagram();

  // Setup command stack interception for lock enforcement
  lockingComposable.setupCommandStackInterception();

  // Listen to diagram changes and broadcast updates
  modeler.value.on('commandStack.changed', async () => {
    if (loaderComposable.getIsUpdatingFromServer()) return;

    try {
      const { xml: newXml } = await modeler.value!.saveXML();
      if (newXml) {
        updateXml(newXml);
      }
    } catch (e) {
      console.error('Error saving XML:', e);
    }
  });

  // Setup event handlers for locking
  eventsComposable.setupEventHandlers();

  // Setup overlay synchronization
  overlaysComposable.setupOverlayWatcher();

  // Synchronize currentLock with server state
  watch(locks, lockingComposable.syncCurrentLock, { deep: true });

  // Show lock denied toast when composable reports it
  watch(lockDenied, (val) => {
    if (val) {
      const lockOwner = locks.value[val];
      const ownerName = lockOwner || 'another user';
      showLockDeniedToast(`Element locked by ${ownerName}`);
    }
  });
});

// Setup XML watcher for updates from other users
loaderComposable.setupXmlWatcher();

onUnmounted(() => {
  if (lockDeniedTimeout) clearTimeout(lockDeniedTimeout);

  // Release current lock
  lockingComposable.releaseCurrentLock();

  // Cleanup event handlers
  eventsComposable.cleanupEventHandlers();

  // Cleanup overlays
  overlaysComposable.cleanupOverlays();
});
</script>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fafafa;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #ddd;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.status {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 14px;
}

.connected {
  color: #22c55e;
  font-weight: 500;
}

.disconnected {
  color: #ef4444;
  font-weight: 500;
}

.user-id {
  color: #666;
  font-size: 12px;
  font-family: monospace;
}

.users-info {
  font-size: 13px;
  color: #666;
  text-align: right;
}

.user-list {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #888;
  font-family: monospace;
}

.canvas {
  flex: 1;
  background: #fff;
}

.lock-denied-toast {
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  background: #ef4444;
  color: #fff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  pointer-events: none;
}
</style>

<style>
@import "bpmn-js/dist/assets/diagram-js.css";
@import "bpmn-js/dist/assets/bpmn-js.css";
@import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

.lock-badge {
  display: inline-block;
  padding: 2px 6px;
  background: rgba(239, 68, 68, 0.95);
  color: white;
  font-size: 11px;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
</style>
