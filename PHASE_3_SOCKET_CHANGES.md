# 🔌 Phase 3: Socket.IO Implementation Details

During **Phase 3**, the project was upgraded from a static polling-based system to a **real-time event-driven architecture** using **Socket.IO**. This allows the server to "push" updates to the dashboards instantly.

---

## 🏗️ Backend Changes (Python/Flask)

### 1. [extensions.py](file:///c:/Users/Aananda%20Sagar%20Thapa/OneDrive/Desktop/my%20project/eldercare-ai/backend/app/extensions.py)
- **Initialized `SocketIO`**: Added `socketio = SocketIO(cors_allowed_origins="*")`. This is the core object that manages client connections.

### 2. [app/__init__.py](file:///c:/Users/Aananda%20Sagar%20Thapa/OneDrive/Desktop/my%20project/eldercare-ai/backend/app/__init__.py)
- **Plugin Registered**: Added `socketio.init_app(app)` to the `create_app` factory to tie the socket system into the Flask lifecycle.

### 3. [run.py](file:///c:/Users/Aananda%20Sagar%20Thapa/OneDrive/Desktop/my%20project/eldercare-ai/backend/run.py)
- **Server Startup**: Changed from `app.run()` to `socketio.run(app)`. This is required to support the WebSocket transport protocol alongside standard HTTP.

### 4. [services/scheduler.py](file:///c:/Users/Aananda%20Sagar%20Thapa/OneDrive/Desktop/my%20project/eldercare-ai/backend/app/services/scheduler.py)
- **Real-time Notifications**: Integrated `socketio.emit('new_event', ...)` inside the background scheduler. This allows the server to notify the Caretaker dashboard immediately when a scheduled task (like medication) becomes due.

### 5. [routes/caregiver_events.py](file:///c:/Users/Aananda%20Sagar%20Thapa/OneDrive/Desktop/my%20project/eldercare-ai/backend/app/routes/caregiver_events.py)
- **Event Streaming**: Created this blueprint to handle the logical grouping of real-time events that the Caretaker needs to see.

---

## 🖥️ Frontend Changes (React/Vite)

### 1. `package.json`
- **New Dependency**: Added `socket.io-client` to enable the browser to connect to the backend's WebSocket server.

### 2. [Dashboard.tsx](file:///c:/Users/Aananda%20Sagar%20Thapa/OneDrive/Desktop/my%20project/eldercare-ai/frontend/src/features/caretaker/Dashboard.tsx)
- **Real-time Listener**: Implemented a `useEffect` hook that:
    1. Connects to the backend socket.
    2. Listens for the `new_event` signal.
    3. Automatically refreshes the alerts list or plays a sound/vibration when a new event (like a fall detection or medication acknowledgment) arrives.

---

## 🔄 Real-time Flow Example

1.  **Event Occurs**: A person is detected in the elder's room via `detect.py`.
2.  **Server Listens**: The `detect` route saves an `Event` to the database.
3.  **Socket Emit**: The server calls `socketio.emit('new_event', { type: 'PRESENCE_DETECTED' })`.
4.  **UI Updates**: The Caretaker's React dashboard receives the event and instantly shows a red alert banner without the user needing to refresh the page.
