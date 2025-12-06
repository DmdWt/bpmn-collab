import json
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from .bpmn_state import BpmnState

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
                # Do not allow locking the canvas element
                if msg.get("element_id") == 'canvas':
                    await ws.send_text(json.dumps({
                        "type": "lock_denied",
                        "element_id": msg.get("element_id"),
                        "user_id": msg.get("user_id")
                    }))
                else:
                    ok = await state.acquire_lock(msg["element_id"], msg["user_id"])
                    # Send response directly to the requesting client
                    await ws.send_text(json.dumps({
                        "type": "lock_acquired" if ok else "lock_denied",
                        "element_id": msg["element_id"],
                        "user_id": msg["user_id"]
                    }))
                # Broadcast lock status to all clients (so overlays are updated)
                await manager.broadcast({
                    "type": "locks_update",
                    "locks": state.locks
                })

            elif t == "release_lock":
                # Do not allow releasing a canvas lock (canvas is not lockable)
                if msg.get("element_id") == 'canvas':
                    # treat as failed release
                    await manager.broadcast({
                        "type": "lock_release_failed",
                        "element_id": msg.get("element_id"),
                        "user_id": msg.get("user_id")
                    })
                else:
                    ok = await state.release_lock(msg["element_id"], msg["user_id"])
                    await manager.broadcast({
                        "type": "lock_released" if ok else "lock_release_failed",
                        "element_id": msg["element_id"],
                        "user_id": msg["user_id"]
                    })
                    # Also broadcast the full locks map so all clients have a consistent view
                    if ok:
                        await manager.broadcast({
                            "type": "locks_update",
                            "locks": state.locks
                        })

    except WebSocketDisconnect:
        manager.disconnect(ws)
        await state.remove_user(user_id)
        # inform others that the user left
        await manager.broadcast({"type": "user_leave", "user_id": user_id})
        # and broadcast updated locks in case the disconnected user held locks
        await manager.broadcast({"type": "locks_update", "locks": state.locks})


@app.get("/default-bpmn")
async def default_bpmn():
    """Return the server's authoritative default BPMN XML as plain XML text."""
    default = await state.get_xml()
    return PlainTextResponse(default, media_type="application/xml")
