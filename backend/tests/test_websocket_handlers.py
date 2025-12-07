"""
Integration tests for WebSocket message handlers - tests canvas lock prevention
and message handling logic.
"""
import pytest
import json
from fastapi.testclient import TestClient
from app.main import app, state, manager


@pytest.fixture(autouse=True)
async def reset_state():
    """Reset state before each test."""
    state.xml = ""
    state.users.clear()
    state.locks.clear()
    manager.active_connections.clear()
    yield


class TestWebSocketCriticalFunctionality:
    """Test critical WebSocket functionality - canvas lock prevention and user lifecycle."""
    
    def test_canvas_lock_denied(self):
        """CRITICAL: Test that canvas element cannot be locked."""
        client = TestClient(app)
        
        with client.websocket_connect("/ws") as websocket:
            init_data = websocket.receive_json()
            user_id = init_data["user_id"]
            websocket.receive_json()  # user_join
            
            # Try to lock canvas element
            websocket.send_json({
                "type": "acquire_lock",
                "element_id": "canvas",
                "user_id": user_id
            })
            
            # Should receive lock_denied response
            response = websocket.receive_json()
            assert response["type"] == "lock_denied"
            assert response["element_id"] == "canvas"
            
            locks_update = websocket.receive_json()
            assert "canvas" not in locks_update["locks"]
    
    def test_lock_acquisition_and_release(self):
        """Test basic lock lifecycle."""
        client = TestClient(app)
        
        with client.websocket_connect("/ws") as websocket:
            init_data = websocket.receive_json()
            user_id = init_data["user_id"]
            websocket.receive_json()  # user_join
            
            # Acquire lock
            websocket.send_json({
                "type": "acquire_lock",
                "element_id": "Task_1",
                "user_id": user_id
            })
            
            response = websocket.receive_json()
            assert response["type"] == "lock_acquired"
            assert response["element_id"] == "Task_1"
            
            locks_update = websocket.receive_json()
            assert locks_update["locks"]["Task_1"] == user_id
            
            # Release lock
            websocket.send_json({
                "type": "release_lock",
                "element_id": "Task_1",
                "user_id": user_id
            })
            
            response = websocket.receive_json()
            assert response["type"] == "lock_released"
            
            locks_update = websocket.receive_json()
            assert "Task_1" not in locks_update["locks"]
    
    def test_lock_conflict(self):
        """Test lock conflict between users."""
        client = TestClient(app)
        
        with client.websocket_connect("/ws") as ws1:
            init1 = ws1.receive_json()
            user1 = init1["user_id"]
            ws1.receive_json()  # user_join
            
            # User1 locks element
            ws1.send_json({
                "type": "acquire_lock",
                "element_id": "Task_1",
                "user_id": user1
            })
            ws1.receive_json()  # lock_acquired
            ws1.receive_json()  # locks_update
            
            with client.websocket_connect("/ws") as ws2:
                init2 = ws2.receive_json()
                user2 = init2["user_id"]
                ws2.receive_json()  # user_join
                ws1.receive_json()  # user_join broadcast
                
                # User2 tries to lock same element
                ws2.send_json({
                    "type": "acquire_lock",
                    "element_id": "Task_1",
                    "user_id": user2
                })
                
                response = ws2.receive_json()
                assert response["type"] == "lock_denied"
                assert response["element_id"] == "Task_1"
    
    def test_disconnect_releases_locks(self):
        """Test disconnecting user has their locks released."""
        client = TestClient(app)
        
        # Connect ws2 first and keep it open
        with client.websocket_connect("/ws") as ws2:
            init2 = ws2.receive_json()
            ws2.receive_json()  # user_join for ws2
            
            # Connect ws1 in nested context
            with client.websocket_connect("/ws") as ws1:
                init1 = ws1.receive_json()
                user1 = init1["user_id"]
                ws1.receive_json()  # user_join for ws1
                ws2.receive_json()  # user_join broadcast to ws2
                
                # User1 locks element
                ws1.send_json({
                    "type": "acquire_lock",
                    "element_id": "Task_1",
                    "user_id": user1
                })
                ws1.receive_json()  # lock_acquired
                ws1.receive_json()  # locks_update
                ws2.receive_json()  # locks_update broadcast to ws2
            
            # ws1 disconnected, ws2 should receive user_leave and locks_update
            user_leave = ws2.receive_json()
            assert user_leave["type"] == "user_leave"
            assert user_leave["user_id"] == user1
            
            locks_update = ws2.receive_json()
            assert locks_update["type"] == "locks_update"
            assert "Task_1" not in locks_update["locks"]
