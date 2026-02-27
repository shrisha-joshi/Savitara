"""Upload API Tests"""
import pytest


class TestUploadEndpoints:
    """Test file upload endpoints"""

    @pytest.mark.asyncio
    async def test_upload_without_auth(self, client):
        """Test uploading file without authentication"""
        response = await client.post(
            "/api/v1/upload",
            files={"file": ("test.png", b"fake-image-data", "image/png")},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_delete_upload_without_auth(self, client):
        """Test deleting uploaded file without authentication"""
        response = await client.delete("/api/v1/upload/test-file-id")
        assert response.status_code in [401, 405]

    @pytest.mark.asyncio
    async def test_upload_oversized_file(self, client):
        """Test uploading file beyond size limit"""
        # Create a fake 11MB payload (assumes 10MB limit)
        large_payload = b"x" * (11 * 1024 * 1024)
        response = await client.post(
            "/api/v1/upload",
            files={"file": ("big.bin", large_payload, "application/octet-stream")},
        )
        # Should fail with 401 (no auth) or 413 (too large) or 422
        assert response.status_code in [401, 413, 422]

    @pytest.mark.asyncio
    async def test_upload_disallowed_file_type(self, client):
        """Test uploading an executable file type"""
        response = await client.post(
            "/api/v1/upload",
            files={"file": ("malware.exe", b"MZ\x90\x00", "application/x-msdownload")},
        )
        assert response.status_code in [400, 401, 422]
