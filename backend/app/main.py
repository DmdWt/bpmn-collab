import json
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .bpmn_state import BpmnState

app = FastAPI()
state = BpmnState()


class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        data = json.dumps(message)
        for conn in list(self.active_connections):
            try:
                await conn.send_text(data)
            except Exception:
                pass

manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)

    user_id = str(uuid.uuid4())[:8]
    await state.set_user(user_id, {"id": user_id})

    # Send initial data to connected client
    initial_xml = await state.get_xml()
    await ws.send_text(json.dumps({
        "type": "init",
        "xml": initial_xml,
        "user_id": user_id,
        "users": list(state.users.values()),
        "locks": state.locks
    }))

    # Inform others
    await manager.broadcast({"type": "user_join", "user": {"id": user_id}})

    try:
        while True:
            text = await ws.receive_text()
            msg = json.loads(text)
            t = msg.get("type")

            if t == "update_xml":
                xml = msg.get("xml", "")
                await state.set_xml(xml)
                await manager.broadcast({"type": "xml_update", "xml": xml, "by": msg.get("by")})

            elif t == "acquire_lock":
                ok = await state.acquire_lock(msg["element_id"], msg["user_id"])
                await manager.broadcast({
                    "type": "lock_acquired" if ok else "lock_denied",
                    "element_id": msg["element_id"],
                    "user_id": msg["user_id"]
                })

            elif t == "release_lock":
                ok = await state.release_lock(msg["element_id"], msg["user_id"])
                await manager.broadcast({
                    "type": "lock_released" if ok else "lock_release_failed",
                    "element_id": msg["element_id"],
                    "user_id": msg["user_id"]
                })

    except WebSocketDisconnect:
        manager.disconnect(ws)
        await state.remove_user(user_id)
        await manager.broadcast({"type": "user_leave", "user_id": user_id})
