"""
Pytest configuration and fixtures for backend tests.
"""
import pytest
from app.bpmn_state import BpmnState
from app.main import ConnectionManager


@pytest.fixture
def bpmn_state():
    """Create a fresh BpmnState instance for each test."""
    return BpmnState()


@pytest.fixture
def connection_manager():
    """Create a fresh ConnectionManager instance for each test."""
    return ConnectionManager()


@pytest.fixture
def sample_xml():
    """Provide sample BPMN XML for testing."""
    return """<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
</bpmn:definitions>"""
