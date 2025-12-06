/**
 * Composable for managing BPMN element locking logic
 * Handles lock validation, acquisition, release, and command interception
 */

import { ref, type Ref } from 'vue';
import type BpmnModeler from 'bpmn-js/lib/Modeler';
import type {
  BpmnElement,
  CommandStack,
  CommandStackContext
} from '../types/bpmn.types';

export function useBpmnLocking(
  modeler: Ref<BpmnModeler | null>,
  userId: Ref<string>,
  locks: Ref<Record<string, string>>,
  acquireLock: (elementId: string) => void,
  releaseLock: (elementId: string) => void,
  onLockDenied: (message: string) => void
) {
  const currentLock = ref<string | null>(null);

  /**
   * Determines if an element can be locked
   */
  const isLockableElement = (
    element: BpmnElement | null | undefined
  ): boolean => {
    if (!element || !element.id) return false;
    const id = element.id;
    if (id === 'canvas' || id === 'Process_1') return false;
    const bo = element.businessObject;
    if (bo && (bo.$type === 'bpmn:Process' || bo.$type === 'bpmn:Definitions'))
      return false;
    if (element.type === 'bpmn:Process') return false;
    return true;
  };

  /**
   * Extracts all affected element IDs from a command context
   */
  const extractAffectedElements = (
    context?: CommandStackContext
  ): string[] => {
    if (!context) return [];
    const elementIds: string[] = [];

    const potentialElements = [
      context.shape,
      context.connection,
      context.element,
      context.target,
      context.source,
      context.newTarget,
      context.newSource,
      context.host,
      context.parent,
      ...(context.shapes || []),
      ...(context.connections || []),
      ...(context.elements || [])
    ];

    for (const elem of potentialElements) {
      if (elem && elem.id && isLockableElement(elem)) {
        if (!elementIds.includes(elem.id)) {
          elementIds.push(elem.id);
        }
      }
    }

    return elementIds;
  };

  /**
   * Checks if the current user can modify the given elements
   */
  const canModifyElements = (
    elementIds: string[]
  ): { allowed: boolean; lockedBy?: string; elementId?: string } => {
    const currentUserId = userId.value;

    for (const elemId of elementIds) {
      const lockOwner = locks.value[elemId];
      if (lockOwner && lockOwner !== currentUserId) {
        return { allowed: false, lockedBy: lockOwner, elementId: elemId };
      }
    }

    return { allowed: true };
  };

  /**
   * Sets up command stack interception to prevent unauthorized modifications
   */
  const setupCommandStackInterception = () => {
    if (!modeler.value) {
      console.warn('Modeler not initialized, cannot setup command interception');
      return;
    }

    try {
      const commandStack = modeler.value.get('commandStack') as CommandStack;
      const originalCanExecute = commandStack.canExecute.bind(commandStack);

      commandStack.canExecute = function (
        command: string,
        context?: CommandStackContext
      ): boolean {
        const defaultAllowed = originalCanExecute(command, context);
        if (!defaultAllowed) return false;

        const affectedElementIds = extractAffectedElements(context);
        const permission = canModifyElements(affectedElementIds);

        if (!permission.allowed) {
          const owner = permission.lockedBy || 'another user';
          onLockDenied(`Element locked by ${owner}`);
          return false;
        }

        return true;
      };
    } catch (err) {
      console.error('Failed to setup CommandStack interception:', err);
    }
  };

  /**
   * Attempts to acquire a lock for an element
   */
  const tryAcquireLock = (element: BpmnElement) => {
    if (!isLockableElement(element)) return;

    // Check if we already have this lock
    const currentUserId = userId.value;
    const currentOwner = locks.value[element.id];
    if (currentOwner === currentUserId) {
      // We already own this lock, no need to re-acquire
      return;
    }

    // Before acquiring a new lock, release any locks we currently hold
    try {
      const myLocks = Object.entries(locks.value || {})
        .filter(([, owner]) => owner === currentUserId)
        .map(([id]) => id);
      for (const lid of myLocks) {
        if (lid !== element.id) {
          try {
            releaseLock(lid);
          } catch (e) {
            console.error('error releasing previous lock', lid, e);
          }
        }
      }
    } catch (e) {
      console.error('error while releasing previous locks', e);
    }

    // Request lock from server for the element
    acquireLock(element.id);
  };

  /**
   * Releases the current lock if any
   */
  const releaseCurrentLock = () => {
    if (currentLock.value) {
      try {
        releaseLock(currentLock.value);
      } catch (e) {
        console.error('error calling releaseLock:', e);
      }
      currentLock.value = null;
    }
  };

  /**
   * Synchronizes currentLock with server state
   */
  const syncCurrentLock = (newLocks: Record<string, string>) => {
    const currentUserId = userId.value;
    const myLockedElements = Object.entries(newLocks || {})
      .filter(([, owner]) => owner === currentUserId)
      .map(([id]) => id);

    // Update currentLock to reflect the first lock we own, or null if none
    if (myLockedElements.length > 0 && myLockedElements[0]) {
      currentLock.value = myLockedElements[0];
    } else {
      currentLock.value = null;
    }
  };

  return {
    currentLock,
    isLockableElement,
    extractAffectedElements,
    canModifyElements,
    setupCommandStackInterception,
    tryAcquireLock,
    releaseCurrentLock,
    syncCurrentLock
  };
}
