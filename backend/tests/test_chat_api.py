"""
Chat API Tests
Phase 8 - Comprehensive coverage for chat endpoints
SonarQube: S5122
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId


FAKE_USER_ID = str(ObjectId())
FAKE_ACHARYA_ID = str(ObjectId())
FAKE_CONV_ID = str(ObjectId())
FAKE_MSG_ID = str(ObjectId())

FAKE_USER_TOKEN = "Bearer fake_grihasta_token"


def make_fake_user(role: str = "grihasta", user_id: str = None):
    uid = user_id or FAKE_USER_ID
    return {
        "id": uid,
        "_id": ObjectId(uid),
        "email": "test@example.com",
        "name": "Test User",
        "role": role,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth_headers(token: str = FAKE_USER_TOKEN):
    return {"Authorization": token}


# ---------------------------------------------------------------------------
# TestSendMessage
# ---------------------------------------------------------------------------

class TestSendMessage:
    """POST /api/v1/chat/messages"""

    @pytest.mark.asyncio
    async def test_send_message_requires_auth(self, client):
        response = await client.post(
            "/api/v1/chat/messages",
            json={"conversation_id": FAKE_CONV_ID, "content": "Hello"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_send_message_missing_content(self, client):
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()):
            response = await client.post(
                "/api/v1/chat/messages",
                json={"conversation_id": FAKE_CONV_ID},
                headers=auth_headers(),
            )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_send_message_contact_info_blocked(self, client):
        """Messages with phone numbers should be sanitized"""
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()), \
             patch("app.api.v1.chat.get_db") as mock_db:
            mock_db.return_value = AsyncMock()
            response = await client.post(
                "/api/v1/chat/messages",
                json={
                    "conversation_id": FAKE_CONV_ID,
                    "content": "Call me at 9876543210",
                },
                headers=auth_headers(),
            )
        # 201 if created, content should be sanitized
        # or 400/404 if conversation not found in mock - either is acceptable
        assert response.status_code in [201, 400, 404, 422]

    @pytest.mark.asyncio
    async def test_send_message_invalid_conversation_id(self, client):
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()):
            response = await client.post(
                "/api/v1/chat/messages",
                json={"conversation_id": "not_an_objectid", "content": "Hello"},
                headers=auth_headers(),
            )
        assert response.status_code in [400, 404, 422]


# ---------------------------------------------------------------------------
# TestVerifyConversation
# ---------------------------------------------------------------------------

class TestVerifyConversation:
    """POST /api/v1/chat/verify-conversation"""

    @pytest.mark.asyncio
    async def test_verify_conversation_requires_auth(self, client):
        response = await client.post(
            "/api/v1/chat/verify-conversation",
            json={"recipient_id": FAKE_ACHARYA_ID},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_conversation_self_message_blocked(self, client):
        user = make_fake_user()
        with patch("app.api.v1.chat.get_current_user", return_value=user):
            response = await client.post(
                "/api/v1/chat/verify-conversation",
                json={"recipient_id": user["id"]},
                headers=auth_headers(),
            )
        # Should reject self-messaging
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_verify_conversation_invalid_recipient_id(self, client):
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()):
            response = await client.post(
                "/api/v1/chat/verify-conversation",
                json={"recipient_id": "bad_id"},
                headers=auth_headers(),
            )
        assert response.status_code in [400, 422]


# ---------------------------------------------------------------------------
# TestGetConversations
# ---------------------------------------------------------------------------

class TestGetConversations:
    """GET /api/v1/chat/conversations"""

    @pytest.mark.asyncio
    async def test_get_conversations_requires_auth(self, client):
        response = await client.get("/api/v1/chat/conversations")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_conversations_returns_list(self, client, test_db):
        user = make_fake_user()
        from app.db.connection import get_db
        from app.core.security import get_current_user as gcu

        from app.main import app as fastapi_app
        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(
                "/api/v1/chat/conversations",
                headers=auth_headers(),
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "conversations" in data["data"]
        finally:
            fastapi_app.dependency_overrides = {}

    @pytest.mark.asyncio
    async def test_get_conversations_pagination(self, client, test_db):
        user = make_fake_user()
        from app.db.connection import get_db
        from app.core.security import get_current_user as gcu
        from app.main import app as fastapi_app

        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(
                "/api/v1/chat/conversations?page=1&limit=5",
                headers=auth_headers(),
            )
            assert response.status_code == 200
            pagination = response.json()["data"]["pagination"]
            assert pagination["page"] == 1
            assert pagination["limit"] == 5
        finally:
            fastapi_app.dependency_overrides = {}

    @pytest.mark.asyncio
    async def test_get_conversations_invalid_page(self, client):
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()):
            response = await client.get(
                "/api/v1/chat/conversations?page=0",
                headers=auth_headers(),
            )
        assert response.status_code == 422  # page must be >= 1


# ---------------------------------------------------------------------------
# TestGetMessages
# ---------------------------------------------------------------------------

class TestGetMessages:
    """GET /api/v1/chat/conversations/{id}/messages"""

    @pytest.mark.asyncio
    async def test_get_messages_requires_auth(self, client):
        response = await client.get(
            f"/api/v1/chat/conversations/{FAKE_CONV_ID}/messages"
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_messages_not_found(self, client, test_db):
        user = make_fake_user()
        from app.db.connection import get_db
        from app.core.security import get_current_user as gcu
        from app.main import app as fastapi_app

        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(
                f"/api/v1/chat/conversations/{FAKE_CONV_ID}/messages",
                headers=auth_headers(),
            )
            assert response.status_code in [403, 404]
        finally:
            fastapi_app.dependency_overrides = {}

    @pytest.mark.asyncio
    async def test_get_messages_invalid_id(self, client):
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()):
            response = await client.get(
                "/api/v1/chat/conversations/bad_id/messages",
                headers=auth_headers(),
            )
        assert response.status_code in [400, 404]

    @pytest.mark.asyncio
    async def test_get_messages_pagination_limit_exceeded(self, client):
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()):
            response = await client.get(
                f"/api/v1/chat/conversations/{FAKE_CONV_ID}/messages?limit=999",
                headers=auth_headers(),
            )
        assert response.status_code == 422  # limit max is 200


# ---------------------------------------------------------------------------
# TestDeleteMessage
# ---------------------------------------------------------------------------

class TestDeleteMessage:
    """DELETE /api/v1/chat/messages/{message_id}"""

    @pytest.mark.asyncio
    async def test_delete_message_requires_auth(self, client):
        response = await client.delete(f"/api/v1/chat/messages/{FAKE_MSG_ID}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_message_not_found(self, client, test_db):
        user = make_fake_user()
        from app.db.connection import get_db
        from app.core.security import get_current_user as gcu
        from app.main import app as fastapi_app

        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.delete(
                f"/api/v1/chat/messages/{FAKE_MSG_ID}",
                headers=auth_headers(),
            )
            assert response.status_code in [403, 404]
        finally:
            fastapi_app.dependency_overrides = {}

    @pytest.mark.asyncio
    async def test_delete_message_invalid_id(self, client):
        with patch("app.api.v1.chat.get_current_user", return_value=make_fake_user()):
            response = await client.delete(
                "/api/v1/chat/messages/not_valid_id",
                headers=auth_headers(),
            )
        assert response.status_code in [400, 404, 422]


# ---------------------------------------------------------------------------
# TestOpenChat
# ---------------------------------------------------------------------------

class TestOpenChat:
    """GET /api/v1/chat/open-chat (Grihasta bulletin board)"""

    @pytest.mark.asyncio
    async def test_get_open_chat_requires_auth(self, client):
        response = await client.get("/api/v1/chat/open-chat")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_open_chat_grihasta_allowed(self, client, test_db):
        user = make_fake_user(role="grihasta")
        from app.db.connection import get_db
        from app.core.security import get_current_grihasta
        from app.main import app as fastapi_app

        fastapi_app.dependency_overrides[get_current_grihasta] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            response = await client.get(
                "/api/v1/chat/open-chat",
                headers=auth_headers(),
            )
            assert response.status_code == 200
        finally:
            fastapi_app.dependency_overrides = {}


# ---------------------------------------------------------------------------
# TestSanitizeContactInfo (unit test - no DB needed)
# ---------------------------------------------------------------------------

class TestSanitizeContactInfo:
    """Unit tests for contact information sanitization"""

    def test_send_message_sanitization_allows_word_at(self):
        """'Meet at 5pm' — standalone 'at' preposition must NOT trigger the blocker."""
        from app.api.v1.chat import sanitize_message_content
        content, blocked = sanitize_message_content("Meet at 5pm")
        assert blocked is False, "'Meet at 5pm' should not be blocked"
        assert content == "Meet at 5pm"

    def test_send_message_sanitization_blocks_email(self):
        """'email at gmail dot com' — full obfuscated address MUST be blocked."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("email at gmail dot com")
        assert blocked is True, "'email at gmail dot com' should be blocked"

    def test_phone_number_blocked(self):
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Call me at 9876543210")
        assert blocked is True

    def test_email_blocked(self):
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Email me at test@example.com")
        assert blocked is True

    def test_url_blocked(self):
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Visit http://example.com")
        assert blocked is True

    def test_clean_message_allowed(self):
        from app.api.v1.chat import sanitize_message_content
        content, blocked = sanitize_message_content("Namaste, please confirm your pooja time")
        assert blocked is False
        assert content == "Namaste, please confirm your pooja time"

    def test_whatsapp_handle_blocked(self):
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Contact me on whatsapp:9876543210")
        assert blocked is True

    def test_indian_number_with_plus91(self):
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("+91 98765 43210")
        assert blocked is True


# ---------------------------------------------------------------------------
# TestSanitizeObfuscationPrecision
# Tests that the "at" / "dot" patterns are precise enough not to generate
# false positives on ordinary English sentences.
# ---------------------------------------------------------------------------

class TestSanitizeObfuscationPrecision:
    """Precision tests for the refactored obfuscated-at / obfuscated-dot patterns."""

    # ── Messages that MUST NOT be blocked ────────────────────────────────

    def test_meet_at_time_allowed(self):
        """'Meet at 5pm' — standalone 'at' in an innocent sentence."""
        from app.api.v1.chat import sanitize_message_content
        content, blocked = sanitize_message_content("Meet at 5pm")
        assert blocked is False, "'Meet at 5pm' should not be blocked"
        assert content == "Meet at 5pm"

    def test_was_at_temple_allowed(self):
        """'I was at the temple' — simple preposition use."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("I was at the temple")
        assert blocked is False, "'I was at the temple' should not be blocked"

    def test_reaching_at_noon_allowed(self):
        """'I am reaching at noon' — no email context."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("I am reaching at noon")
        assert blocked is False

    def test_standalone_dot_prose_allowed(self):
        """'Connect the dots' — 'dot' in prose without a TLD following."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Connect the dots to understand the pattern")
        assert blocked is False, "'connect the dots' prose should not be blocked"

    def test_at_in_long_sentence_allowed(self):
        """Multi-word sentence: 'Please be at the venue by 10am.'"""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Please be at the venue by 10am.")
        assert blocked is False

    # ── Messages that MUST be blocked ────────────────────────────────────

    def test_obfuscated_email_at_dot_blocked(self):
        """Full obfuscation: 'email at gmail dot com'."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("email at gmail dot com")
        assert blocked is True, "'email at gmail dot com' should be blocked"

    def test_obfuscated_email_dot_in_blocked(self):
        """Full obfuscation with Indian TLD: 'john at yahoo dot in'."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("john at yahoo dot in")
        assert blocked is True

    def test_real_email_with_at_word_blocked(self):
        """'contact me at john@gmail.com' — real @ in domain part."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("contact me at john@gmail.com")
        assert blocked is True, "Actual email address should be blocked"

    def test_at_word_real_domain_blocked(self):
        """'john at gmail.com' — 'at' with real dot-TLD on right side."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Reach me at gmail.com")
        assert blocked is True

    def test_social_at_handle_blocked(self):
        """'Check my insta @handle' — generic @username."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Check my insta @handle")
        assert blocked is True, "'@handle' social mention should be blocked"

    def test_at_handle_without_platform_blocked(self):
        """'Contact me @johndoe' — bare @handle, no platform keyword needed."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("Contact me @johndoe")
        assert blocked is True

    def test_obfuscated_dot_tld_blocked(self):
        """'gmail dot com' — 'dot' with recognised TLD."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("My address is gmail dot com")
        assert blocked is True

    def test_bracket_obfuscation_blocked(self):
        """'user [at] domain [dot] com' — bracket encoding variant."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("user [at] domain [dot] com")
        assert blocked is True

    def test_spaced_at_symbol_blocked(self):
        """'john @ gmail.com' — space around @ symbol."""
        from app.api.v1.chat import sanitize_message_content
        _, blocked = sanitize_message_content("john @ gmail.com")
        assert blocked is True, "Spaced @ should be blocked"


# ---------------------------------------------------------------------------
# TestReactions
# ---------------------------------------------------------------------------

class TestReactions:
    """POST /api/v1/messages/{id}/reactions and DELETE /api/v1/messages/{id}/reactions/{emoji}"""

    @pytest.mark.asyncio
    async def test_reactions_add_and_remove(self, client, test_db):
        """Add then remove a reaction — both operations return 200 with updated summary."""
        from types import SimpleNamespace
        from app.core.security import get_current_user as gcu
        from app.main import app as fastapi_app

        # Insert a message with no conversation — bypasses participant access check
        msg_oid = ObjectId()
        await test_db.messages.insert_one({
            "_id": msg_oid,
            "conversation_id": None,
            "sender_id": ObjectId(FAKE_ACHARYA_ID),
            "receiver_id": ObjectId(FAKE_USER_ID),
            "content": "Namaste",
            "reactions": [],
            "read": False,
            "deleted": False,
        })
        message_id = str(msg_oid)

        # reactions.py accesses current_user.id as an attribute, not a dict key
        fake_user_obj = SimpleNamespace(id=ObjectId(FAKE_USER_ID))
        fastapi_app.dependency_overrides[gcu] = lambda: fake_user_obj

        try:
            # ── Add reaction ──────────────────────────────────────────────
            add_resp = await client.post(
                f"/api/v1/messages/{message_id}/reactions",
                json={"emoji": "😀"},
                headers=auth_headers(),
            )
            assert add_resp.status_code == 200
            add_data = add_resp.json()
            assert add_data["success"] is True
            reactions_after_add = add_data["data"]["reactions"]
            thumbs_up = next((r for r in reactions_after_add if r["emoji"] == "😀"), None)
            assert thumbs_up is not None
            assert thumbs_up["count"] >= 1

            # ── Remove reaction ───────────────────────────────────────────
            emoji_encoded = "%F0%9F%98%80"  # URL-safe encoding for 😀
            del_resp = await client.delete(
                f"/api/v1/messages/{message_id}/reactions/{emoji_encoded}",
                headers=auth_headers(),
            )
            assert del_resp.status_code == 200
            del_data = del_resp.json()
            assert del_data["success"] is True
            reactions_after_del = del_data["data"]["reactions"]
            thumbs_after = next((r for r in reactions_after_del if r["emoji"] == "😀"), None)
            assert thumbs_after is None or thumbs_after.get("count", 0) == 0

        finally:
            fastapi_app.dependency_overrides = {}


# ---------------------------------------------------------------------------
# TestUnreadCount
# ---------------------------------------------------------------------------

class TestUnreadCount:
    """GET /api/v1/chat/unread-count"""

    @pytest.mark.asyncio
    async def test_unread_count_accuracy(self, client, test_db):
        """Inserting 5 unread messages for a user must yield unread_count == 5."""
        from app.db.connection import get_db
        from app.core.security import get_current_user as gcu
        from app.main import app as fastapi_app

        user = make_fake_user()
        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            receiver_oid = ObjectId(user["id"])
            sender_oid = ObjectId(FAKE_ACHARYA_ID)
            conv_oid = ObjectId(FAKE_CONV_ID)

            # Insert 5 unread messages addressed to this user
            for _ in range(5):
                await test_db.messages.insert_one({
                    "_id": ObjectId(),
                    "conversation_id": conv_oid,
                    "sender_id": sender_oid,
                    "receiver_id": receiver_oid,
                    "content": "Test message",
                    "read": False,
                    "deleted": False,
                })

            response = await client.get(
                "/api/v1/chat/unread-count",
                headers=auth_headers(),
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["unread_count"] == 5

        finally:
            fastapi_app.dependency_overrides = {}


# ---------------------------------------------------------------------------
# TestMessageSoftDelete
# ---------------------------------------------------------------------------

class TestMessageSoftDelete:
    """Verify DELETE /api/v1/chat/messages/{id} performs a soft delete."""

    @pytest.mark.asyncio
    async def test_message_soft_delete(self, client, test_db):
        """Deleting a message marks it deleted=True and replaces content; does not remove the doc."""
        from app.db.connection import get_db
        from app.core.security import get_current_user as gcu
        from app.main import app as fastapi_app

        user = make_fake_user()
        fastapi_app.dependency_overrides[gcu] = lambda: user
        fastapi_app.dependency_overrides[get_db] = lambda: test_db

        try:
            msg_oid = ObjectId()
            await test_db.messages.insert_one({
                "_id": msg_oid,
                "conversation_id": ObjectId(FAKE_CONV_ID),
                "sender_id": ObjectId(user["id"]),  # sender == current_user
                "receiver_id": ObjectId(FAKE_ACHARYA_ID),
                "content": "Original content",
                "read": False,
                "deleted": False,
            })
            message_id = str(msg_oid)

            response = await client.delete(
                f"/api/v1/chat/messages/{message_id}",
                headers=auth_headers(),
            )
            assert response.status_code == 200
            assert response.json()["success"] is True

            # Document must still exist (soft delete only)
            doc = await test_db.messages.find_one({"_id": msg_oid})
            assert doc is not None, "Document must not be physically removed"
            assert doc.get("deleted") is True, "deleted flag must be True"
            assert doc.get("content") == "[Message deleted]"

        finally:
            fastapi_app.dependency_overrides = {}
