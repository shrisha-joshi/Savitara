---
name: scalable
description: Describe when to use this prompt
---
SECTION 0: MASTER AGENT CONTEXT & RULES
◆ READ THIS BEFORE EVERY TASK
You are an elite senior full-stack engineer with deep expertise in real-time systems, distributed architecture, mobile engineering, and trust & safety. You are implementing a production-grade chat platform enhancement project. Every task you execute must be complete, tested, and shippable. You do NOT leave placeholders, TODOs, or half-finished code.

0.1  Non-Negotiable Rules for Every Agent Turn
Always read the existing codebase structure before writing a single line. Run tree or ls to map the project.
Always write the full file — never partial snippets unless explicitly told the file is too large.
Always run linters, type checkers, and tests after each file change. Fix all errors before moving on.
Never break existing functionality. Run the full existing test suite before and after your changes.
Always handle error states: network failures, null data, race conditions, and concurrent users.
Always sanitize user inputs before storing or rendering — XSS, SQL injection, and path traversal are zero-tolerance.
Always enforce auth on every endpoint. Never trust the client. Validate JWTs server-side on every request.
Always write tests for every function you create: unit tests, integration tests, and where specified E2E tests.
Always document your changes: JSDoc/docstring every public function, update the API contract (OpenAPI spec).
Produce real, importable code — no pseudo-code, no ellipsis, no fake data unless seeding.
If a task is ambiguous, choose the most defensive and user-safe interpretation.
Accessibility is not optional: every interactive UI element needs ARIA labels, keyboard handlers, and focus management.

0.2  Stack Assumptions (adjust if your project differs)
Layer
Technology
Notes
Frontend Web
React / Next.js + TypeScript
Tailwind CSS, Zustand or Redux Toolkit
Frontend Mobile
React Native + Expo
Expo AV, Expo Notifications, AsyncStorage
Backend
Node.js / Express or NestJS + TypeScript
Or Python FastAPI — adapt as needed
Database
PostgreSQL (primary) + Redis (cache/rate-limit)
Prisma or TypeORM ORM
Real-time
Socket.IO or native WebSocket
Horizontal scaling via Redis Pub/Sub adapter
Object Storage
AWS S3 (or compatible)
CloudFront CDN for media delivery
Auth
JWT Access + Refresh tokens
HttpOnly cookies for refresh token
Testing
Vitest/Jest (unit) + Supertest (API) + Playwright (E2E)
Coverage threshold: 80%
CI/CD
GitHub Actions
Lint → Type → Test → Build → Deploy



SECTION 1: DATABASE SCHEMA — Complete Implementation
◆ RUN ALL MIGRATIONS IN ORDER. NEVER SKIP. NEVER USE RAW ALTER TABLE IN PRODUCTION WITHOUT A MIGRATION FILE.
1.1  Message Reactions Schema
Create a new migration file. The reactions table must enforce uniqueness per user per emoji per message.
-- Migration: 001_create_message_reactions.sql
CREATE TABLE message_reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji         VARCHAR(8) NOT NULL,          -- store Unicode emoji
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)        -- enforce one reaction per user per emoji
);
CREATE INDEX idx_reactions_message ON message_reactions(message_id);

1.2  Conversation User Settings Schema
Per-user, per-conversation settings. These override global notification defaults.
CREATE TABLE conversation_user_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  pin_rank            INTEGER,                -- lower = higher in list
  is_archived         BOOLEAN NOT NULL DEFAULT FALSE,
  muted_until         TIMESTAMPTZ,           -- NULL means not muted
  notifications_on    BOOLEAN NOT NULL DEFAULT TRUE,
  last_read_at        TIMESTAMPTZ,
  UNIQUE (conversation_id, user_id)
);

1.3  Block List Schema
CREATE TABLE user_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

1.4  Reports Schema
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id      UUID REFERENCES messages(id) ON DELETE SET NULL,
  reason          VARCHAR(64) NOT NULL,  -- enum: SPAM, HARASSMENT, INAPPROPRIATE, OTHER
  detail          TEXT,
  status          VARCHAR(32) NOT NULL DEFAULT 'PENDING',  -- PENDING, REVIEWED, ACTIONED, DISMISSED
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_status ON reports(status, created_at DESC);

1.5  Voice Messages Extension
Extend the messages table to support voice messages. Use ALTER TABLE in a migration — never destructive.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type  VARCHAR(32) NOT NULL DEFAULT 'text',
  -- values: text | voice | image | video | file | forwarded
  ADD COLUMN IF NOT EXISTS media_url     TEXT,
  ADD COLUMN IF NOT EXISTS media_mime    VARCHAR(64),
  ADD COLUMN IF NOT EXISTS media_duration_s INTEGER,  -- voice/video duration in seconds
  ADD COLUMN IF NOT EXISTS media_waveform JSONB,      -- optional waveform data []float
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id UUID REFERENCES messages(id),
  ADD COLUMN IF NOT EXISTS forwarded_from_sender_name TEXT,
  ADD COLUMN IF NOT EXISTS forwarded_from_room_name   TEXT;

1.6  Group Chat Roles & Room Metadata
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS room_type     VARCHAR(32) DEFAULT 'direct',
  -- values: direct | private_group | acharya_group | community
  ADD COLUMN IF NOT EXISTS allow_forward_out BOOLEAN DEFAULT TRUE;


CREATE TABLE conversation_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              VARCHAR(32) NOT NULL DEFAULT 'member', -- owner | admin | member
  muted_until       TIMESTAMPTZ,
  banned_until      TIMESTAMPTZ,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);


CREATE TABLE room_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_id        UUID NOT NULL REFERENCES users(id),
  target_id       UUID REFERENCES users(id),
  action          VARCHAR(64) NOT NULL, -- mute_user | ban_user | delete_message | pin_message | lock_room
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


SECTION 2: BACKEND API — Complete Endpoint Specifications
◆ IMPLEMENT EVERY ENDPOINT BELOW. WRITE ROUTER + CONTROLLER + SERVICE + TEST FILE FOR EACH GROUP.
2.1  Message Reactions API
File: src/routes/reactions.ts (or reactions.py). Mount at /api/v1/reactions.

Method
Path
Auth
Description
POST
/api/v1/messages/:messageId/reactions
JWT required
Add a reaction. Body: { emoji: string }. Idempotent — if exists, return 200 not 409.
DELETE
/api/v1/messages/:messageId/reactions/:emoji
JWT required
Remove caller's reaction. Returns 204. No-op if not found.
GET
/api/v1/messages/:messageId/reactions
JWT required
Return aggregated reactions: [{ emoji, count, reacted_by_me }]. Grouped.


2.1.1  Reactions Service Logic (pseudo-typed)
// service/reactions.service.ts
async addReaction(messageId: string, userId: string, emoji: string): Promise<ReactionSummary[]> {
  // 1. Validate emoji is in ALLOWED_EMOJI_SET (whitelist of ~200 common emojis)
  // 2. Check user has access to the conversation containing this message
  // 3. Check user is not blocked by message sender
  // 4. Upsert into message_reactions (ON CONFLICT DO NOTHING)
  // 5. Emit socket event: reaction_added { messageId, emoji, userId, reactions: [] }
  // 6. Return aggregated reaction summary for the message
}

2.2  Conversation Settings API
Method
Path
Description
GET
/api/v1/conversations/:id/settings
Return caller's settings for this conversation
PATCH
/api/v1/conversations/:id/settings
Update is_pinned, is_archived, muted_until, notifications_on
POST
/api/v1/conversations/:id/pin
Pin conversation (set is_pinned=true, assign pin_rank)
DELETE
/api/v1/conversations/:id/pin
Unpin conversation
POST
/api/v1/conversations/:id/archive
Archive conversation
DELETE
/api/v1/conversations/:id/archive
Unarchive conversation
POST
/api/v1/conversations/:id/mute
Mute: body { until: ISO8601 | null } — null = indefinite
DELETE
/api/v1/conversations/:id/mute
Unmute conversation


⚠ PATCH /settings is the canonical endpoint. The named POST/DELETE endpoints are convenience aliases — all must update the same conversation_user_settings row. Never update another user's settings.

2.3  Block & Report API
Method
Path
Description
POST
/api/v1/users/:id/block
Block a user. Creates user_blocks row. Enforce on all message delivery.
DELETE
/api/v1/users/:id/block
Unblock user. Removes row.
GET
/api/v1/users/blocked
Return caller's block list with user summaries.
POST
/api/v1/reports
Submit report. Body: { message_id?, reported_user_id?, reason, detail? }
GET
/api/v1/admin/reports
ADMIN ONLY. List reports by status. Pagination: cursor + limit.
PATCH
/api/v1/admin/reports/:id
ADMIN ONLY. Update status and reviewer notes.


2.3.1  Block Enforcement Middleware
// middleware/block-check.middleware.ts
// Apply to: POST /messages, all socket 'send_message' events
async function enforceBlockCheck(req, res, next) {
  const { senderId, conversationId } = extractContext(req);
  const participants = await getConversationParticipants(conversationId);
  const isBlocked = await db.userBlocks.findFirst({
    where: { OR: [
      { blocker_id: senderId, blocked_id: { in: participants } },
      { blocked_id: senderId, blocker_id: { in: participants } }
    ]}
  });
  if (isBlocked) return res.status(403).json({ code: 'BLOCKED', message: 'Cannot send to blocked user' });
  next();
}

2.4  Voice Messages API
Method
Path
Description
POST
/api/v1/voice/upload-url
Request presigned S3 PUT URL. Body: { mimeType, fileSizeBytes }. Validate size <= 10MB.
POST
/api/v1/messages/voice
After S3 upload, create message record. Body: { conversationId, s3Key, mimeType, durationSeconds, waveform? }


2.4.1  Server-side Transcoding (Background Worker)
// workers/voice-transcode.worker.ts
// Triggered by SQS/BullMQ job after upload confirmation
async function transcodeVoice(job: { s3Key: string, messageId: string }) {
  // 1. Download raw file from S3 to /tmp
  // 2. Run: ffmpeg -i input.webm -c:a libopus -b:a 48k output.ogg
  // 3. Upload .ogg to S3 output key
  // 4. Update message record: media_url = CDN URL, media_mime = audio/ogg
  // 5. Delete /tmp files
  // 6. Emit socket event: voice_message_ready { messageId, url, duration }
}

2.5  Forwarded Messages API
Method
Path
Description
POST
/api/v1/messages/forward
Forward message(s) to target conversations. Body: { messageIds[], targetConversationIds[] }

Forward Validation Rules — Implement ALL of these
Max 5 target conversations per forward request to prevent spam.
If source conversation has allow_forward_out = false, return 403.
Verify caller is a member of the source conversation.
Verify caller is a member of all target conversations.
Strip media attachments if target conversation does not allow external media.
Store forwarded_from_message_id, forwarded_from_sender_name, forwarded_from_room_name on the new message row.
Emit socket event message_forwarded to all target conversation participants.

2.6  Group Chat Admin API
Method
Path
Auth
Description
POST
/api/v1/conversations/:id/members/:userId/mute
admin/owner
Mute member. Body: { until: ISO8601 }
DELETE
/api/v1/conversations/:id/members/:userId/mute
admin/owner
Unmute member
POST
/api/v1/conversations/:id/members/:userId/ban
admin/owner
Ban member. Body: { until: ISO8601 | null }
DELETE
/api/v1/conversations/:id/members/:userId
admin/owner
Remove member from group
PATCH
/api/v1/conversations/:id/members/:userId/role
owner only
Change role. Body: { role: admin | member }
DELETE
/api/v1/conversations/:id/messages/:msgId
admin/owner/sender
Delete message. Soft delete — set deleted_at.
POST
/api/v1/conversations/:id/messages/:msgId/pin
admin/owner
Pin message to room.
PATCH
/api/v1/conversations/:id/lock
owner only
Lock/unlock room. Body: { locked: bool }



SECTION 3: REAL-TIME SOCKET EVENTS — Full Specification
◆ EVERY SOCKET EVENT MUST BE VALIDATED SERVER-SIDE. NEVER TRUST CLIENT PAYLOAD SHAPES.
3.1  Complete Socket Event Catalogue
Direction
Event Name
Payload
Notes
Client → Server
send_message
{ conversationId, text?, type, tempId }
Server validates auth, block, mute. Emits back with server ID.
Client → Server
add_reaction
{ messageId, emoji }
Server persists and broadcasts reaction_added to room.
Client → Server
remove_reaction
{ messageId, emoji }
Server deletes and broadcasts reaction_removed to room.
Client → Server
typing_start
{ conversationId }
Server broadcasts typing_indicator to room. Debounce 3s TTL.
Client → Server
mark_read
{ conversationId, messageId }
Server updates last_read_at in conversation_user_settings.
Client → Server
forward_message
{ messageIds[], targetConversationIds[] }
Server validates, creates new messages, broadcasts.
Server → Client
message_new
{ id, conversationId, senderId, text?, type, mediaUrl?, tempId? }
Delivered to all room participants.
Server → Client
reaction_added
{ messageId, emoji, userId, reactions: ReactionSummary[] }
Delivered to room. Client replaces full reaction array.
Server → Client
reaction_removed
{ messageId, emoji, userId, reactions: ReactionSummary[] }
Same as above.
Server → Client
typing_indicator
{ conversationId, userId, displayName }
TTL 3s — client clears after timeout.
Server → Client
message_deleted
{ messageId, conversationId, deletedAt }
Soft delete — client hides message.
Server → Client
message_pinned
{ messageId, conversationId }
Client updates pinned message banner.
Server → Client
voice_message_ready
{ messageId, mediaUrl, duration }
After transcoding completes.
Server → Client
user_blocked
{ blockedUserId }
Private — delivered only to blocker.
Server → Client
room_locked
{ conversationId, locked }
Broadcast to room members. Client disables input.
Server → Client
member_role_changed
{ conversationId, userId, newRole }
Client updates role badge.
Server → Client
presence_update
{ userId, status: online | away | offline }
Throttle: max 1 per user per 5s.


3.2  Socket Authentication Middleware
// socket/auth.middleware.ts
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
  if (!token) return next(new Error('UNAUTHORIZED'));
  try {
    const payload = await verifyJWT(token);  // throws on expired/invalid
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    next();
  } catch (err) {
    next(new Error('INVALID_TOKEN'));
  }
});

3.3  Horizontal Scaling — Redis Pub/Sub Adapter
// socket/index.ts — required for multi-pod deployments
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));


SECTION 4: FRONTEND WEB — Complete Component Specifications
◆ EVERY COMPONENT: TYPESCRIPT STRICT MODE, FULL PROP TYPES, ARIA LABELS, KEYBOARD NAV, ERROR BOUNDARIES.
4.1  Emoji Picker Component
// Install: npm install emoji-mart @emoji-mart/react @emoji-mart/data
// File: components/chat/EmojiPickerButton.tsx


import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useState, useRef, useCallback } from 'react';


interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;  // to restore cursor
}


export function EmojiPickerButton({ onSelect, inputRef }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(
    () => JSON.parse(localStorage.getItem('recentEmojis') || '[]')
  );


  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    // Insert at cursor position in textarea
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const newVal = input.value.slice(0, start) + emoji.native + input.value.slice(end);
      // Dispatch synthetic change event for React state sync
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(input, newVal);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.setSelectionRange(start + emoji.native.length, start + emoji.native.length);
      input.focus();
    }
    // Persist recent
    const updated = [emoji.native, ...recentEmojis.filter(e => e !== emoji.native)].slice(0, 16);
    setRecentEmojis(updated);
    localStorage.setItem('recentEmojis', JSON.stringify(updated));
    onSelect(emoji.native);
    setOpen(false);
  }, [inputRef, recentEmojis, onSelect]);


  return (
    <div className='relative'>
      <button aria-label='Open emoji picker' aria-expanded={open} onClick={() => setOpen(o => !o)}
        className='p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500'>
        &#128512;
      </button>
      {open && (
        <div className='absolute bottom-12 right-0 z-50 shadow-2xl rounded-xl overflow-hidden'
          role='dialog' aria-label='Emoji picker' aria-modal='true'>
          <Picker data={data} onEmojiSelect={handleEmojiSelect} recent={recentEmojis}
            theme='light' previewPosition='none' skinTonePosition='search' />
        </div>
      )}
    </div>
  );
}

4.2  Message Reaction Chips Component
// File: components/chat/MessageReactions.tsx
interface ReactionSummary { emoji: string; count: number; reactedByMe: boolean; }


export function MessageReactions({
  messageId, reactions, onAdd, onRemove
}: { messageId: string; reactions: ReactionSummary[]; onAdd: (e:string)=>void; onRemove: (e:string)=>void }) {
  if (!reactions.length) return null;


  const SHOW_LIMIT = 4;
  const visible = reactions.slice(0, SHOW_LIMIT);
  const overflow = reactions.length - SHOW_LIMIT;


  return (
    <div className='flex flex-wrap gap-1 mt-1' role='group' aria-label='Message reactions'>
      {visible.map(r => (
        <button key={r.emoji}
          onClick={() => r.reactedByMe ? onRemove(r.emoji) : onAdd(r.emoji)}
          aria-label={`${r.emoji} ${r.count} reactions, ${r.reactedByMe ? 'click to remove' : 'click to add'}`}
          aria-pressed={r.reactedByMe}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-sm
            transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500
            ${r.reactedByMe ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
          <span aria-hidden='true'>{r.emoji}</span>
          <span className='font-medium'>{r.count}</span>
        </button>
      ))}
      {overflow > 0 && <span className='text-xs text-gray-500 self-center'>+{overflow}</span>}
    </div>
  );
}

4.3  Voice Message Recorder Component
// File: components/chat/VoiceRecorder.tsx
// Uses: MediaRecorder API (web) with fallback detection


const MAX_DURATION_SECONDS = 90;


export function VoiceRecorder({ onSend, onCancel }: {
  onSend: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'preview' | 'uploading'>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);


  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/ogg;codecs=opus';
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setAudioBlob(blob);
      stream.getTracks().forEach(t => t.stop());
      setState('preview');
    };
    recorder.start(250);  // collect chunks every 250ms
    setState('recording');
    timerRef.current = window.setInterval(() => {
      setDuration(d => {
        if (d + 1 >= MAX_DURATION_SECONDS) stopRecording();
        return d + 1;
      });
    }, 1000);
  };
  // stopRecording, handleSend, handleCancel... (implement fully)
}

4.4  Conversation Settings Panel
// File: components/chat/ConversationSettingsPanel.tsx
// Trigger: gear icon or long press on conversation in list
// Options to render:
//   [ ] Pin to top    [ ] Archive    [ ] Mute (duration picker: 1h | 8h | 24h | 7d | forever)
//   [ ] Notifications toggle    [ ] Block user (1:1 only)    [ ] Report
//   [ ] Leave group (group only)    [ ] View members (group only)

⚠ Mute durations: 1 hour, 8 hours, 1 day, 1 week, indefinite. Store as absolute timestamp (muted_until). Show remaining mute time in conversation list badge.

4.5  Optimistic UI Pattern — Message Send
// In your message send handler:
const sendMessage = async (text: string) => {
  const tempId = `temp_${Date.now()}_${Math.random()}`;
  const optimisticMsg: Message = { id: tempId, text, status: 'sending', senderId: currentUser.id, ... };
  // 1. Immediately add to local state
  dispatch(addMessage(optimisticMsg));
  // 2. Scroll to bottom
  scrollToBottom();
  try {
    const response = await socket.emitWithAck('send_message', { text, conversationId, tempId });
    // 3. Replace temp message with server-confirmed message
    dispatch(confirmMessage({ tempId, serverMessage: response }));
  } catch (err) {
    // 4. Mark as failed — show retry button
    dispatch(failMessage({ tempId, error: err.message }));
  }
};


SECTION 5: REACT NATIVE / MOBILE — Specifications
◆ TEST ON BOTH IOS AND ANDROID SIMULATORS. EVERY FEATURE MUST WORK ON BOTH PLATFORMS.
5.1  Voice Recording — Expo AV
// Install: expo install expo-av
// File: components/chat/VoiceRecorderNative.tsx
import { Audio } from 'expo-av';


const startRecording = async () => {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY  // AAC, 44.1kHz
  );
  recordingRef.current = recording;
  // Listen to status updates for duration
  recording.setOnRecordingStatusUpdate(status => {
    if (status.isDoneRecording) return;
    setDurationMs(status.durationMillis);
    if (status.durationMillis >= MAX_DURATION_SECONDS * 1000) stopRecording();
  });
};

5.2  Push Notifications — Expo Notifications
// File: services/push.service.ts
import * as Notifications from 'expo-notifications';


// Configure notification behavior (call at app start):
Notifications.setNotificationHandler({
  handleNotification: async (notification) => ({
    shouldShowAlert: true,
    shouldPlaySound: !isMuted(notification.request.content.data?.conversationId),
    shouldSetBadge: true,
  }),
});


// Register device token and send to backend:
export async function registerPushToken(userId: string) {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') return null;
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
  await api.post('/users/push-token', { token: token.data, platform: Platform.OS });
  return token.data;
}

5.3  Offline Queue — React Native
// File: services/offline-queue.service.ts
// Use: NetInfo to detect connectivity. Queue messages in AsyncStorage.
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';


const QUEUE_KEY = 'offline_message_queue';


export async function queueMessage(msg: PendingMessage) {
  const current = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]');
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...current, msg]));
}


export function startQueueDrainer(socket: Socket) {
  NetInfo.addEventListener(async state => {
    if (!state.isConnected) return;
    const queue = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY) || '[]');
    for (const msg of queue) {
      try { await socket.emitWithAck('send_message', msg); }
      catch { break; }  // Stop on failure, retry next reconnect
    }
    await AsyncStorage.removeItem(QUEUE_KEY);
  });
}


SECTION 6: SECURITY & PRIVACY — Zero Tolerance
◆ THESE ARE NON-NEGOTIABLE. ANY DEPLOYMENT WITHOUT THESE IS INSECURE.
6.1  Input Sanitization
// Install: npm install dompurify isomorphic-dompurify
// Apply to: ALL user-provided text before storing and before rendering


// Backend (store sanitized):
import DOMPurify from 'isomorphic-dompurify';
const clean = DOMPurify.sanitize(rawText, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
// Store `clean` — never store raw user text


// Frontend (render sanitized HTML if rich text):
import DOMPurify from 'dompurify';
// If rendering as HTML: dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }}
// Prefer: render as plain text (no HTML) whenever possible

6.2  Rate Limiting
// Install: npm install express-rate-limit rate-limit-redis
// File: middleware/rate-limit.middleware.ts


const messageSendLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,              // 30 messages per minute per user
  keyGenerator: req => req.auth?.userId ?? req.ip,
  handler: (req, res) => res.status(429).json({ code: 'RATE_LIMITED', retryAfter: 60 }),
  store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) }),
});


const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }); // auth endpoints
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });     // media uploads

6.3  JWT Refresh Strategy
// Access token: 15 minutes TTL
// Refresh token: 7 days TTL, HttpOnly Secure SameSite=Strict cookie


// Axios interceptor (web):
axiosInstance.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && !error.config._retry) {
    error.config._retry = true;
    await api.post('/auth/refresh');  // uses HttpOnly cookie automatically
    return axiosInstance(error.config);  // retry original request
  }
  return Promise.reject(error);
});

6.4  Media Security
Control
Implementation
File size limit
Server: enforce <= 10MB for voice, <= 25MB for images, <= 100MB for video BEFORE accepting upload
MIME type validation
Check Content-Type header AND magic bytes (use file-type npm package). Reject mismatch.
Presigned URLs
Expire in 10 minutes. Validate file size in Content-Length header before issuing.
Virus scanning
Integrate ClamAV or AWS Macie on the S3 bucket trigger. Quarantine on detection.
CDN delivery
Serve media via CloudFront. Never expose S3 bucket URLs directly.
Access control
Presigned GET URLs expire in 1 hour. Regenerate per request. Store only S3 key, not full URL.


6.5  Privacy: PII Masking in Logs
// Never log: message text, user email, phone, full name, media content
// Log: userId (hashed), conversationId, event type, timestamp, status code


// pino logger redaction config:
const logger = pino({
  redact: {
    paths: ['body.text', 'body.email', 'body.phone', '*.password', '*.token'],
    censor: '[REDACTED]'
  }
});


SECTION 7: TESTING — Comprehensive Strategy
◆ EVERY FEATURE REQUIRES: UNIT TESTS + INTEGRATION TESTS. CRITICAL FLOWS REQUIRE E2E TESTS.
7.1  Unit Test Requirements
Module
Test File
Must Cover
ReactionsService
reactions.service.spec.ts
addReaction, removeReaction, aggregate summary, emoji whitelist validation, block check
ConversationSettingsService
conversation-settings.service.spec.ts
pin, unpin, archive, mute (all durations), mute expiry, settings isolation per user
BlockService
block.service.spec.ts
block, unblock, list, enforcement on send, bidirectional check
ReportService
report.service.spec.ts
create, validate required fields, admin list with status filter, pagination
VoiceService
voice.service.spec.ts
presigned URL generation, size enforcement, MIME validation, message creation
ForwardService
forward.service.spec.ts
privacy checks, target limit, forwarded_from metadata, strip-attachment logic
RateLimiter
rate-limit.spec.ts
30 msg/min enforcement, 429 response, Redis key structure
BlockMiddleware
block-check.middleware.spec.ts
allows non-blocked, blocks when user_blocks row exists, both directions


7.2  API Integration Tests
// File: tests/integration/reactions.integration.spec.ts
// Use: supertest + test database (separate schema or Docker Compose)


describe('POST /api/v1/messages/:id/reactions', () => {
  it('should add a reaction and return 200', async () => { ... });
  it('should be idempotent — second add returns 200 not 409', async () => { ... });
  it('should return 401 without auth token', async () => { ... });
  it('should return 403 if user is blocked by sender', async () => { ... });
  it('should return 400 if emoji not in whitelist', async () => { ... });
  it('should emit reaction_added socket event to room', async () => { ... });
});

7.3  E2E Tests — Playwright
// File: tests/e2e/chat.spec.ts
// Run: npx playwright test --project=chromium


test('happy path: send message, react, retry on failure', async ({ page }) => {
  await loginAs(page, 'user_a');
  await page.goto('/chat/conversation_123');
  // Send message
  await page.fill('[data-testid=message-input]', 'Hello world');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid=message-bubble]').last()).toContainText('Hello world');
  // React to last message
  await page.hover('[data-testid=message-bubble]').last());
  await page.click('[data-testid=reaction-trigger]');
  await page.click('[data-testid=emoji-thumbs-up]');
  await expect(page.locator('[data-testid=reaction-chip]')).toContainText('1');
});


// Additional required E2E tests:
// - Auth flow (login, token refresh, logout)
// - Pin / unpin conversation
// - Mute conversation (verify no notification badge)
// - Report a message (form submission)
// - Block user (verify send blocked)
// - Voice message record and send
// - Forward message to another conversation
// - Admin: delete message, mute member

7.4  Load Testing — Locust
# File: tests/load/chat_load.py
from locust import HttpUser, task, between


class ChatUser(HttpUser):
    wait_time = between(0.5, 2)


    @task(5)
    def send_message(self):
        self.client.post('/api/v1/messages', json={
            'conversationId': self.conversation_id,
            'text': 'load test message'
        }, headers=self.auth_headers)


    @task(2)
    def react_to_message(self): ...


    @task(1)
    def get_conversation(self): ...


# Target: 1000 concurrent users, 95th percentile < 200ms for message send
# Run: locust -f tests/load/chat_load.py --host=https://staging.yourapp.com


SECTION 8: CI/CD PIPELINE — GitHub Actions
◆ EVERY PR MUST PASS THE FULL PIPELINE BEFORE MERGE. NO EXCEPTIONS.
8.1  Complete GitHub Actions Workflow
# File: .github/workflows/ci.yml
name: CI
on: [push, pull_request]


jobs:
  lint-and-type:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint           # ESLint + Prettier check
      - run: npm run type-check      # tsc --noEmit


  unit-tests:
    needs: lint-and-type
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - name: Enforce coverage threshold
        run: |
          COVERAGE=$(node -e "const c=require('./coverage/coverage-summary.json'); console.log(c.total.lines.pct)")
          echo "Coverage: $COVERAGE%"
          node -e "if($COVERAGE < 80) { process.exit(1); }"


  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_DB: testdb, POSTGRES_PASSWORD: test } }
      redis: { image: redis:7 }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run db:migrate:test
      - run: npm run test:integration


  e2e-tests:
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }


  openapi-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx @apidevtools/swagger-cli validate openapi.yaml


SECTION 9: PERFORMANCE & SCALABILITY
◆ DESIGN FOR 10X EXPECTED LOAD FROM DAY ONE. PREMATURE OPTIMIZATION IS BAD; NEGLECTING SCALE IS WORSE.
9.1  Database Indexes — Add ALL of These
-- Required indexes (add to a new migration):
CREATE INDEX CONCURRENTLY idx_messages_conv_created
  ON messages(conversation_id, created_at DESC);


CREATE INDEX CONCURRENTLY idx_conversations_participants
  ON conversation_members(user_id, conversation_id);


CREATE INDEX CONCURRENTLY idx_messages_type
  ON messages(conversation_id, message_type) WHERE message_type != 'text';


CREATE INDEX CONCURRENTLY idx_reactions_message
  ON message_reactions(message_id);


CREATE INDEX CONCURRENTLY idx_blocks_lookup
  ON user_blocks(blocker_id, blocked_id);

9.2  Cursor-Based Pagination
// ALL list endpoints must use cursor-based pagination — no OFFSET
// File: utils/paginate.ts


interface PaginationParams { cursor?: string; limit?: number; }
interface PaginationResult<T> { data: T[]; nextCursor: string | null; hasMore: boolean; }


// Example: paginate messages
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;


async function getMessages(conversationId: string, params: PaginationParams) {
  const limit = Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const cursorDate = params.cursor ? new Date(Buffer.from(params.cursor, 'base64').toString()) : new Date();
  const messages = await db.messages.findMany({
    where: { conversationId, createdAt: { lt: cursorDate } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,  // fetch one extra to determine hasMore
  });
  const hasMore = messages.length > limit;
  const data = messages.slice(0, limit);
  const nextCursor = hasMore ? Buffer.from(data[data.length-1].createdAt.toISOString()).toString('base64') : null;
  return { data, nextCursor, hasMore };
}

9.3  Redis Caching Strategy
Data
Cache Key Pattern
TTL
Invalidation
User presence
presence:{userId}
30s
On disconnect / heartbeat miss
Conversation meta
conv_meta:{conversationId}
5 min
On any conv update
Block list
blocks:{userId}
5 min
On block/unblock
Reaction summary
reactions:{messageId}
60s
On any reaction change
Rate limit counters
rl:{userId}:{window}
Rolling 60s
Sliding window
Unread counts
unread:{userId}:{convId}
No TTL
On mark_read or new message


9.4  Object Storage — Media Delivery Pattern
// NEVER store S3 presigned URLs in the database — they expire
// ALWAYS store the S3 key and generate presigned GET URLs on-demand


// File: services/media.service.ts
async function getMediaUrl(s3Key: string): Promise<string> {
  // Check Redis cache first
  const cached = await redis.get(`media_url:${s3Key}`);
  if (cached) return cached;
  // Generate presigned URL
  const url = await s3.getSignedUrlPromise('getObject', {
    Bucket: process.env.S3_MEDIA_BUCKET,
    Key: s3Key,
    Expires: 3600  // 1 hour
  });
  // Cache for 50 minutes (expire before S3 URL does)
  await redis.setex(`media_url:${s3Key}`, 3000, url);
  return url;
}


SECTION 10: ACCESSIBILITY — WCAG 2.1 AA Compliance
◆ TEST WITH SCREEN READER (NVDA/VOICEOVER) AND KEYBOARD-ONLY NAVIGATION BEFORE MARKING ANY UI TASK DONE.
10.1  Required ARIA Patterns
Component
Required ARIA
Message input
role='textbox', aria-label='Message', aria-multiline='true', aria-required='true'
Send button
aria-label='Send message', aria-disabled when input empty
Emoji picker button
aria-label='Open emoji picker', aria-expanded, aria-controls='emoji-picker-dialog'
Reaction chips
role='group', aria-label='Message reactions'. Each chip: aria-pressed, aria-label='{emoji} {N} reactions'
Voice recorder
aria-label='Record voice message', aria-live='polite' for duration display
Message list
role='log', aria-live='polite', aria-relevant='additions'
Conversation list
role='list'. Each item: role='listitem', aria-current for active
Settings panel
role='dialog', aria-modal='true', aria-labelledby, focus trap
Typing indicator
aria-live='polite', aria-atomic='true'. Announce: '{name} is typing'
Unread badge
aria-label='{N} unread messages' — screen reader readable


10.2  Keyboard Shortcuts
Shortcut
Action
Enter
Send message (default)
Shift+Enter
New line in message input
Ctrl+Enter / Cmd+Enter
Alternative send (configurable)
Escape
Close any open panel (emoji picker, settings, reaction picker)
Tab / Shift+Tab
Navigate interactive elements in focus order
Arrow keys
Navigate emoji picker grid; navigate reaction chips
Space / Enter on reaction chip
Toggle reaction
/ (slash)
Open command palette (if implemented)



SECTION 11: NOTIFICATIONS SYSTEM — Full Specification
11.1  Notification Decision Tree
Before sending any push or email notification, apply this decision chain in order:
Is the user currently active in the conversation (socket room)? If YES → skip push, show in-app badge only.
Is the conversation muted? Check muted_until > NOW(). If YES → skip push entirely.
Does user have notifications_on = false for this conversation? If YES → skip push.
Does user have a registered push token? If NO → fall back to email digest (if enabled).
Is the message type a community broadcast? If YES → apply digest batching (max 1 push per 10 min per room).
All checks passed → send push notification.

11.2  Notification Payload Structure
// Backend: notifications.service.ts
interface PushPayload {
  to: string;           // Expo push token or FCM token
  title: string;        // 'Alice in Family Chat'
  body: string;         // Message preview (truncated at 100 chars)
  data: {
    conversationId: string;
    messageId: string;
    type: 'message' | 'reaction' | 'mention' | 'admin_announcement';
  };
  sound: 'default' | null;
  badge: number;        // Total unread count across all conversations
}


// IMPORTANT: Never include full message text in push payload
// for privacy-sensitive rooms. Truncate and check room settings.


SECTION 12: IMPLEMENTATION ORDER — Phased Batches
◆ EXECUTE BATCHES IN ORDER. NEVER START BATCH N+1 UNTIL BATCH N IS FULLY TESTED AND PASSING CI.
Batch 1 — Foundation (Week 1-2)
#
Task
Files to Create/Modify
Done When
1.1
All DB migrations
migrations/001 through 006
All migrations run cleanly on clean DB
1.2
Reactions backend (service + API + socket)
reactions.service.ts, reactions.router.ts, socket handlers
All unit + integration tests pass
1.3
Reactions frontend (chips + picker)
MessageReactions.tsx, EmojiPickerButton.tsx
Visible in chat, keyboard accessible
1.4
Conversation settings backend
conversation-settings.service.ts, settings.router.ts
PATCH settings endpoint returns correct data
1.5
Conversation settings UI panel
ConversationSettingsPanel.tsx, useConversationSettings.ts
Pin/archive/mute visible and functional
1.6
Block/Report backend
block.service.ts, report.service.ts, respective routers
Block enforced on send, report stored
1.7
CI pipeline scaffold
.github/workflows/ci.yml
All jobs green on main branch


Batch 2 — Media & Forwarding (Week 3-4)
#
Task
Files to Create/Modify
Done When
2.1
Voice messages backend (presign, worker, socket)
voice.service.ts, voice.router.ts, transcode.worker.ts
Voice sent and played end-to-end
2.2
Voice recorder web
VoiceRecorder.tsx
Records, previews, uploads, displays waveform
2.3
Voice recorder mobile
VoiceRecorderNative.tsx
Works on iOS + Android
2.4
Message forwarding backend + UI
forward.service.ts, ForwardDialog.tsx
Privacy checks pass, forwarded_from shown in UI
2.5
Optimistic UI + offline queue
useOptimisticMessages.ts, offline-queue.service.ts
Send, fail, retry flow works offline
2.6
Playwright E2E suite
tests/e2e/*.spec.ts
10+ E2E tests passing in CI


Batch 3 — Groups, Admin & Call (Week 5-6)
#
Task
Files to Create/Modify
Done When
3.1
Group chat roles backend
group-admin.service.ts, group-admin.router.ts
Mute/ban/kick/role change work, audit log written
3.2
Group admin UI
GroupAdminPanel.tsx, MemberList.tsx
Admin can perform all actions from UI
3.3
Admin report review queue
AdminReportQueue.tsx, admin.router.ts
Admin can view, action, dismiss reports
3.4
Call button (1:1)
CallButton.tsx, call.service.ts
Initiates VoIP or tel: with availability check
3.5
Push notifications end-to-end
notifications.service.ts, push tokens table
Muted conv = no push; blocked = no push
3.6
Load testing
tests/load/chat_load.py
1000 concurrent users, p95 < 200ms



SECTION 13: AGENT QUALITY CHECKLIST
◆ RUN THROUGH THIS CHECKLIST BEFORE MARKING ANY TASK AS COMPLETE.
13.1  Before Submitting Any Code
Did I run the linter? (npm run lint — zero warnings)
Did I run the type checker? (npm run type-check — zero errors)
Did I run the full test suite? (npm run test — all pass)
Did I write unit tests for every function I created?
Did I update the OpenAPI spec for every new endpoint?
Did I add JSDoc/docstrings to every public function and exported component?
Did I sanitize all user inputs on the backend?
Did I check auth and permissions on every new endpoint?
Did I add ARIA labels to every interactive UI element?
Did I test keyboard navigation through the new UI?
Did I verify the feature works on mobile breakpoints (mobile web)?
Did I add error states (loading failed, empty state, network error)?
Did I add appropriate toast/snackbar feedback for async actions?
Does the feature degrade gracefully if the socket disconnects mid-action?

13.2  Security Checklist
No raw user input is stored without sanitization.
No endpoint is accessible without JWT auth (unless explicitly public).
Rate limiting is applied to all write endpoints.
Media uploads are validated for size AND MIME type.
Block/mute enforcement is applied before any message is delivered.
Admin endpoints check for admin/owner role server-side — never trust client role.
All SQL queries use parameterized statements or ORM. No string interpolation in queries.
CORS is configured to allow only known origins. Not wildcard (*) in production.

13.3  Definition of Done
A feature is DONE when ALL of the following are true:
All unit tests pass with >= 80% line coverage for the feature module.
All integration tests for the feature's endpoints pass.
CI pipeline is green (lint + type + unit + integration + E2E).
OpenAPI spec is updated and validates without errors.
The feature works end-to-end in the browser AND mobile (if applicable).
All edge cases (blocked user, muted conv, expired token, network error) are handled.
A code review has been done (agent self-review: re-read every file you wrote).



END OF AGENT EXECUTION SPECIFICATION
Follow every instruction. Skip nothing. Ship production-quality code.
