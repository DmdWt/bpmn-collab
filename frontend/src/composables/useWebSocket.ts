import { ref, computed, onMounted, onUnmounted } from 'vue'

interface User {
  id: string
}

interface WebSocketMessage {
  type: string
  xml?: string
  user_id?: string
  users?: User[]
  locks?: Record<string, string>
  element_id?: string
  by?: string
  user?: User
}

export function useWebSocket() {
  const ws = ref<WebSocket | null>(null)
  const userId = ref<string>('')
  const xml = ref<string>('')
  const users = ref<User[]>([])
  const locks = ref<Record<string, string>>({})
  const lockDenied = ref<string | null>(null)
  const isConnected = ref(false)
  const error = ref<string>('')

  const connect = () => {
    try {
      ws.value = new WebSocket('ws://localhost:8000/ws')

      ws.value.onopen = () => {
        isConnected.value = true
        error.value = ''
      }

      ws.value.onmessage = (event) => {
        const msg: WebSocketMessage = JSON.parse(event.data)
        handleMessage(msg)
      }

      ws.value.onerror = () => {
        error.value = 'WebSocket error'
        isConnected.value = false
      }

      ws.value.onclose = () => {
        isConnected.value = false
      }
    } catch (e) {
      error.value = 'Failed to connect'
      console.error(e)
    }
  }

  const handleMessage = (msg: WebSocketMessage) => {
    switch (msg.type) {
      case 'init':
        userId.value = msg.user_id || ''
        xml.value = msg.xml || ''
        users.value = msg.users || []
        locks.value = msg.locks || {}
        break

      case 'xml_update':
        if (msg.by !== userId.value) {
          xml.value = msg.xml || ''
        }
        break

      case 'user_join':
        if (msg.user?.id) {
          // Add the new user if they are not already in the list
          if (!users.value.find(u => u.id === msg.user!.id)) {
            users.value = [...users.value, msg.user]
          }
        }
        break

      case 'user_leave':
        users.value = users.value.filter((u) => u.id !== msg.user_id)
        break

      case 'lock_acquired':
        if (msg.element_id) {
          // set single lock entry by replacing the locks object
          // to ensure reactivity (avoid in-place mutation)
          locks.value = {
            ...(locks.value || {}),
            [msg.element_id]: msg.user_id || ''
          }
        }
        break

      case 'lock_denied':
        // expose denied element id for UI feedback
        lockDenied.value = msg.element_id || null
        break

      case 'lock_released':
        if (msg.element_id) {
          // remove entry by creating a new object without the element key
          const { [msg.element_id]: _, ...rest } = locks.value || {}
          locks.value = rest
        }
        break

      case 'lock_release_failed':
        break

      case 'locks_update':
        // backend broadcasts the full locks map
        if (msg.locks && typeof msg.locks === 'object') {
          locks.value = msg.locks
        }
        break
    }
  }

  interface WebSocketOutgoingMessage {
    type: string
    xml?: string
    by?: string
    element_id?: string
    user_id?: string
  }

  const sendMessage = (msg: WebSocketOutgoingMessage) => {
    try {
      if (ws.value && isConnected.value) {
        ws.value.send(JSON.stringify(msg))
      } else {
        console.warn('WS not connected, dropping message:', msg)
      }
    } catch (e) {
      console.error('Failed to send WS message', e, msg)
    }
  }

  const updateXml = (newXml: string) => {
    sendMessage({
      type: 'update_xml',
      xml: newXml,
      by: userId.value
    })
  }

  const acquireLock = (elementId: string) => {
    // Do not allow locking the canvas element
    if (!elementId || elementId === 'canvas') return
    sendMessage({
      type: 'acquire_lock',
      element_id: elementId,
      user_id: userId.value
    })
  }

  const releaseLock = (elementId: string) => {
    // Ignore attempts to release the canvas lock (canvas is never lockable)
    if (!elementId || elementId === 'canvas') return
    sendMessage({
      type: 'release_lock',
      element_id: elementId,
      user_id: userId.value
    })
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    if (ws.value) {
      ws.value.close()
    }
  })

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
  }
}
