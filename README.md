# BPMN Collaboration Editor

A real-time collaboration application for BPMN diagrams (Business Process Model and Notation) that allows multiple users to work simultaneously on BPMN diagrams.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Starting the Project](#starting-the-project)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)

## 🎯 Overview

BPMN-Collab is a web-based collaboration platform for simultaneous editing of BPMN diagrams. The project implements an element-locking system that prevents multiple users from editing the same element simultaneously and provides real-time synchronization via WebSockets.

## ✨ Features

- **Real-time Collaboration**: Multiple users can work simultaneously on the same BPMN diagram
- **Element Locking**: Automatic locking of elements during editing
- **Visual Indicators**: Colored overlays show locked elements and their owners
- **WebSocket-based Communication**: Low latency and instant synchronization
- **User Management**: Display of all connected users
- **BPMN 2.0 Support**: Full support for BPMN 2.0 standard

## 🛠 Technology Stack

### Backend
- **FastAPI**: Modern, fast web framework for Python
- **Uvicorn**: ASGI server for asynchronous Python applications
- **WebSockets**: Real-time bidirectional communication
- **pytest**: Testing framework with asynchronous support

### Frontend
- **Vue 3**: Progressive JavaScript framework with Composition API
- **TypeScript**: Type-safe JavaScript development
- **bpmn-js**: BPMN 2.0 rendering and modeling toolkit
- **Vite**: Fast build tool and dev server
- **Vitest**: Unit testing framework for Vite projects

## 🏗 Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Vue 3 Application                       │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │   │  BPMN      │  │  WebSocket │  │  Locking   │     │   │
│  │   │  Editor    │  │  Client    │  │  System    │     │   │
│  │   │ (bpmn-js)  │◄─┤ (Composable)◄─┤(Composable)│     │   │
│  │   └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket (JSON)
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    Backend Server                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              FastAPI Application                     │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │   │ WebSocket  │  │   BPMN     │  │   Lock     │     │   │
│  │   │  Manager   │◄─┤   State    │◄─┤  Manager   │     │   │
│  │   │            │  │            │  │            │     │   │
│  │   └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Component Overview

#### Backend (FastAPI)

1. **Main Application (`main.py`)**
   - WebSocket endpoint for client connections
   - ConnectionManager for broadcast functionality
   - REST API for default BPMN template

2. **BPMN State (`bpmn_state.py`)**
   - Central state management for BPMN XML
   - User management
   - Lock management with thread safety (asyncio.Lock)

3. **Message Types**
   - `init`: Initial data transfer during connection establishment
   - `update_xml`: BPMN diagram has been changed
   - `acquire_lock`: Request to lock an element
   - `release_lock`: Release a locked element
   - `user_join` / `user_leave`: User status updates

#### Frontend (Vue 3 + TypeScript)

1. **Composables** (Reusable Logic)
   - `useWebSocket.ts`: WebSocket connection and message processing
   - `useBpmnLocking.ts`: Element locking logic and command stack interception
   - `useBpmnOverlays.ts`: Visual overlays for locked elements
   - `useBpmnEvents.ts`: Event handlers for user interactions
   - `useBpmnLoader.ts`: BPMN diagram loading and update logic

2. **Services**
   - `messageHandlers.ts`: Processing of incoming WebSocket messages

3. **Components**
   - `BpmnEditor.vue`: Main component with BPMN modeler integration
   - `App.vue`: Root component

### Locking Mechanism

```
┌────────────┐         ┌────────────┐          ┌────────────┐
│   User A   │         │   Server   │          │   User B   │
└─────┬──────┘         └─────┬──────┘          └─────┬──────┘
      │                      │                       │
      │  Click Element       │                       │
      ├─────────────────────►│                       │
      │  acquire_lock        │                       │
      │                      │                       │
      │◄─────────────────────┤                       │
      │  lock_acquired       │                       │
      │                      │                       │
      │                      ├──────────────────────►│
      │                      │  locks_update         │
      │                      │                       │
      │  Modify Element      │                       │
      │                      │                       │
      │                      │    Click Same Element │
      │                      │◄──────────────────────┤
      │                      │    acquire_lock       │
      │                      │                       │
      │                      │──────────────────────►│
      │                      │    lock_denied        │
      │                      │                       │
      │  release_lock        │                       │
      ├─────────────────────►│                       │
      │                      │                       │
      │                      ├──────────────────────►│
      │                      │  locks_update         │
```

**Important Mechanisms:**

- **Command Stack Interception**: Before any modification, the system checks if the user has the necessary locks
- **Automatic Lock Release**: Locks are automatically released when a user loses connection
- **Visual Indicators**: Locked elements are marked with red overlays

## 📦 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.9 or higher)
- **npm** or **yarn**

### Install Backend

```bash
cd backend
pip install -r requirements.txt
```

### Install Frontend

```bash
cd frontend
npm install
```

### Configure Environment Variables

```bash
cd frontend
cp .env.example .env
```

The default configuration connects to `http://localhost:8000` for both API and WebSocket.

## 🚀 Starting the Project

### Start Backend

Open a terminal in the `backend` directory:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend server is now running at `http://localhost:8000`

**Alternative (with Bash script):**
```bash
cd backend
./restart_backend.sh
```

### Start Frontend

Open another terminal in the `frontend` directory:

```bash
cd frontend
npm run dev
```

The application is now available at `http://localhost:5173`

### Testing Multiple Clients

Open multiple browser tabs at `http://localhost:5173` to test the collaboration functionality. You can see in real-time how changes are synchronized between clients.

## 🧪 Tests
### Overview

The test suite focuses on **critical functionality** that could cause regressions:
- **Lock mechanisms** (preventing conflicting edits)
- **WebSocket message handling** (state synchronization)
- **Canvas element protection** (preventing invalid operations)
- **XML validation and loading** (diagram integrity)
### Test Philosophy

These tests are designed to:
- ✅ Catch regressions in critical functionality
- ✅ Verify lock mechanisms work correctly
- ✅ Ensure WebSocket state stays synchronized
- ✅ Validate XML loading and error handling

They are NOT designed to:
- ❌ Achieve 100% code coverage
- ❌ Test UI interactions extensively
- ❌ Replace manual testing completely

### Backend Tests

```bash
cd backend
python -m pytest -v
```

**With Coverage Report:**
```bash
python -m pytest --cov=app --cov-report=html
```

The coverage report will be generated in the `htmlcov/` directory.

### Frontend Tests

```bash
cd frontend
npm run test
```

**With UI:**
```bash
npm run test:ui
```

**With Coverage:**
```bash
npm run test:coverage
```

## 📁 Project Structure

```
bpmn-collab/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI Application & WebSocket Endpoint
│   │   └── bpmn_state.py           # Central State Management
│   ├── tests/
│   │   ├── conftest.py             # Pytest Fixtures
│   │   ├── test_bpmn_state.py      # State Tests
│   │   └── test_websocket_handlers.py  # WebSocket Tests
│   ├── requirements.txt            # Python Dependencies
│   ├── pytest.ini                  # Pytest Configuration
│   └── restart_backend.sh          # Start Script
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── BpmnEditor.vue      # Main Editor Component
│   │   ├── composables/
│   │   │   ├── useWebSocket.ts     # WebSocket Connection
│   │   │   ├── useBpmnLocking.ts   # Locking Logic
│   │   │   ├── useBpmnOverlays.ts  # Overlay Management
│   │   │   ├── useBpmnEvents.ts    # Event Handlers
│   │   │   └── useBpmnLoader.ts    # BPMN Loader
│   │   ├── services/
│   │   │   └── messageHandlers.ts  # Message Processing
│   │   ├── types/
│   │   │   ├── bpmn.types.ts       # BPMN TypeScript Definitions
│   │   │   └── websocket.types.ts  # WebSocket Types
│   │   ├── App.vue                 # Root Component
│   │   └── main.ts                 # Application Entry Point
│   ├── tests/                      # Frontend Tests
│   ├── package.json                # npm Dependencies & Scripts
│   ├── vite.config.ts              # Vite Configuration
│   ├── vitest.config.ts            # Vitest Configuration
│   └── tsconfig.json               # TypeScript Configuration
│
└── README.md                       # This Document
```

## 🔧 Development Notes

### Code Style

**Backend:**
- Python PEP 8 Style Guide
- Type hints for all functions
- Async/await for I/O operations

**Frontend:**
- Follow ESLint configuration
- TypeScript Strict Mode
- Vue 3 Composition API

### Linting

**Frontend:**
```bash
npm run lint        # Check
npm run lint:fix    # Auto-fix
```

## 📝 API Documentation

### WebSocket Messages

#### Client → Server

**update_xml**
```json
{
  "type": "update_xml",
  "xml": "<bpmn:definitions>...</bpmn:definitions>",
  "by": "user_id"
}
```

**acquire_lock**
```json
{
  "type": "acquire_lock",
  "element_id": "Task_123",
  "user_id": "abc123"
}
```

**release_lock**
```json
{
  "type": "release_lock",
  "element_id": "Task_123",
  "user_id": "abc123"
}
```

#### Server → Client

**init**
```json
{
  "type": "init",
  "xml": "<bpmn:definitions>...</bpmn:definitions>",
  "user_id": "abc123",
  "users": [{"id": "abc123"}, {"id": "def456"}],
  "locks": {"Task_123": "def456"}
}
```

**locks_update**
```json
{
  "type": "locks_update",
  "locks": {"Task_123": "user_id"}
}
```

**lock_acquired / lock_denied**
```json
{
  "type": "lock_acquired",
  "element_id": "Task_123",
  "user_id": "abc123"
}
```

### REST Endpoint

**GET /default-bpmn**
- Returns the default BPMN template as XML
- Content-Type: `application/xml`
