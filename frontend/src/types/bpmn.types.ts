/**
 * TypeScript type definitions for BPMN.js components
 */

export interface BpmnElement {
  id: string;
  type?: string;
  businessObject?: {
    $type?: string;
  };
}

export interface ElementClickEvent {
  element: BpmnElement;
}

export interface ShapeMoveEvent {
  shape: BpmnElement;
  hover?: BpmnElement;
  dx?: number;
  dy?: number;
}

export interface ConnectionMoveEvent {
  connection: BpmnElement;
  hover?: BpmnElement;
}

export interface ResizeEvent {
  shape: BpmnElement;
}

export interface EventBus {
  on(event: 'element.click', callback: (e: ElementClickEvent) => void): void;
  on(event: 'shape.move.start', callback: (e: ShapeMoveEvent) => void): void;
  on(event: 'connection.move.start', callback: (e: ConnectionMoveEvent) => void): void;
  on(event: 'resize.start', callback: (e: ResizeEvent) => void): void;
  on(event: 'canvas.click', callback: () => void): void;
  on(event: string, callback: (e: unknown) => void): void;
  on(event: string, priority: number, callback: (e: unknown) => void): void;
}

export interface Overlays {
  add(
    element: BpmnElement | string,
    config: { position: { top: number; right: number }; html: HTMLElement }
  ): string;
  remove(id: string): void;
}

export interface ElementRegistry {
  get(id: string): BpmnElement | undefined;
}

export interface Canvas {
  zoom(mode: string): void;
}

export interface CommandStackContext {
  shape?: BpmnElement;
  shapes?: BpmnElement[];
  connection?: BpmnElement;
  connections?: BpmnElement[];
  elements?: BpmnElement[];
  element?: BpmnElement;
  target?: BpmnElement;
  source?: BpmnElement;
  newTarget?: BpmnElement;
  newSource?: BpmnElement;
  host?: BpmnElement;
  parent?: BpmnElement;
  [key: string]: unknown;
}

export interface CommandStack {
  canExecute(command: string, context?: CommandStackContext): boolean;
  execute(command: string, context?: CommandStackContext): void;
}

export interface HTMLDivElementWithHandler extends HTMLDivElement {
  __containerClickHandler?: (ev: MouseEvent) => void;
}
