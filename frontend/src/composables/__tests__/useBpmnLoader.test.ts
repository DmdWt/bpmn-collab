/**
 * Unit tests for useBpmnLoader composable
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useBpmnLoader } from '../useBpmnLoader';
import { createMockModeler } from '../../../tests/mocks/bpmnModeler.mock';

// Mock fetch
globalThis.fetch = vi.fn();

describe('useBpmnLoader', () => {
  let modeler: any;
  let xml: any;
  let rerenderOverlays: any;

  beforeEach(() => {
    modeler = ref(createMockModeler());
    xml = ref('');
    rerenderOverlays = vi.fn(async () => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should import XML into modeler and zoom to fit', async () => {
    const testXml = '<bpmn:definitions>test</bpmn:definitions>';
    const { loadDiagram } = useBpmnLoader(modeler, xml, rerenderOverlays);

    await loadDiagram(testXml);

    expect(modeler.value.importXML).toHaveBeenCalledWith(testXml);
    const canvas = modeler.value.get('canvas');
    expect(canvas.zoom).toHaveBeenCalledWith('fit-viewport');
    expect(rerenderOverlays).toHaveBeenCalled();
  });

  it('should use fallback XML on fetch failure', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('Network error'));

    const { loadInitialDiagram } = useBpmnLoader(modeler, xml, rerenderOverlays);
    await loadInitialDiagram();

    expect(modeler.value.importXML).toHaveBeenCalled();
    const importedXml = modeler.value.importXML.mock.calls[0][0];
    expect(importedXml).toContain('<bpmn:definitions');
    expect(importedXml).toContain('<bpmn:startEvent id="StartEvent_1"');
  });

  it('should validate XML with regex pattern', async () => {
    xml.value = '<bpmn:definitions xmlns="...">';
    const { loadInitialDiagram } = useBpmnLoader(modeler, xml, rerenderOverlays);
    await loadInitialDiagram();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('should manage isUpdatingFromServer flag correctly', async () => {
    const testXml = '<bpmn:definitions>test</bpmn:definitions>';
    const { loadDiagram, getIsUpdatingFromServer } = useBpmnLoader(
      modeler,
      xml,
      rerenderOverlays
    );

    expect(getIsUpdatingFromServer()).toBe(false);

    const loadPromise = loadDiagram(testXml);
    expect(getIsUpdatingFromServer()).toBe(true);

    await loadPromise;
    expect(getIsUpdatingFromServer()).toBe(false);
  });

  it('should handle import errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    modeler.value.importXML.mockRejectedValue(new Error('Invalid XML'));

    const { loadDiagram } = useBpmnLoader(modeler, xml, rerenderOverlays);

    await loadDiagram('<invalid>');

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
