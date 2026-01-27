# Testing Guide - Chat Application with Mock API

## Quick Start

### Terminal 1: Start WebSocket Server
```bash
npm run server
```
Expected output:
```
WebSocket server running on ws://localhost:5273
```

### Terminal 2: Start Vite Dev Client
```bash
npm run dev
```
Expected output:
```
VITE v7.1.12  ready in 138 ms
➜  Local:   http://localhost:5173/
```

### Browser: Open http://localhost:5173

---

## Mock Data

### Users
- **Alice** (id: 1) - Current user
- **Bob** (id: 2)
- **Charlie** (id: 3)

### Groups
- Gaming (id: 1) - 3 messages
- Work (id: 2) - 1 message
- Design (id: 3) - Empty

### Private Chats
- Alice ↔ Bob (id: 1) - 1 message
- Alice ↔ Charlie (id: 2) - Empty

## Configuration

### .env (Development - Mock Mode)
```
VITE_USE_MOCK=true
VITE_API_BASE=http://localhost:3000/api
VITE_WS_URL=ws://localhost:5273
```

### .env.production (Production - Real API)
```
VITE_USE_MOCK=false
VITE_API_BASE=https://api.ft-transcendence.com/api
VITE_WS_URL=wss://api.ft-transcendence.com
```

---

## Debugging

### Enable Real API (when ready)
Change `.env`:
```
VITE_USE_MOCK=false
```
Then restart dev server.

### Monitor Network
1. DevTools → Network tab
2. Send message
3. Check XHR requests (when using real API)

### WebSocket Events
DevTools → Console:
- `WebSocket connected!`
- `Received message: ...`
- `Broadcasted to X clients...`

---

## Test Scenarios

### Scenario 1: Basic Chat Flow
1. Open http://localhost:5173
2. Select "Gaming" group
3. Type "Hello!" and send
4. Verify message appears with "Alice" as sender

### Scenario 2: Multiple Groups
1. Select "Gaming" → see messages
2. Select "Work" → see different messages
3. Select "Gaming" again → see original messages (no loss)

### Scenario 3: Private Chat
1. Select "Direct Messages" → "Chat with Bob"
2. See message from Bob
3. Reply with message
4. Verify conversation flow

---

## Expected Console Logs

**Success Indicators:**
```
Mock API Mode Enabled
Current user: {id: 1, username: "Alice", avatar: "alice"}
WebSocket connected!
User 1 authenticated
User 1 subscribed to group 1
Received message: group_message
```

**Error Indicators:**
```
Failed to fetch current user (API issue)
WebSocket error: ... (Server issue)
Invalid message format (WebSocket issue)
```

---

## Next Steps

When ready to integrate with real backend:
1. Implement API endpoints matching [api.ts](src/api.ts) interface
2. Change `VITE_USE_MOCK=false` in `.env`
3. Update `VITE_API_BASE` to your API URL
4. Messages will automatically use real API instead of mock

---

## Support

If you encounter issues:
1. Check browser console (F12)
2. Check terminal for WebSocket server logs
3. Verify ports are available: `lsof -i :5173` and `lsof -i :5273`
4. Restart both servers if needed
