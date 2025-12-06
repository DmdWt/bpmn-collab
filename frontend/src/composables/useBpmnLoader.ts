/**
 * Composable for loading and managing BPMN diagrams
 * Handles diagram initialization, XML updates, and canvas operations
 */

import { watch, type Ref } from 'vue';
import type BpmnModeler from 'bpmn-js/lib/Modeler';
import type { Canvas } from '../types/bpmn.types';

export function useBpmnLoader(
  modeler: Ref<BpmnModeler | null>,
  xml: Ref<string>,
  rerenderOverlays: () => Promise<void>
) {
  let isUpdatingFromServer = false;

  const minimalFallback = '<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">\n  <bpmn:process id="Process_1" isExecutable="false">\n    <bpmn:startEvent id="StartEvent_1" />\n  </bpmn:process>\n</bpmn:definitions>';

  /**
   * Fetches the default BPMN diagram from the backend
   */
  const fetchDefaultBpmn = async (): Promise<string> => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/default-bpmn`);
      if (!res.ok)
        throw new Error('Failed to fetch default BPMN: ' + res.status);
      const text = await res.text();
      return text;
    } catch (err) {
      console.warn('Failed to fetch default BPMN from server, using minimal fallback', err);
      return minimalFallback;
    }
  };

  /**
   * Loads a BPMN diagram into the modeler
   */
  const loadDiagram = async (xmlData: string): Promise<void> => {
    if (!modeler.value) return;

    try {
      isUpdatingFromServer = true;
      await modeler.value.importXML(xmlData);
      const canvas = modeler.value.get('canvas') as Canvas;
      canvas.zoom('fit-viewport');

      // Re-render lock overlays after diagram import
      // The overlays are lost when BPMN.js re-renders the canvas
      await rerenderOverlays();
    } catch (e) {
      console.error('Error importing XML:', e);
    } finally {
      isUpdatingFromServer = false;
    }
  };

  /**
   * Loads the initial diagram (either from server state or default)
   */
  const loadInitialDiagram = async (): Promise<void> => {
    let safeInitialXml: string;
    if (xml.value && /<bpmn:definitions[\s>]/i.test(xml.value)) {
      safeInitialXml = xml.value;
    } else {
      safeInitialXml = await fetchDefaultBpmn();
    }

    await loadDiagram(safeInitialXml);
  };

  /**
   * Sets up watcher for XML updates from other users
   */
  const setupXmlWatcher = () => {
    watch(xml, async (newXml) => {
      if (isUpdatingFromServer) return;

      // Minimal guard for incoming XML updates: prefer server XML if valid,
      // otherwise fetch the authoritative default from backend.
      let safeXml: string;
      if (newXml && /<bpmn:definitions[\s>]/i.test(newXml)) {
        safeXml = newXml;
      } else {
        safeXml = await fetchDefaultBpmn();
      }

      await loadDiagram(safeXml);
    });
  };

  /**
   * Gets the current updating state
   */
  const getIsUpdatingFromServer = (): boolean => {
    return isUpdatingFromServer;
  };

  return {
    loadInitialDiagram,
    loadDiagram,
    setupXmlWatcher,
    getIsUpdatingFromServer
  };
}
