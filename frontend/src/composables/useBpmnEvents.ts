/**
 * Composable for managing BPMN event bus interactions
 * Handles element click, move, resize, and canvas events
 */

import { type Ref } from 'vue';
import type BpmnModeler from 'bpmn-js/lib/Modeler';
import type {
  BpmnElement,
  EventBus,
  HTMLDivElementWithHandler,
  ElementClickEvent,
  ShapeMoveEvent,
  ConnectionMoveEvent,
  ResizeEvent
} from '../types/bpmn.types';

export function useBpmnEvents(
  modeler: Ref<BpmnModeler | null>,
  canvasContainer: Ref<HTMLDivElement | null>,
  tryAcquireLock: (element: BpmnElement) => void,
  releaseCurrentLock: () => void
) {
  let containerClickHandler: ((ev: MouseEvent) => void) | null = null;

  /**
   * Sets up all event listeners on the BPMN event bus
   */
  const setupEventBusListeners = () => {
    if (!modeler.value) {
      console.warn('Modeler not initialized, cannot setup event listeners');
      return;
    }

    try {
      const eventBus = modeler.value.get('eventBus') as EventBus;

      // Element click -> try to acquire lock
      eventBus.on('element.click', (e: ElementClickEvent) => {
        tryAcquireLock(e.element);
      });

      // Shape move start -> acquire lock before moving (drag and drop)
      eventBus.on('shape.move.start', (e: ShapeMoveEvent) => {
        if (e.shape) {
          tryAcquireLock(e.shape);
        }
      });

      // Connection move start -> acquire lock before moving
      eventBus.on('connection.move.start', (e: ConnectionMoveEvent) => {
        if (e.connection) {
          tryAcquireLock(e.connection);
        }
      });

      // Shape resize start -> acquire lock before resizing
      eventBus.on('resize.start', (e: ResizeEvent) => {
        if (e.shape) {
          tryAcquireLock(e.shape);
        }
      });

      // Canvas click -> release our lock (if any)
      eventBus.on('canvas.click', () => {
        releaseCurrentLock();
      });
    } catch (err) {
      console.warn('EventBus not available yet', err);
    }
  };

  /**
   * Sets up DOM-level click handler on the canvas container
   * Detects clicks on empty space as a fallback if eventBus canvas.click doesn't fire
   */
  const setupContainerClickHandler = () => {
    if (!canvasContainer.value) return;

    containerClickHandler = (ev: MouseEvent) => {
      try {
        const target = ev.target as HTMLElement | null;
        // If user clicked on a BPMN element SVG node (common classes), ignore
        if (
          target &&
          target.closest &&
          target.closest('.djs-element, .djs-shape, .djs-connection')
        ) {
          return;
        }
        releaseCurrentLock();
      } catch (e) {
        console.error('error in containerClickHandler', e);
      }
    };

    // Store handler reference so we can remove it on cleanup
    const containerWithHandler =
      canvasContainer.value as HTMLDivElementWithHandler;
    containerWithHandler.__containerClickHandler = containerClickHandler;
    canvasContainer.value.addEventListener('click', containerClickHandler);
  };

  /**
   * Removes the container click handler
   */
  const cleanupContainerClickHandler = () => {
    try {
      if (canvasContainer.value && containerClickHandler) {
        const containerWithHandler =
          canvasContainer.value as HTMLDivElementWithHandler;
        const existing = containerWithHandler.__containerClickHandler;
        if (existing) {
          canvasContainer.value.removeEventListener('click', existing);
        }
      }
    } catch (e) {
      console.error('Error removing container click listener:', e);
    }
  };

  /**
   * Sets up all event handlers (both event bus and DOM)
   */
  const setupEventHandlers = () => {
    setupEventBusListeners();
    setupContainerClickHandler();
  };

  /**
   * Cleans up all event handlers
   */
  const cleanupEventHandlers = () => {
    cleanupContainerClickHandler();
  };

  return {
    setupEventHandlers,
    cleanupEventHandlers
  };
}
