<template>
  <div class="editor-container">
    <div class="status-bar">
      <div class="status">
        <span :class="{ connected: isConnected, disconnected: !isConnected }">
          {{ isConnected ? '● Connected' : '● Disconnected' }}
        </span>
        <span class="user-id">ID: {{ userId }}</span>
      </div>
      <div class="users-info">
        <strong>Online Users ({{ users.length }}):</strong>
        <span v-if="users.length > 0" class="user-list">
          {{ users.map(u => u.id).join(', ') }}
        </span>
        <span v-else class="user-list">You are alone</span>
      </div>
    </div>
    <div v-if="lockDeniedToast" class="lock-denied-toast">Element is locked</div>
    <div ref="canvasContainer" class="canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import { useWebSocket } from '../composables/useWebSocket'

interface HTMLDivElementWithHandler extends HTMLDivElement {
  __containerClickHandler?: (ev: MouseEvent) => void
}

interface BpmnElement {
  id: string
  type?: string
  businessObject?: {
    $type?: string
  }
}

interface EventBus {
  on(event: string, callback: (e: { element: BpmnElement }) => void): void
}

interface Overlays {
  add(element: BpmnElement | string, config: { position: { top: number; right: number }; html: HTMLElement }): string
  remove(id: string): void
}

interface ElementRegistry {
  get(id: string): BpmnElement | undefined
}

interface Canvas {
  zoom(mode: string): void
}

const canvasContainer = ref<HTMLDivElement | null>(null)
let modeler: BpmnModeler | null = null
let isUpdatingFromServer = false

const { userId, xml, users, isConnected, updateXml, acquireLock, releaseLock, locks, lockDenied } = useWebSocket()
const overlaysMap = new Map<string, string>()
const currentLock = ref<string | null>(null)
const lockDeniedToast = ref<string | null>(null)
let lockDeniedTimeout: ReturnType<typeof setTimeout> | null = null

// Single source of truth: fetch the default BPMN from the backend.
const minimalFallback = `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">\n  <bpmn:process id="Process_1" isExecutable="false">\n    <bpmn:startEvent id="StartEvent_1" />\n  </bpmn:process>\n</bpmn:definitions>`

async function fetchDefaultBpmn() {
  try {
    const res = await fetch('http://localhost:8000/default-bpmn')
    if (!res.ok) throw new Error('Failed to fetch default BPMN: ' + res.status)
    const text = await res.text()
    return text
  } catch (err) {
    console.warn('Failed to fetch default BPMN from server, using minimal fallback', err)
    return minimalFallback
  }
}

onMounted(async () => {
  await nextTick()

  if (!canvasContainer.value) return

  modeler = new BpmnModeler({
    container: canvasContainer.value,
  })

  // Load initial diagram using authoritative server default when available.
  let safeInitialXml: string
  if (xml.value && /<bpmn:definitions[\s>]/i.test(xml.value)) {
    safeInitialXml = xml.value
  } else {
    safeInitialXml = await fetchDefaultBpmn()
  }

  await loadDiagram(safeInitialXml)

  // Listen to diagram changes
  modeler.on('commandStack.changed', async () => {
    if (isUpdatingFromServer) return

    try {
      const { xml: newXml } = await modeler!.saveXML()
      if (newXml) {
        updateXml(newXml)
      }
    } catch (e) {
      console.error('Error saving XML:', e)
    }
  })

  // Setup event bus for click/select events
  try {
    const eventBus = modeler.get('eventBus') as EventBus
    const overlays = modeler.get('overlays') as Overlays
    const elementRegistry = modeler.get('elementRegistry') as ElementRegistry

    // Helper to determine if an element should be lockable
    function isLockableElement(element: BpmnElement | null | undefined) {
      if (!element || !element.id) return false
      const id = element.id
      // Common non-lockable IDs (canvas / root process)
      if (id === 'canvas' || id === 'Process_1') return false
      // businessObject type check for BPMN process/definitions
      const bo = element.businessObject
      if (bo && (bo.$type === 'bpmn:Process' || bo.$type === 'bpmn:Definitions')) return false
      // element.type can also indicate process
      if (element.type === 'bpmn:Process') return false
      return true
    }

    // Element click -> try to acquire lock
    eventBus.on('element.click', (e: { element: BpmnElement }) => {
      const element = e.element
      if (isLockableElement(element)) {
        // Before acquiring a new lock, release any locks we currently hold
        try {
          const currentUserId = userId.value || null
          const myLocks = Object.entries(locks.value || {}).filter(([, owner]) => owner === currentUserId).map(([id]) => id)
          for (const lid of myLocks) {
            if (lid !== element.id) {
              try {
                releaseLock(lid)
              } catch (e) {
                console.error('error releasing previous lock', lid, e)
              }
            }
          }
        } catch (e) {
          console.error('error while releasing previous locks', e)
        }

        // Request lock from server for the clicked element
        acquireLock(element.id)
        // remember tentative lock (will be confirmed via locks reactive update)
        currentLock.value = element.id
      }
    })

    // Canvas click -> release our lock (if any)
    eventBus.on('canvas.click', () => {
      if (currentLock.value) {
        try {
          releaseLock(currentLock.value)
        } catch (e) {
          console.error('error calling releaseLock:', e)
        }
        currentLock.value = null
      }
    })

    // DOM-level click on the container as a fallback if eventBus canvas.click doesn't fire.
    // This detects clicks on empty space by checking for BPMN element hits.
    const containerClickHandler = (ev: MouseEvent) => {
      try {
        const target = ev.target as HTMLElement | null
        // If user clicked on a BPMN element SVG node (common classes), ignore
        if (target && target.closest && target.closest('.djs-element, .djs-shape, .djs-connection')) {
          return
        }
        if (currentLock.value) {
          releaseLock(currentLock.value)
          currentLock.value = null
        }
      } catch (e) {
        console.error('error in containerClickHandler', e)
      }
    }

    if (canvasContainer.value) {
      // store handler reference so we can remove it on unmount
      const containerWithHandler = canvasContainer.value as HTMLDivElementWithHandler
      containerWithHandler.__containerClickHandler = containerClickHandler
      canvasContainer.value.addEventListener('click', containerClickHandler)
    }

    // Keep overlays in sync when locks change
    watch(locks, (newLocks) => {
      if (!modeler) return

      // remove overlays that are no longer present
      for (const [elemId, overlayId] of Array.from(overlaysMap.entries())) {
        if (!newLocks[elemId]) {
          try {
            overlays.remove(overlayId)
          } catch (err) {
            // ignore
          }
          overlaysMap.delete(elemId)
        }
      }

      // add/update overlays for current locks
      for (const [elemId, ownerId] of Object.entries(newLocks || {})) {
        if (!overlaysMap.has(elemId)) {
          // create badge element
          const badge = document.createElement('div')
          badge.className = 'lock-badge'
          badge.textContent = getInitials(ownerId)

          try {
            // prefer elementRegistry to get element reference
            const element = elementRegistry.get(elemId)
            let id: string
            if (element) {
              id = overlays.add(element, {
                position: { top: -10, right: -10 },
                html: badge
              })
            } else {
              // fallback: try adding by id (older versions might support it)
              id = overlays.add(elemId, { position: { top: -10, right: -10 }, html: badge })
            }
            overlaysMap.set(elemId, id)
          } catch (err) {
            console.warn('Failed to add lock overlay for', elemId, err)
          }
        }
      }
    }, { immediate: true })

    // Show lock denied toast when composable reports it
    watch(lockDenied, (val) => {
      if (val) {
        lockDeniedToast.value = val
        if (lockDeniedTimeout) clearTimeout(lockDeniedTimeout)
        lockDeniedTimeout = setTimeout(() => { lockDeniedToast.value = null }, 2000)
      }
    })
  } catch (err) {
    // non-fatal if services aren't available
    console.warn('EventBus/Overlays not available yet', err)
  }
})

onUnmounted(() => {
  if (lockDeniedTimeout) clearTimeout(lockDeniedTimeout)
  if (currentLock.value) {
    try {
      releaseLock(currentLock.value)
    } catch (e) {
      console.error('Error releasing lock on unmount:', e)
    }
    currentLock.value = null
  }
  // remove container click listener if any
  try {
    if (canvasContainer.value) {
      // clone handler removal by reference: recreate function? we have closure - store on element
      // If we attached, remove it by iterating listeners is not possible; instead set a property on element
      const containerWithHandler = canvasContainer.value as HTMLDivElementWithHandler
      const existing = containerWithHandler.__containerClickHandler
      if (existing) canvasContainer.value.removeEventListener('click', existing)
    }
  } catch (e) {
    console.error('Error removing container click listener on unmount:', e)
  }
  // remove any overlays we created
  try {
    const overlays = modeler?.get('overlays') as Overlays | undefined
    if (overlays) {
      for (const id of overlaysMap.values()) {
        try { overlays.remove(id) } catch (e) { }
      }
      overlaysMap.clear()
    }
  } catch (e) {
      console.error('Error cleaning up overlays on unmount:', e)
  }
})

const loadDiagram = async (xmlData: string) => {
  if (!modeler) return

  try {
    isUpdatingFromServer = true
    await modeler.importXML(xmlData)
    const canvas = modeler.get('canvas') as Canvas
    canvas.zoom('fit-viewport')
  } catch (e) {
    console.error('Error importing XML:', e)
  } finally {
    isUpdatingFromServer = false
  }
}


// Watch for XML updates from other users
watch(xml, async (newXml) => {
  if (isUpdatingFromServer) return

  // minimal guard for incoming XML updates: prefer server XML if valid,
  // otherwise fetch the authoritative default from backend.
  let safeXml: string
  if (newXml && /<bpmn:definitions[\s>]/i.test(newXml)) {
    safeXml = newXml
  } else {
    safeXml = await fetchDefaultBpmn()
  }

  await loadDiagram(safeXml)
})

function getInitials(id: string | undefined) {
  if (!id) return '?'
  // If id is UUID, show first 2 chars, else initials
  if (/^[a-f0-9]{8}$/i.test(id)) return id.slice(0, 2).toUpperCase()
  const parts = id.split(/[^a-zA-Z0-9]/).filter(Boolean)
  if (parts.length === 1 && parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return parts.map(p => p[0] || '').join('').toUpperCase().slice(0, 2)
}
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
.lock-badge {
  display: inline-block;
  padding: 2px 6px;
  background: rgba(239, 68, 68, 0.95);
  color: white;
  font-size: 11px;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  z-index: 1000;
  pointer-events: none;
}
</style>

<style>
@import 'bpmn-js/dist/assets/diagram-js.css';
@import 'bpmn-js/dist/assets/bpmn-js.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
</style>
