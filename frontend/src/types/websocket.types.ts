/**
 * TypeScript type definitions for WebSocket messages
 */

export interface User {
  id: string;
}

export interface WebSocketMessage {
  type: string;
  xml?: string;
  user_id?: string;
  users?: User[];
  locks?: Record<string, string>;
  element_id?: string;
  by?: string;
  user?: User;
}

export interface WebSocketOutgoingMessage {
  type: string;
  xml?: string;
  by?: string;
  element_id?: string;
  user_id?: string;
}

export interface WebSocketState {
  userId: string;
  xml: string;
  users: User[];
  locks: Record<string, string>;
  lockDenied: string | null;
}
