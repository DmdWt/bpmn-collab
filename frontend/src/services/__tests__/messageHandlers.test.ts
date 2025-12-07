/**
 * Unit tests for WebSocket message handlers
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createMessageHandlers } from '../messageHandlers';
import type { WebSocketMessage, User } from '../../types/websocket.types';

describe('messageHandlers', () => {
  let state: any;

  beforeEach(() => {
    state = {
      userId: ref(''),
      xml: ref(''),
      users: ref<User[]>([]),
      locks: ref<Record<string, string>>({}),
      lockDenied: ref<string | null>(null)
    };
  });

  it('should initialize all state from init message', () => {
    const { handleMessage } = createMessageHandlers(state);

    const msg: WebSocketMessage = {
      type: 'init',
      user_id: 'user123',
      xml: '<bpmn:definitions></bpmn:definitions>',
      users: [{ id: 'user1' }, { id: 'user2' }],
      locks: { Task_1: 'user1' }
    };

    handleMessage(msg);

    expect(state.userId.value).toBe('user123');
    expect(state.xml.value).toBe('<bpmn:definitions></bpmn:definitions>');
    expect(state.users.value).toEqual([{ id: 'user1' }, { id: 'user2' }]);
    expect(state.locks.value).toEqual({ Task_1: 'user1' });
  });

  it('should NOT update XML when sent by current user (self)', () => {
    state.userId.value = 'user1';
    state.xml.value = 'original';
    const { handleMessage } = createMessageHandlers(state);

    const msg: WebSocketMessage = {
      type: 'xml_update',
      xml: '<bpmn:definitions>new</bpmn:definitions>',
      by: 'user1'
    };

    handleMessage(msg);

    expect(state.xml.value).toBe('original');
  });

  it('should manage lock acquisition and release', () => {
    const { handleMessage } = createMessageHandlers(state);

    const acquireMsg: WebSocketMessage = {
      type: 'lock_acquired',
      element_id: 'Task_1',
      user_id: 'user1'
    };

    handleMessage(acquireMsg);
    expect(state.locks.value).toEqual({ Task_1: 'user1' });

    const releaseMsg: WebSocketMessage = {
      type: 'lock_released',
      element_id: 'Task_1',
      user_id: 'user1'
    };

    handleMessage(releaseMsg);
    expect(state.locks.value).toEqual({});
  });

  it('should replace entire locks state on locks_update', () => {
    state.locks.value = { Task_1: 'user1' };
    const { handleMessage } = createMessageHandlers(state);

    const msg: WebSocketMessage = {
      type: 'locks_update',
      locks: {
        Task_2: 'user2',
        Task_3: 'user3'
      }
    };

    handleMessage(msg);

    expect(state.locks.value).toEqual({
      Task_2: 'user2',
      Task_3: 'user3'
    });
  });

  it('should handle user join and leave', () => {
    state.users.value = [{ id: 'user1' }];
    const { handleMessage } = createMessageHandlers(state);

    const joinMsg: WebSocketMessage = {
      type: 'user_join',
      user: { id: 'user2' }
    };

    handleMessage(joinMsg);
    expect(state.users.value).toHaveLength(2);

    const leaveMsg: WebSocketMessage = {
      type: 'user_leave',
      user_id: 'user1'
    };

    handleMessage(leaveMsg);
    expect(state.users.value).toHaveLength(1);
    expect(state.users.value[0].id).toBe('user2');
  });
});
