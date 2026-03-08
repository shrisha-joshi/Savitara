---
description: "Fix Savitara Web: rotating Sanskrit text, notifications, chat, and bookings 500 error — full end-to-end repair"
agent: "agent"
---

# Fix: Savitara Web App — Four Critical Issues

You are repairing four broken areas of the `savitara-web` frontend and its `backend`. Each issue has a confirmed root cause with a precise code location. Apply **all four fixes** in order, verify each one, and do not make unrelated changes.

---

## Issue 1 — Backend 500: `GET /api/v1/bookings/my-bookings` crashes

**Symptom:** Every call to `GET http://localhost:8000/api/v1/bookings/my-bookings` returns HTTP 500. Booking creation succeeds (201), but the list page always shows 0 bookings.

**Root cause:** `_serialize_document()` in `backend/app/api/v1/bookings.py` inserts a new key `doc["id"]` into the dict *while* iterating `doc.keys()`. Python 3 raises `RuntimeError: dictionary changed size during iteration` on every document that has an `_id` field (which is every MongoDB document).

**Exact location:**
```python
# In function _serialize_document()
if isinstance(doc, dict):
    for key in doc.keys():   # ← iterating a live view
        val = doc[key]
        if isinstance(val, ObjectId):
            doc[key] = str(val)
            if key == "_id":
                doc["id"] = doc[key]   # ← adds new key — crashes Python 3 iteration
```

**Fix:** Change `doc.keys()` to `list(doc.keys())` so the iteration works on a snapshot:

```python
if isinstance(doc, dict):
    for key in list(doc.keys()):   # snapshot — safe to add keys during loop
```

**File:** `backend/app/api/v1/bookings.py`
**Function:** `_serialize_document`
**Change:** One line — `for key in doc.keys():` → `for key in list(doc.keys()):`

After the fix, confirm by calling:
```bash
cd backend && python -c "
from app.api.v1.bookings import _serialize_document
from bson import ObjectId
doc = {'_id': ObjectId(), 'status': 'requested'}
_serialize_document(doc)
print('id' in doc and doc['id'] == doc['_id'])  # must print True
"
```

---

## Issue 2 — HeroSection: Sanskrit text circles appear but are static (not rotating)

**Symptom:** The three concentric Sanskrit mantra rings behind the hero image either do not visibly rotate or their text is not rendering.

**Sub-issues (fix all three):**

### 2a. `HeroImage` incorrectly passes `theme` as a DOM prop

The `HeroImage` styled component already receives `theme` automatically via MUI's styled engine. The JSX in `HeroSection.jsx` explicitly passes `theme={theme}` which tries to set `theme` as an HTML attribute on `<img>`, producing React warnings and a potential re-render loop in StrictMode.

**File:** `savitara-web/src/components/hero/HeroSection.jsx`

Remove the `theme={theme}` prop from the `<HeroImage>` JSX:
```jsx
// BEFORE
<HeroImage
  theme={theme}
  src="/assets/images/hero-image1.png"
  ...
/>

// AFTER
<HeroImage
  src="/assets/images/hero-image1.png"
  ...
/>
```

### 2b. SVG `<textPath>` cross-browser: add `xlinkHref` alongside `href`

Safari and some older Chromium builds require the legacy `xlinkHref` attribute on `<textPath>`. Add it alongside the modern `href` in all three circles.

**File:** `savitara-web/src/components/hero/HeroSection.jsx`

For each of the three `<textPath>` elements (inner, middle, outer), change:
```jsx
<textPath href="#circleInner" startOffset="0%">
```
to:
```jsx
<textPath href="#circleInner" xlinkHref="#circleInner" startOffset="0%">
```
(Same pattern for `#circleMiddle` and `#circleOuter`.)

### 2c. `RotatingCircle` needs `overflow: visible` so SVG text outside the div is not clipped

The `RotatingCircle` styled div does not set `overflow`. Browsers default to `overflow: visible` on `<div>`, but some stacking context parents can clip it. Explicitly set it:

**File:** `savitara-web/src/components/hero/HeroSection.jsx`

In the `RotatingCircle` styled component definition, add `overflow: 'visible'` to the style object:
```javascript
const RotatingCircle = styled('div')(({ theme, duration, radius, direction = 'normal' }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  // ... existing width/height/margin styles ...
  overflow: 'visible',   // ← add this line
  animation: `${rotate} ${duration}s linear infinite`,
  // ...
}));
```

---

## Issue 3 — Notifications / Toast popups do not dismiss

**Symptom:** When a booking status updates or a payment notification arrives in `MyBookings`, the Snackbar toast either never appears or appears but never closes automatically.

**Root cause:** In `MyBookings.jsx`, the `<Snackbar>` that displays the `notification` state:
1. Has no `autoHideDuration` so it never auto-closes.
2. Has no `onClose` handler so even manual close does nothing.

**File:** `savitara-web/src/pages/grihasta/MyBookings.jsx`

Find the `<Snackbar>` that renders the `notification` state near the bottom of the JSX. Update it to include both `autoHideDuration` and `onClose`:

```jsx
// BEFORE (missing autoHideDuration and onClose)
<Snackbar
  open={Boolean(notification)}
  anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
>

// AFTER
<Snackbar
  open={Boolean(notification)}
  autoHideDuration={6000}
  onClose={() => setNotification(null)}
  anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
>
```

Also ensure the `Alert` inside the Snackbar has `onClose` so the ✕ button works:
```jsx
<Alert
  onClose={() => setNotification(null)}
  severity={notification?.severity || 'info'}
  sx={{ width: '100%' }}
>
```

---

## Issue 4 — Chat section not working (REST fallback when Redis/WebSocket unavailable)

**Symptom:** The chat page shows errors or no messages. The browser console shows:
```
[WS] WebSocket ticket unavailable (Redis not running). Skipping WebSocket connection in development.
```
Chat must work via REST API even when WebSocket is skipped.

**Root cause:** `Chat.jsx` imports and uses `isConnected` / `isConnecting` from `SocketContext`. When the WebSocket is skipped (Redis down), `isConnected` stays `false` forever. If the chat UI renders an "offline / connecting" overlay based on `isConnected`, it blocks the message input and prevents sending.

**File:** `savitara-web/src/pages/chat/Chat.jsx`

1. Read the current Chat.jsx fully to find where `isConnected` is used to gate the send button or show a blocking overlay.

2. Change any check of the form `disabled={!isConnected}` or `if (!isConnected) return <offline-UI/>` to allow REST-based interaction even when `isConnected === false`:

```jsx
// BEFORE — blocks UI when WebSocket is down
<TextField
  ...
  disabled={!isConnected || sending}
/>
<Button ... disabled={!isConnected || sending || !newMessage.trim()}>

// AFTER — WebSocket optional; REST API works independent of WS
<TextField
  ...
  disabled={sending}
/>
<Button ... disabled={sending || !newMessage.trim()}>
```

3. The connection status indicator (if any) should be informational only — not block the input. Change any hard block into a soft warning banner:
```jsx
{!isConnected && !isConnecting && (
  <Alert severity="warning" sx={{ mb: 1 }}>
    Real-time updates paused. Messages still send via server.
  </Alert>
)}
```

4. Verify that `sendMessage` in `Chat.jsx` uses `api.post('/chat/...')` (REST) rather than depending on the WebSocket socket reference. The REST call should work regardless of WS state.

---

## Issue 5 — Firebase / Google Auth warnings (informational, non-blocking)

**Symptom:** Console shows:
```
Missing or placeholder VITE_FIREBASE_API_KEY – Firebase/Google Auth will be disabled
Missing or placeholder VITE_FIREBASE_PROJECT_ID – Firebase/Google Auth will be disabled
```

**Cause:** `savitara-web/.env` has placeholder values for Firebase config. This is expected in development if you are not using Google OAuth. The app already handles this gracefully (`firebaseAvailable = false`). No code change needed.

**Action for production:** Set real Firebase values in `.env`:
```
VITE_FIREBASE_API_KEY=your-real-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

---

## Execution Order

1. **Fix Issue 1 first** (backend 500) — this unblocks MyBookings showing data.
2. **Fix Issues 2a, 2b, 2c** in a single multi-replace on `HeroSection.jsx`.
3. **Fix Issue 3** — update `MyBookings.jsx` Snackbar.
4. **Fix Issue 4** — read Chat.jsx fully, then patch the disabled guards.
5. Restart the backend (`uvicorn app.main:app --reload`) and refresh the web app (`npm run dev`).
6. Verify:
   - `GET /api/v1/bookings/my-bookings` returns 200 and lists the created booking.
   - Sanskrit circles rotate visibly on the home page.
   - A booking status change or manual `setNotification()` call shows and auto-dismisses the toast.
   - Chat can send and receive messages; the input is not blocked when WebSocket is skipped.

---

## Key File Paths

| Area | File |
|------|------|
| Backend 500 fix | `backend/app/api/v1/bookings.py` → `_serialize_document()` |
| Hero rotation | `savitara-web/src/components/hero/HeroSection.jsx` |
| Notifications | `savitara-web/src/pages/grihasta/MyBookings.jsx` |
| Chat REST fallback | `savitara-web/src/pages/chat/Chat.jsx` |
| WebSocket context | `savitara-web/src/context/SocketContext.jsx` |
| Firebase config | `savitara-web/.env` |
