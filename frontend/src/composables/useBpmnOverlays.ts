/**
 * Composable for managing BPMN element lock overlays
 * Handles visual indicators (badges) for locked elements
 */

import { watch, nextTick, type Ref } from 'vue';
import type BpmnModeler from 'bpmn-js/lib/Modeler';
import type { Overlays, ElementRegistry } from '../types/bpmn.types';

export function useBpmnOverlays(
  modeler: Ref<BpmnModeler | null>,
  locks: Ref<Record<string, string>>
) {
  const overlaysMap = new Map<string, string>();

  /**
   * Generates initials or short identifier from user ID
   */
  const getInitials = (id: string | undefined): string => {
    if (!id) return '?';
    // If id is UUID, show first 2 chars, else initials
    if (/^[a-f0-9]{8}$/i.test(id)) return id.slice(0, 2).toUpperCase();
    const parts = id.split(/[^a-zA-Z0-9]/).filter(Boolean);
    if (parts.length === 1 && parts[0])
      return parts[0].slice(0, 2).toUpperCase();
    return parts
      .map((p) => p[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Creates a badge element for displaying lock owner
   */
  const createLockBadge = (ownerId: string): HTMLElement => {
    const badge = document.createElement('div');
    badge.className = 'lock-badge';
    badge.textContent = getInitials(ownerId);
    return badge;
  };

  /**
   * Adds an overlay to an element
   */
  const addOverlay = (
    overlays: Overlays,
    elementRegistry: ElementRegistry,
    elemId: string,
    ownerId: string
  ): void => {
    const badge = createLockBadge(ownerId);

    try {
      const element = elementRegistry.get(elemId);
      let id: string;
      if (element) {
        id = overlays.add(element, {
          position: { top: -10, right: -10 },
          html: badge
        });
      } else {
        // fallback: try adding by id (older versions might support it)
        id = overlays.add(elemId, {
          position: { top: -10, right: -10 },
          html: badge
        });
      }
      overlaysMap.set(elemId, id);
    } catch (err) {
      console.warn('Failed to add lock overlay for', elemId, err);
    }
  };

  /**
   * Removes an overlay from an element
   */
  const removeOverlay = (overlays: Overlays, elemId: string): void => {
    const overlayId = overlaysMap.get(elemId);
    if (overlayId) {
      try {
        overlays.remove(overlayId);
        overlaysMap.delete(elemId);
      } catch (err) {
        console.warn('Failed to remove lock overlay for', elemId, err);
      }
    }
  };

  /**
   * Synchronizes overlays with current lock state
   */
  const syncOverlays = () => {
    if (!modeler.value) return;

    try {
      const overlays = modeler.value.get('overlays') as Overlays;
      const elementRegistry = modeler.value.get(
        'elementRegistry'
      ) as ElementRegistry;

      // Remove overlays that are no longer present
      for (const [elemId] of Array.from(overlaysMap.entries())) {
        if (!locks.value[elemId]) {
          removeOverlay(overlays, elemId);
        }
      }

      // Add/update overlays for current locks
      for (const [elemId, ownerId] of Object.entries(locks.value || {})) {
        if (!overlaysMap.has(elemId)) {
          addOverlay(overlays, elementRegistry, elemId, ownerId);
        }
      }
    } catch (err) {
      console.warn('Error syncing overlays:', err);
    }
  };

  /**
   * Re-renders all overlays (useful after diagram reload)
   */
  const rerenderOverlays = async () => {
    if (!modeler.value) return;

    await nextTick();

    try {
      const overlays = modeler.value.get('overlays') as Overlays;
      const elementRegistry = modeler.value.get(
        'elementRegistry'
      ) as ElementRegistry;

      // Clear old overlay references (they're invalid after importXML)
      overlaysMap.clear();

      // Re-add all current locks
      for (const [elemId, ownerId] of Object.entries(locks.value || {})) {
        addOverlay(overlays, elementRegistry, elemId, ownerId);
      }
    } catch (err) {
      console.warn('Error re-rendering overlays:', err);
    }
  };

  /**
   * Sets up watchers for lock changes
   */
  const setupOverlayWatcher = () => {
    watch(locks, syncOverlays, { immediate: true, deep: true });
  };

  /**
   * Cleans up all overlays
   */
  const cleanupOverlays = () => {
    try {
      const overlays = modeler.value?.get('overlays') as Overlays | undefined;
      if (overlays) {
        for (const id of overlaysMap.values()) {
          try {
            overlays.remove(id);
          } catch (e) {
            console.warn('Error removing overlay during cleanup:', e);
          }
        }
        overlaysMap.clear();
      }
    } catch (e) {
      console.error('Error cleaning up overlays:', e);
    }
  };

  return {
    getInitials,
    setupOverlayWatcher,
    syncOverlays,
    rerenderOverlays,
    cleanupOverlays
  };
}
