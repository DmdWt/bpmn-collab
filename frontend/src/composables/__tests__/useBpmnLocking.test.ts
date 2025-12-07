/**
 * Unit tests for useBpmnLocking composable - critical locking logic
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useBpmnLocking } from '../useBpmnLocking';
import { createMockModeler, createMockElement } from '../../../tests/mocks/bpmnModeler.mock';

describe('useBpmnLocking', () => {
  let modeler: any;
  let userId: any;
  let locks: any;
  let acquireLock: any;
  let releaseLock: any;
  let onLockDenied: any;

  beforeEach(() => {
    modeler = ref(createMockModeler());
    userId = ref('user1');
    locks = ref({});
    acquireLock = vi.fn();
    releaseLock = vi.fn();
    onLockDenied = vi.fn();
  });

  it('should return false for canvas element - CRITICAL', () => {
    const { isLockableElement } = useBpmnLocking(
      modeler,
      userId,
      locks,
      acquireLock,
      releaseLock,
      onLockDenied
    );

    const canvasElement = createMockElement('canvas');
    expect(isLockableElement(canvasElement)).toBe(false);
  });

  it('should return true for normal Task element', () => {
    const { isLockableElement } = useBpmnLocking(
      modeler,
      userId,
      locks,
      acquireLock,
      releaseLock,
      onLockDenied
    );

    const taskElement = createMockElement('Task_1', 'bpmn:Task');
    expect(isLockableElement(taskElement)).toBe(true);
  });

  it('should deny modification when element locked by another user', () => {
    locks.value = { Task_1: 'user2' };

    const { canModifyElements } = useBpmnLocking(
      modeler,
      userId,
      locks,
      acquireLock,
      releaseLock,
      onLockDenied
    );

    const result = canModifyElements(['Task_1']);
    expect(result.allowed).toBe(false);
    expect(result.lockedBy).toBe('user2');
  });

  it('should intercept and block commands for locked elements', () => {
    locks.value = { Task_1: 'user2' };

    const { setupCommandStackInterception } = useBpmnLocking(
      modeler,
      userId,
      locks,
      acquireLock,
      releaseLock,
      onLockDenied
    );

    setupCommandStackInterception();

    const commandStack = modeler.value.get('commandStack');
    const context = { shape: createMockElement('Task_1') };

    const allowed = commandStack.canExecute('shape.move', context);
    expect(allowed).toBe(false);
    expect(onLockDenied).toHaveBeenCalled();
  });

  it('should not acquire lock for canvas element', () => {
    const { tryAcquireLock } = useBpmnLocking(
      modeler,
      userId,
      locks,
      acquireLock,
      releaseLock,
      onLockDenied
    );

    const canvas = createMockElement('canvas');
    tryAcquireLock(canvas);

    expect(acquireLock).not.toHaveBeenCalled();
  });

  it('should release old locks before acquiring new lock', () => {
    locks.value = { Task_1: 'user1', Task_2: 'user1' };

    const { tryAcquireLock } = useBpmnLocking(
      modeler,
      userId,
      locks,
      acquireLock,
      releaseLock,
      onLockDenied
    );

    const task3 = createMockElement('Task_3');
    tryAcquireLock(task3);

    expect(releaseLock).toHaveBeenCalledWith('Task_1');
    expect(releaseLock).toHaveBeenCalledWith('Task_2');
    expect(acquireLock).toHaveBeenCalledWith('Task_3');
  });

  it('should filter out non-lockable elements from context', () => {
    const { extractAffectedElements } = useBpmnLocking(
      modeler,
      userId,
      locks,
      acquireLock,
      releaseLock,
      onLockDenied
    );

    const context = {
      shapes: [
        createMockElement('canvas'),
        createMockElement('Task_1'),
        createMockElement('Process_1')
      ]
    };

    const ids = extractAffectedElements(context);
    expect(ids).toEqual(['Task_1']);
  });
});
