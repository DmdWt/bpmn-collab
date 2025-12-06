from typing import Dict
import asyncio

class BpmnState:
    def __init__(self):
        self.xml: str = """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="79" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>"""
        self.users: Dict[str, dict] = {}
        self.locks: Dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def set_xml(self, xml: str):
        async with self._lock:
            self.xml = xml

    async def get_xml(self) -> str:
        async with self._lock:
            return self.xml

    async def set_user(self, user_id: str, info: dict):
        async with self._lock:
            self.users[user_id] = info

    async def remove_user(self, user_id: str):
        async with self._lock:
            self.users.pop(user_id, None)
            # remove locks owned by this user
            to_remove = [eid for eid, uid in self.locks.items() if uid == user_id]
            for eid in to_remove:
                del self.locks[eid]

    async def acquire_lock(self, element_id: str, user_id: str) -> bool:
        async with self._lock:
            if element_id in self.locks:
                return False
            self.locks[element_id] = user_id
            return True

    async def release_lock(self, element_id: str, user_id: str) -> bool:
        async with self._lock:
            if self.locks.get(element_id) == user_id:
                del self.locks[element_id]
                return True
            return False
