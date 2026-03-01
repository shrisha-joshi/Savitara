# Savitara Platform — Copilot Improvement Prompts

> Give these prompts to GitHub Copilot **one at a time, in order**. Each prompt is self-contained and references exact files/lines. Priority: P0 = ship-blocking, P1 = important, P2 = quality, P3 = polish.

---

## PHASE 1: CRITICAL BUGS (P0)

---

### Prompt 1 — Fix React Hooks Violation in BookingScreen

```
In savitara-app/src/screens/grihasta/BookingScreen.js, there is a React hooks rules violation: useState hooks are declared AFTER an early return (around lines 32-42). This crashes at runtime with "Rendered fewer hooks than expected".

Fix this by:
1. Move ALL useState and useEffect hooks ABOVE any conditional returns
2. Move the validation error early-return to AFTER all hook declarations
3. Keep the same validation logic but restructure so hooks always run
4. Test that the component renders correctly with and without route params
```

---

### Prompt 2 — Integrate Real Razorpay Payment in Mobile

```
In savitara-app/src/screens/grihasta/PaymentScreen.js, payment is entirely simulated with setTimeout and fake IDs. The backend has a real RazorpayService at backend/app/services/payment_service.py with create_order and verify_payment_signature.

Replace the fake payment with real Razorpay integration:

1. Install react-native-razorpay in savitara-app
2. On mount, call the backend endpoint POST /api/v1/bookings/{booking_id}/payment/create-order to get a real Razorpay order_id
3. Open Razorpay checkout with the order details (amount, currency, order_id, RAZORPAY_KEY_ID from env)
4. On payment success, call POST /api/v1/bookings/{booking_id}/payment/verify with razorpay_payment_id, razorpay_order_id, razorpay_signature
5. Handle payment failure with proper Alert.alert() (not browser alert())
6. Add loading states, duplicate-submit prevention (disable button after first tap), and error retry
7. Show payment receipt on success before navigating to BookingDetails
8. Remove all fake setTimeout and hardcoded payment IDs
```

---

### Prompt 3 — Integrate Pricing Service into BookingScreen

```
The backend has a PricingService at backend/app/services/pricing_service.py that calculates dynamic prices with weekend surcharges, peak hour adjustments, and festival pricing. But the mobile BookingScreen just shows the raw hourly_rate without any dynamic pricing.

Fix this in savitara-app/src/screens/grihasta/BookingScreen.js:

1. Add a new API call to GET /api/v1/bookings/price-estimate with params: acharya_id, pooja_id, date_time, duration
2. If that endpoint doesn't exist in backend/app/api/v1/bookings.py, create it — it should call PricingService.get_price_estimate() and return base_price, weekend_surcharge, peak_hour_adjustment, festival_surcharge, platform_fee, total_price, acharya_earnings
3. Call this endpoint whenever the user changes the date, time, or duration
4. Display a price breakdown card showing each component (base, surcharges, fees, total)
5. Also fix pricing_service.py line 98: datetime.now() should be datetime.now(timezone.utc) to avoid naive/aware datetime comparison errors
6. Fix the hardcoded festival dates (Diwali etc.) — they should be configurable or fetched from the panchanga service, not hardcoded to wrong dates
```

---

## PHASE 2: CHAT IMPROVEMENTS (P1)

---

### Prompt 4 — Fix Chat N+1 Query Problem

```
In backend/app/api/v1/chat.py around line 893, the get_conversations endpoint has a severe N+1 query problem: it calls _enrich_conversation() for EVERY conversation in a loop, and each call makes 4+ database queries. With 50 conversations, that's 200+ sequential queries.

Fix this by:
1. Replace the list comprehension with a MongoDB aggregation pipeline that batch-fetches all needed data in ONE query
2. The pipeline should: $match conversations for the user, $lookup users collection for participant info, $lookup messages for last message per conversation, $addFields for unread_count using a subquery
3. Do server-side pagination with $sort, $skip, $limit INSIDE the pipeline (currently it fetches ALL conversations then paginates in Python around lines 907-921)
4. Remove the _enrich_conversation function or convert it to work on already-enriched docs
5. Keep the response format identical so frontends don't break
```

---

### Prompt 5 — Fix Contact Info Sanitizer False Positives

```
In backend/app/api/v1/chat.py lines 34-87, the sanitize_message_content function blocks legitimate messages containing common words. Specifically:

1. The obfuscated_at pattern `(?<!\S)(?:at|\[at\]...)(?!\S)` blocks messages like "Meet at 5pm" because "at" surrounded by spaces is flagged
2. The obfuscated_dot pattern similarly can flag innocent uses of "dot" in sentences

Fix by:
1. Make the "at" pattern require it to be part of an email-like structure (word@word or word [at] word) rather than standalone
2. Only flag "dot" when preceded by a domain-like word pattern
3. Add unit tests in backend/tests/ with these test cases:
   - "Meet at 5pm" → should NOT be blocked
   - "email at gmail dot com" → SHOULD be blocked
   - "contact me at john@gmail.com" → SHOULD be blocked
   - "I was at the temple" → should NOT be blocked
   - "Check my insta @handle" → SHOULD be blocked
```

---

### Prompt 6 — Add Missing Chat Reaction Endpoints

```
The web chat (savitara-web/src/pages/chat/Chat.jsx lines 303 and 311) calls POST /messages/{messageId}/reactions and DELETE /messages/{messageId}/reactions/{emoji} but these endpoints don't exist in the backend chat router at backend/app/api/v1/chat.py.

Add these endpoints:
1. POST /chat/messages/{message_id}/reactions — body: { emoji: string } — adds a reaction to a message, stores as { user_id, emoji, created_at } in message.reactions array
2. DELETE /chat/messages/{message_id}/reactions/{emoji} — removes the current user's reaction with that emoji
3. The message sender should receive a WebSocket notification { type: "message_reaction", message_id, emoji, user_id, action: "add"|"remove" }
4. Only participants of the conversation should be allowed to react
5. Limit to 1 reaction per emoji per user
6. Update the web frontend API calls to use the correct path prefix /chat/messages/ instead of /messages/
7. Add the reaction rendering to mobile ConversationScreen.js (it already has handleAddReaction/handleRemoveReaction stubs)
```

---

### Prompt 7 — Add Typing Indicators and Read Receipts to Mobile Chat

```
The web chat has typing indicators and read receipts (DoneIcon/DoneAllIcon) but the mobile app at savitara-app/src/screens/chat/ConversationScreen.js has neither.

Add mobile feature parity:
1. TYPING INDICATORS:
   - When user starts typing in the TextInput, send { type: "typing_indicator", conversation_id, receiver_id, is_typing: true } via WebSocket
   - Debounce: only send "typing: true" once every 3 seconds while typing, send "typing: false" after 3 seconds of no input
   - Show a "typing..." text with animated dots below the last message when the other user is typing
   - Listen for incoming typing_indicator events from WebSocket

2. READ RECEIPTS:
   - When messages are loaded or screen is focused, call POST /chat/messages/{message_id}/read for unread messages
   - Show delivery/read status icons next to sent messages: single checkmark (sent), double checkmark (delivered), blue double checkmark (read)
   - Use the delivery_status field from the WebSocket message_sent acknowledgment
   - Listen for message_read WebSocket events to update status in real-time

3. Style the indicators to match the web version's visual design
```

---

### Prompt 8 — Mobile Chat UI Polish

```
Fix these UI issues across all mobile chat screens in savitara-app/src/screens/chat/:

1. ChatListScreen.js:
   - Line 182: Replace https://via.placeholder.com/50 with a proper default avatar (use react-native-paper's Avatar.Text with user initials as fallback)
   - Line 202: Fix hardcoded menu position { x: 300, y: 200 } — use the onPress event's nativeEvent.pageX/pageY coordinates
   - Line 243: Replace plain <Text>Loading...</Text> with <ActivityIndicator> from react-native-paper
   - Line 246: Add an icon (MessageSquare or similar) and a "Start a conversation" button to the empty state
   - Add relative timestamps for last message ("2h ago", "Yesterday", "Mon")

2. ConversationScreen.js:
   - Line 149: Replace alert() with Alert.alert() from react-native
   - Line 174-192: Change watermark from raw MongoDB ObjectId to user's display name
   - Fix duplicate propTypes declarations at lines 258-268 — merge into one
   - Add loading spinner while messages are loading
   - Add "scroll to bottom" floating button when scrolled up and new messages arrive
   - Add error state with retry button when loadMessages fails

3. ConversationSettingsScreen.js:
   - Line 35-43: Replace fetch-all-and-filter with a direct API call for single conversation settings
   - Line 153: Replace placeholder.com avatar with Avatar.Text initials fallback
   - Add block/report user options (web has them)

4. ForwardMessageScreen.js:
   - Line 175: Set ActivityIndicator color to match brand theme (#FF6B00 or theme primary)
   - Replace placeholder.com avatars
```

---

## PHASE 3: BOOKING FLOW IMPROVEMENTS (P1-P2)

---

### Prompt 9 — Fix Booking Details and Add Missing Features

```
Fix issues in savitara-app/src/screens/grihasta/BookingDetailsScreen.js:

1. Line 30: Add user-facing error UI when loadBooking fails — show an error card with retry button instead of just logging
2. Line 42: Replace alert() with Alert.alert()
3. Line 49: Replace plain <Text>Loading...</Text> with ActivityIndicator
4. Line 56-61: Standardize status colors across the app. Use these consistent colors everywhere:
   - requested: '#FFA726' (orange)
   - confirmed: '#42A5F5' (blue)
   - pending_payment: '#FFCA28' (yellow)
   - in_progress: '#66BB6A' (green)
   - completed: '#4CAF50' (dark green)
   - cancelled: '#EF5350' (red)
   - rejected: '#E53935' (dark red)
   Extract these to a shared constants file: savitara-app/src/constants/statusColors.js
5. Line 79: Add null check for booking.conversation_id before navigating to chat — if null, show a "Start Conversation" button that creates one first via POST /chat/verify-conversation
6. Line 94: Add a "Copy OTP" button next to the OTP display using Clipboard.setStringAsync
7. Line 110: Implement the "Write Review" button — navigate to a new ReviewScreen with booking_id and acharya_id params
```

---

### Prompt 10 — Add Booking Time Picker and Availability Check

```
In savitara-app/src/screens/grihasta/BookingScreen.js:
1. Line 130: Replace the plain TextInput for time with @react-native-community/datetimepicker in 'time' mode
2. Add an availability check: when user selects a date and time, call a new endpoint GET /api/v1/bookings/check-availability?acharya_id=X&date_time=Y&duration=Z
3. If the endpoint doesn't exist in backend/app/api/v1/bookings.py, create it:
   - Query bookings collection for overlapping time slots for that acharya
   - Query acharya's availability schedule if one exists
   - Return { available: boolean, next_available_slot: datetime | null, conflicts: [] }
4. Show availability result below the time picker: green checkmark if available, red X with next available slot suggestion if not
5. Disable the "Proceed to Payment" / "Send Request" button if slot is unavailable
```

---

### Prompt 11 — Backend Booking State Machine Hardening

```
In backend/app/api/v1/bookings.py, the booking status transitions are spread across multiple endpoints without a central state machine. This allows invalid transitions.

Add a booking state machine:
1. Create a new file backend/app/services/booking_state_machine.py with:
   - An explicit VALID_TRANSITIONS dict mapping each status to its allowed next statuses:
     requested → [confirmed, rejected, cancelled, referred]
     confirmed → [pending_payment, cancelled]
     pending_payment → [paid, cancelled] (with TTL — auto-cancel after 30 min)
     paid → [in_progress, cancelled]
     in_progress → [completed, cancelled]
   - A validate_transition(current_status, new_status, user_role) function that checks if the transition is valid AND if the user's role is allowed to make it
   - Return helpful error messages like "Cannot start a booking that hasn't been paid"

2. Use this state machine in every endpoint that changes booking status: accept_booking_request, reject_booking, cancel_booking, verify_payment, start_booking, confirm_attendance
3. Add a background task or TTL index to auto-expire stale bookings:
   - requested bookings older than 48 hours → auto-cancel
   - pending_payment bookings older than 30 minutes → auto-cancel
4. Add idempotency guard on verify_payment — if booking is already 'paid', return success without re-processing
5. Emit WebSocket booking_update events on every state change
```

---

### Prompt 12 — Fix get_booking_details ObjectId Serialization

```
In backend/app/api/v1/bookings.py, the get_booking_details endpoint (around line 1440) does NOT call _serialize_booking_ids() on the booking document, but get_my_bookings DOES. This means the detail endpoint returns raw ObjectIds that JSON can't serialize.

Fix:
1. Add _serialize_booking_ids(booking) call in get_booking_details before returning
2. Also serialize nested objects: booking.pooja, booking.acharya, booking.grihasta_user, booking.acharya_user — their _id fields also need conversion
3. Add a recursive ObjectId serializer helper that walks the entire document
4. Write a test in backend/tests/test_bookings.py that verifies all ID fields in the response are strings, not ObjectIds
```

---

## PHASE 4: ADMIN DASHBOARD IMPROVEMENTS (P2)

---

### Prompt 13 — Fix Admin Booking Stats and User Loading

```
Fix these issues in admin-savitara-web:

1. pages/bookings.js line 92: calculateStats() counts statuses from the current page only (20 bookings). Add a new backend endpoint GET /api/v1/admin/bookings/stats that returns { total, pending, confirmed, in_progress, completed, cancelled, revenue } from ALL bookings. Call this on mount instead of calculating from page data.

2. pages/bookings.js line 114: Replace browser prompt() for rejection reason with a proper MUI Dialog containing a TextField, character counter, and confirm/cancel buttons.

3. pages/bookings.js line 109: Replace native alert() with MUI Snackbar for approve/reject feedback.

4. pages/users.js line 73: Replace limit:1000 with proper server-side pagination. The backend /api/v1/admin/users endpoint should already support page and limit params. Use these with the MUI TablePagination component.

5. pages/users.js line 93: Fix potential crash on phone search — add optional chaining: user.phone_number?.includes(search)

6. Add CSV export button to both bookings and users pages using a simple CSV generation utility.
```

---

## PHASE 5: WEB APP IMPROVEMENTS (P2)

---

### Prompt 14 — Standardize Web Booking Flow

```
Review savitara-web/src/ and ensure the booking flow matches the mobile app improvements:

1. Find the booking creation page/component and integrate the pricing service estimate (same as Prompt 3)
2. Add time picker component (MUI DateTimePicker)
3. Add availability check before booking
4. Ensure Razorpay web SDK integration uses the real backend payment flow
5. Show booking status updates in real-time via WebSocket (the SocketContext already handles booking_update events)
6. Add a booking details page with OTP display, attendance confirmation, and review submission
7. Ensure all API calls use the centralized api.js service with token interceptors
```

---

### Prompt 15 — Web Chat Consistency

```
In savitara-web/src/pages/chat/Chat.jsx:

1. Lines 303 and 311: Fix API paths from /messages/{id}/reactions to /chat/messages/{id}/reactions (after Prompt 6 adds the backend endpoints)
2. Add connection quality indicator (show "Reconnecting..." bar when WebSocket is disconnected, similar to WhatsApp Web)
3. Add message retry queue — if sendMessage fails, keep the message in a local queue and retry when connection is restored
4. Add optimistic message rendering — show sent message immediately with a "sending..." status, update to "sent" on server ACK
5. Verify that the SocketContext properly handles all message types including the new delivery_status field from the backend
```

---

## PHASE 6: CROSS-CUTTING IMPROVEMENTS (P2-P3)

---

### Prompt 16 — Create Shared Constants and Theme

```
Create shared constants files to ensure consistency across the mobile app:

1. Create savitara-app/src/constants/statusColors.js:
   export const BOOKING_STATUS_COLORS = {
     requested: '#FFA726',
     confirmed: '#42A5F5',
     pending_payment: '#FFCA28',
     paid: '#66BB6A',
     in_progress: '#29B6F6',
     completed: '#4CAF50',
     cancelled: '#EF5350',
     rejected: '#E53935',
     referred: '#AB47BC',
   };

2. Create savitara-app/src/constants/theme.js with brand colors:
   export const BRAND = { primary: '#FF6B00', secondary: '#1565C0', background: '#FAFAFA', surface: '#FFFFFF', error: '#D32F2F', success: '#388E3C' };

3. Create savitara-app/src/constants/avatars.js:
   - Default avatar generator using user initials and a consistent color based on user ID hash
   - Remove ALL https://via.placeholder.com references across all chat screens

4. Update ChatListScreen.js, ConversationScreen.js, ConversationSettingsScreen.js, ForwardMessageScreen.js, BookingDetailsScreen.js, MyBookingsScreen.js to use these shared constants

5. Replace all native alert() calls with Alert.alert() across the entire savitara-app codebase
```

---

### Prompt 17 — Add Loading States and Error Boundaries

```
Across ALL screens in savitara-app/src/screens/, add consistent loading and error states:

1. Create a reusable LoadingScreen component at savitara-app/src/components/LoadingScreen.js:
   - Centered ActivityIndicator with brand primary color
   - Optional loading text
   - Use react-native-paper's ActivityIndicator for consistency

2. Create a reusable ErrorScreen component at savitara-app/src/components/ErrorScreen.js:
   - Error icon, message text, and "Retry" button
   - Accept onRetry callback prop

3. Create a reusable EmptyState component at savitara-app/src/components/EmptyState.js:
   - Icon, title, subtitle, and optional CTA button
   - Use for empty conversations list, empty bookings, etc.

4. Replace ALL plain <Text>Loading...</Text> patterns with <LoadingScreen />
5. Add ErrorScreen with retry to all screens that fetch data
6. Add EmptyState to all list screens (chat list, bookings list, etc.)
7. Wrap each screen's main content in an ErrorBoundary component
```

---

### Prompt 18 — Backend Test Coverage for Chat and Bookings

```
Expand backend tests for the chat and booking flows. The test files are at backend/tests/test_chat_api.py and backend/tests/test_bookings.py. Add these test cases:

CHAT TESTS (test_chat_api.py):
1. test_send_message_sanitization_allows_word_at — "Meet at 5pm" should not be blocked
2. test_send_message_sanitization_blocks_email — "email at gmail dot com" should be blocked
3. test_get_conversations_pagination — verify server-side pagination returns correct page
4. test_reactions_add_and_remove — POST and DELETE reaction endpoints
5. test_unread_count_accuracy — send 5 messages, verify unread count is 5 for receiver
6. test_message_soft_delete — delete a message and verify it's marked deleted but not removed

BOOKING TESTS (test_bookings.py):
7. test_booking_state_machine_invalid_transition — try to start a booking that's not paid, expect 400
8. test_booking_state_machine_valid_flow — requested → confirmed → paid → in_progress → completed
9. test_verify_payment_idempotency — call verify_payment twice, second call should succeed without re-processing
10. test_get_booking_details_serializes_ids — all ObjectId fields should be strings in response
11. test_price_estimate_endpoint — call price estimate with weekend date and verify surcharge is applied
12. test_booking_auto_expire — create a pending_payment booking and verify it auto-expires after TTL
13. test_attendance_confirmation_both_parties — confirm from both sides and verify booking completes

Use pytest fixtures for test user creation and cleanup.
```

---

### Prompt 19 — Mobile Voice Messages and File Attachments

```
The web chat supports voice recording and file attachments but mobile doesn't. Add these to savitara-app/src/screens/chat/ConversationScreen.js:

1. VOICE MESSAGES:
   - Add a microphone button next to the send button
   - Use expo-av for recording: press-and-hold to record, release to send
   - Show recording indicator (red dot + duration) while recording
   - Upload audio to backend via multipart form to POST /chat/messages with type: 'voice'
   - Render voice messages with a play button shows waveform using a simple progress bar
   - Show duration "0:15" style

2. FILE ATTACHMENTS:
   - Add a paperclip/attach button
   - Use expo-document-picker for files and expo-image-picker for images
   - Show preview before sending (image thumbnail or file icon + name)
   - Upload via multipart form to POST /chat/messages with type: 'image' or 'file'
   - Render image messages as thumbnails (tappable to full screen)
   - Render file messages as download cards with file name, size, and download button

3. Ensure the backend POST /chat/messages endpoint in backend/app/api/v1/chat.py supports message_type field and file upload via UploadFile parameter
```

---

### Prompt 20 — Add WebSocket Connection Status to Mobile

```
Add a visible connection status indicator to the mobile app:

1. In savitara-app/src/context/SocketContext.js:
   - Export connectionStatus state: 'connected' | 'connecting' | 'disconnected' | 'reconnecting'
   - Update this state on each WebSocket lifecycle event

2. Create savitara-app/src/components/ConnectionBanner.js:
   - Shows a thin banner at the top of the screen when disconnected/reconnecting
   - disconnected: red banner "No connection"
   - reconnecting: yellow banner "Reconnecting..." with ActivityIndicator
   - connected: briefly show green "Connected" then auto-hide after 2 seconds
   - Use Animated.View for smooth slide in/out animation

3. Add ConnectionBanner to the root App.js or main navigation container so it shows on all screens

4. In the chat screens, show a warning icon next to the send button when disconnected, and queue messages locally for retry when connection is restored
```

---

## EXECUTION ORDER

Run these prompts in this recommended order:

| Order | Prompt | Priority | Estimated Effort |
|-------|--------|----------|-----------------|
| 1 | Prompt 1 (Hooks fix) | P0 | 15 min |
| 2 | Prompt 16 (Shared constants) | P3 but foundational | 30 min |
| 3 | Prompt 17 (Loading/Error states) | P2 but foundational | 45 min |
| 4 | Prompt 3 (Pricing integration) | P0 | 1 hour |
| 5 | Prompt 2 (Razorpay integration) | P0 | 2 hours |
| 6 | Prompt 11 (State machine) | P1 | 1.5 hours |
| 7 | Prompt 12 (ObjectId serialization) | P1 | 30 min |
| 8 | Prompt 4 (Chat N+1 fix) | P1 | 1.5 hours |
| 9 | Prompt 5 (Sanitizer fix) | P1 | 30 min |
| 10 | Prompt 6 (Reaction endpoints) | P1 | 1 hour |
| 11 | Prompt 7 (Mobile typing/receipts) | P1 | 2 hours |
| 12 | Prompt 8 (Mobile chat UI polish) | P2 | 1 hour |
| 13 | Prompt 9 (Booking details fix) | P2 | 1 hour |
| 14 | Prompt 10 (Time picker/availability) | P2 | 1.5 hours |
| 15 | Prompt 13 (Admin fixes) | P2 | 1 hour |
| 16 | Prompt 14 (Web booking flow) | P2 | 2 hours |
| 17 | Prompt 15 (Web chat consistency) | P2 | 1 hour |
| 18 | Prompt 18 (Backend tests) | P2 | 2 hours |
| 19 | Prompt 19 (Voice/attachments) | P3 | 3 hours |
| 20 | Prompt 20 (Connection status) | P3 | 1 hour |

**Total: ~24 hours of implementation work**
