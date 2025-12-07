/**
 * Mock factory for bpmn-js Modeler and related services.
 * Provides comprehensive mocks for testing composables that interact with BPMN.js.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

export interface MockEventBus {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  fire: ReturnType<typeof vi.fn>
}

export interface MockCommandStack {
  registerHandler: ReturnType<typeof vi.fn>
  canExecute: ReturnType<typeof vi.fn>
  execute: ReturnType<typeof vi.fn>
  changed: ReturnType<typeof vi.fn>
}

export interface MockOverlays {
  add: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
}

export interface MockElementRegistry {
  get: ReturnType<typeof vi.fn>
  getAll: ReturnType<typeof vi.fn>
  filter: ReturnType<typeof vi.fn>
}

export interface MockCanvas {
  getRootElement: ReturnType<typeof vi.fn>
  getContainer: ReturnType<typeof vi.fn>
  zoom: ReturnType<typeof vi.fn>
}

export interface MockModeling {
  updateProperties: ReturnType<typeof vi.fn>
  moveElements: ReturnType<typeof vi.fn>
}

export interface MockModeler {
  get: ReturnType<typeof vi.fn>
  importXML: ReturnType<typeof vi.fn>
  saveXML: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  _eventBus: MockEventBus
  _commandStack: MockCommandStack
  _overlays: MockOverlays
  _elementRegistry: MockElementRegistry
  _canvas: MockCanvas
  _modeling: MockModeling
}

/**
 * Creates a mock BPMN element for testing.
 */
export function createMockElement(id: string, type = 'bpmn:Task') {
  return {
    id,
    type,
    businessObject: {
      $type: type,
      id
    },
    x: 100,
    y: 100,
    width: 100,
    height: 80
  };
}

/**
 * Creates a mock bpmn-js Modeler with all services.
 */
export function createMockModeler(): MockModeler {
  const eventBus: MockEventBus = {
    on: vi.fn(),
    off: vi.fn(),
    fire: vi.fn()
  };

  const commandStack: MockCommandStack = {
    registerHandler: vi.fn(),
    canExecute: vi.fn(() => true),
    execute: vi.fn(),
    changed: vi.fn()
  };

  const overlays: MockOverlays = {
    add: vi.fn(() => 'overlay_element'),
    remove: vi.fn(),
    get: vi.fn(() => []),
    clear: vi.fn()
  };

  const elementRegistry: MockElementRegistry = {
    get: vi.fn(() => createMockElement('element')),
    getAll: vi.fn(() => []),
    filter: vi.fn(() => [])
  };

  const canvas: MockCanvas = {
    getRootElement: vi.fn(() => createMockElement('Process_1', 'bpmn:Process')),
    getContainer: vi.fn(() => document.createElement('div')),
    zoom: vi.fn()
  };

  const modeling: MockModeling = {
    updateProperties: vi.fn(),
    moveElements: vi.fn()
  };

  const modeler: MockModeler = {
    get: vi.fn((serviceName: string) => {
      const services: Record<string, any> = {
        eventBus,
        commandStack,
        overlays,
        elementRegistry,
        canvas,
        modeling
      };
      return services[serviceName];
    }),
    importXML: vi.fn(() => Promise.resolve({ warnings: [] })),
    saveXML: vi.fn(() => Promise.resolve({ xml: '<bpmn:definitions></bpmn:definitions>' })),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    _eventBus: eventBus,
    _commandStack: commandStack,
    _overlays: overlays,
    _elementRegistry: elementRegistry,
    _canvas: canvas,
    _modeling: modeling
  };

  return modeler;
}

/**
 * Creates a mock WebSocket for testing.
 */
export function createMockWebSocket() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED
  };
}
