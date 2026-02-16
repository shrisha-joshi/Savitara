"""
API Response Compression Middleware
Compresses JSON responses using gzip for faster data transfer
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import gzip
import logging
from typing import Callable

logger = logging.getLogger(__name__)


class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to compress API responses
    Reduces bandwidth usage and improves response times
    """

    def __init__(
        self,
        app,
        minimum_size: int = 1024,  # Only compress responses > 1KB
        compression_level: int = 6,  # gzip compression level (1-9)
    ):
        super().__init__(app)
        self.minimum_size = minimum_size
        self.compression_level = compression_level

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and compress response if applicable"""

        # Check if client accepts gzip
        accept_encoding = request.headers.get("accept-encoding", "")
        if "gzip" not in accept_encoding.lower():
            return await call_next(request)

        # Get response
        response = await call_next(request)

        # Only compress successful responses
        if response.status_code >= 400:
            return response

        # Check content type
        content_type = response.headers.get("content-type", "")
        compressible_types = [
            "application/json",
            "text/html",
            "text/css",
            "text/javascript",
            "application/javascript",
        ]

        if not any(ct in content_type for ct in compressible_types):
            return response

        # Get response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        # Only compress if response is large enough
        if len(body) < self.minimum_size:
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        # Compress response
        try:
            compressed_body = gzip.compress(body, compresslevel=self.compression_level)

            # Only use compression if it actually reduces size
            if len(compressed_body) >= len(body):
                return Response(
                    content=body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )

            # Create new response with compressed content
            headers = dict(response.headers)
            headers["content-encoding"] = "gzip"
            headers["content-length"] = str(len(compressed_body))
            headers["vary"] = "Accept-Encoding"

            # Remove any existing content-encoding
            if "content-encoding" in headers and headers["content-encoding"] != "gzip":
                del headers["content-encoding"]

            logger.debug(
                f"Compressed response: {len(body)} -> {len(compressed_body)} bytes "
                f"({100 * (1 - len(compressed_body) / len(body)):.1f}% reduction)"
            )

            return Response(
                content=compressed_body,
                status_code=response.status_code,
                headers=headers,
                media_type=response.media_type,
            )

        except Exception as e:
            logger.error(f"Compression failed: {e}")
            # Return uncompressed response on error
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )


# Usage in main.py:
"""
from app.middleware.compression import CompressionMiddleware

app.add_middleware(
    CompressionMiddleware,
    minimum_size=1024,  # 1KB minimum
    compression_level=6  # Balanced compression
)
"""
