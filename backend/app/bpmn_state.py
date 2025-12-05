from typing import Dict, Set, Any
import asyncio

class BpmnState:
    def __init__(self):
        self.xml: str = "<!-- empty BPMN -->"
        self.connections: Set[Any] = set()
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
