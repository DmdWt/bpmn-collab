/**
 * Composable for managing BPMN element locking logic
 * Handles lock validation, acquisition, release, and command interception
 */

import { ref, type Ref } from 'vue';
import type { default as BpmnModeler, CommandStack } from 'bpmn-js/lib/Modeler';
import type {
  BpmnElement,
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
   *
   * This intercepts bpmn-js's command stack to validate locks before any modification.
   * Every edit operation (move, delete, create, etc.) goes through canExecute() first.
   */
  const setupCommandStackInterception = () => {
    if (!modeler.value) {
      console.warn('Modeler not initialized, cannot setup command interception');
      return;
    }

    try {
      const commandStack = modeler.value.get('commandStack') as CommandStack;
      // Save reference to original canExecute method
      const originalCanExecute = commandStack.canExecute.bind(commandStack);

      // Override canExecute to add our lock validation
      commandStack.canExecute = function (
        command: string,
        context?: CommandStackContext
      ): boolean {
        // First check: let bpmn-js validate if command is generally allowed
        const defaultAllowed = originalCanExecute(command, context);
        if (!defaultAllowed) return false;

        // Second check: verify user has locks for all affected elements
        const affectedElementIds = extractAffectedElements(context);
        const permission = canModifyElements(affectedElementIds);

        if (!permission.allowed) {
          // Block the command and show user feedback
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

    // Before acquiring a new lock, release any lock we hold
    releaseCurrentLock();

    // Request lock from server for the element
    acquireLock(element.id);
  };

  /**
   * Releases all locks held by the current user
   * In single-lock model, this should be at most one lock, but we check all to be safe
   */
  const releaseCurrentLock = () => {
    const currentUserId = userId.value;
    const myLocks = Object.entries(locks.value || {})
      .filter(([, owner]) => owner === currentUserId)
      .map(([id]) => id);

    for (const lockId of myLocks) {
      try {
        releaseLock(lockId);
      } catch (e) {
        console.error('error releasing lock', lockId, e);
      }
    }

    currentLock.value = null;
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
