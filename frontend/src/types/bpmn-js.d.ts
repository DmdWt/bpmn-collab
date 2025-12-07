/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'bpmn-js/lib/Modeler' {
  import type { ModdleElement } from 'bpmn-js/lib/model/Types';

  export interface ImportXMLResult {
    warnings: string[];
  }

  export interface SaveXMLResult {
    xml?: string;
  }

  export interface ModelerOptions {
    container?: HTMLElement | string;
    width?: number | string;
    height?: number | string;
    moddleExtensions?: Record<string, any>;
    modules?: any[];
    additionalModules?: any[];
  }

  export interface Canvas {
    zoom(newScale?: number | 'fit-viewport', center?: { x: number; y: number } | 'auto'): number;
    viewbox(box?: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number };
    scroll(delta: { dx: number; dy: number }): void;
    getRootElement(): ModdleElement;
  }

  export interface ElementRegistry {
    get(id: string): ModdleElement | undefined;
    getAll(): ModdleElement[];
    filter(fn: (element: ModdleElement) => boolean): ModdleElement[];
    forEach(fn: (element: ModdleElement) => void): void;
  }

  export interface Modeling {
    updateProperties(element: ModdleElement, properties: Record<string, any>): void;
    updateLabel(element: ModdleElement, newLabel: string): void;
    connect(source: ModdleElement, target: ModdleElement, attrs?: Record<string, any>): ModdleElement;
    createShape(shape: Record<string, any>, position: { x: number; y: number }, parent: ModdleElement): ModdleElement;
    removeElements(elements: ModdleElement[]): void;
    removeShape(shape: ModdleElement): void;
    removeConnection(connection: ModdleElement): void;
  }

  export interface Overlays {
    add(
      element: string | ModdleElement,
      type: string,
      overlay: {
        position: { top?: number; bottom?: number; left?: number; right?: number };
        html: string | HTMLElement;
        scale?: { min?: number; max?: number };
      }
    ): string;
    remove(overlayId: string): void;
    remove(filter: { element?: string; type?: string }): void;
    get(filter: { element?: string; type?: string }): any[];
    clear(): void;
  }

  export interface EventBus {
    on(event: string, priority?: number, callback?: (event: any) => void, that?: any): void;
    on(event: string, callback: (event: any) => void, that?: any): void;
    once(event: string, priority?: number, callback?: (event: any) => void, that?: any): void;
    once(event: string, callback: (event: any) => void, that?: any): void;
    off(event: string, callback?: (event: any) => void): void;
    fire(event: string, payload?: any): void;
  }

  export interface CommandStack {
    execute(command: string, context?: any): void;
    canExecute(command: string, context?: any): boolean;
    undo(): void;
    redo(): void;
    clear(): void;
    registerHandler(command: string, handler: any): void;
    register(command: string, handler: any): void;
  }

  export interface Selection {
    get(): ModdleElement[];
    select(elements: ModdleElement | ModdleElement[], add?: boolean): void;
    deselect(elements?: ModdleElement | ModdleElement[]): void;
    isSelected(element: ModdleElement): boolean;
  }

  export default class BpmnModeler {
    constructor(options?: ModelerOptions);

    importXML(xml: string): Promise<ImportXMLResult>;
    saveXML(options?: { format?: boolean; preamble?: boolean }): Promise<SaveXMLResult>;
    saveSVG(options?: { format?: boolean }): Promise<{ svg: string }>;

    get(serviceName: 'canvas'): Canvas;
    get(serviceName: 'elementRegistry'): ElementRegistry;
    get(serviceName: 'modeling'): Modeling;
    get(serviceName: 'overlays'): Overlays;
    get(serviceName: 'eventBus'): EventBus;
    get(serviceName: 'commandStack'): CommandStack;
    get(serviceName: 'selection'): Selection;
    get<T = any>(serviceName: string): T;

    on(event: string, priority?: number, callback?: (event: any) => void, that?: any): void;
    on(event: string, callback: (event: any) => void, that?: any): void;
    off(event: string, callback?: (event: any) => void): void;

    destroy(): void;
    clear(): void;

    attachTo(parentNode: HTMLElement): void;
    detach(): void;
  }
}

declare module 'bpmn-js/lib/model/Types' {
  export interface ModdleElement {
    id: string;
    type: string;
    businessObject: any;
    parent?: ModdleElement;
    labels?: ModdleElement[];
    attachers?: ModdleElement[];
    incoming?: ModdleElement[];
    outgoing?: ModdleElement[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    [key: string]: any;
  }
}
