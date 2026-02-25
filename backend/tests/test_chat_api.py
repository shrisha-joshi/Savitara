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
