"""
Essential unit tests for BpmnState class - critical locking logic.
"""
import pytest
import asyncio
from app.bpmn_state import BpmnState


class TestBpmnStateEssentials:
    """Test essential BpmnState functionality."""
    
    @pytest.mark.asyncio
    async def test_xml_storage_and_retrieval(self, bpmn_state, sample_xml):
        """Test basic XML operations."""
        await bpmn_state.set_xml(sample_xml)
        retrieved_xml = await bpmn_state.get_xml()
        assert retrieved_xml == sample_xml
    
    @pytest.mark.asyncio
    async def test_lock_acquisition_success(self, bpmn_state):
        """Test successful lock acquisition."""
        result = await bpmn_state.acquire_lock("element1", "user1")
        assert result is True
        assert bpmn_state.locks["element1"] == "user1"
    
    @pytest.mark.asyncio
    async def test_lock_conflict(self, bpmn_state):
        """Test lock conflict when already locked by another user."""
        await bpmn_state.acquire_lock("element1", "user1")
        result = await bpmn_state.acquire_lock("element1", "user2")
        assert result is False
        assert bpmn_state.locks["element1"] == "user1"
    
    @pytest.mark.asyncio
    async def test_lock_release(self, bpmn_state):
        """Test lock release by owner."""
        await bpmn_state.acquire_lock("element1", "user1")
        result = await bpmn_state.release_lock("element1", "user1")
        assert result is True
        assert "element1" not in bpmn_state.locks
    
    @pytest.mark.asyncio
    async def test_lock_release_non_owner(self, bpmn_state):
        """Test non-owner cannot release lock."""
        await bpmn_state.acquire_lock("element1", "user1")
        result = await bpmn_state.release_lock("element1", "user2")
        assert result is False
        assert bpmn_state.locks["element1"] == "user1"
    
    @pytest.mark.asyncio
    async def test_remove_user_releases_all_locks(self, bpmn_state):
        """Test remove_user removes all locks held by user."""
        await bpmn_state.acquire_lock("element1", "user1")
        await bpmn_state.acquire_lock("element2", "user1")
        await bpmn_state.acquire_lock("element3", "user2")
        
        await bpmn_state.remove_user("user1")
        
        assert "element1" not in bpmn_state.locks
        assert "element2" not in bpmn_state.locks
        assert bpmn_state.locks["element3"] == "user2"
    
    @pytest.mark.asyncio
    async def test_concurrent_lock_acquisition(self, bpmn_state):
        """Test race condition - only one should succeed."""
        tasks = [
            bpmn_state.acquire_lock("element1", f"user{i}")
            for i in range(5)
        ]
        
        results = await asyncio.gather(*tasks)
        assert sum(results) == 1
    
    @pytest.mark.asyncio
    async def test_multiple_users_different_elements(self, bpmn_state):
        """Test multiple users locking different elements."""
        result1 = await bpmn_state.acquire_lock("element1", "user1")
        result2 = await bpmn_state.acquire_lock("element2", "user2")
        
        assert result1 is True
        assert result2 is True
        assert len(bpmn_state.locks) == 2
