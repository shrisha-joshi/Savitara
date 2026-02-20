"""
Voice Messages Service
Handles voice message upload, transcoding, and delivery
Supports both local storage (dev) and S3 (production)
"""
import os
import uuid
import mimetypes
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from pathlib import Path
import aiofiles

try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False

from app.core.config import settings
from app.core.exceptions import ValidationException, NotFoundException
from app.models.database import Message, MessageType, PyObjectId
from app.db.connection import get_database


# Constants
MAX_VOICE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_DURATION_SECONDS = 180  # 3 minutes
ALLOWED_VOICE_MIMES = [
    'audio/webm',
    'audio/ogg',
    'audio/opus',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/wav'
]

UPLOADS_DIR = Path(__file__).parent.parent.parent / 'uploads' / 'voice'
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class VoiceService:
    """
    Service for managing voice message uploads and playback
    """

    def __init__(self):
        self.storage_backend = os.getenv('VOICE_STORAGE_BACKEND', 'local')  # 'local' or 's3'
        self.s3_bucket = os.getenv('S3_VOICE_BUCKET', 'savitara-voice-messages')
        self.s3_region = os.getenv('AWS_REGION', 'us-east-1')
        self.cdn_base_url = os.getenv('CDN_BASE_URL', '')
        
        if self.storage_backend == 's3' and not S3_AVAILABLE:
            raise RuntimeError("boto3 not installed but S3 storage backend requested")
        
        if self.storage_backend == 's3' and S3_AVAILABLE:
            self.s3_client = boto3.client(
                's3',
                region_name=self.s3_region,
                config=Config(signature_version='s3v4')
            )
        else:
            self.s3_client = None

    async def get_upload_url(
        self,
        user_id: str,
        mime_type: str,
        file_size_bytes: int
    ) -> Dict[str, Any]:
        """
        Generate presigned upload URL for voice message
        
        Args:
            user_id: ID of the user uploading
            mime_type: MIME type of the audio file
            file_size_bytes: Size of the file in bytes
            
        Returns:
            Dict with upload_url, s3_key/file_path, and expires_at
            
        Raises:
            ValidationException: If validation fails
        """
        # Allow async context (function is async for API consistency)
        await asyncio.sleep(0)
        
        # Validate MIME type
        if mime_type not in ALLOWED_VOICE_MIMES:
            raise ValidationException(
                f"Invalid MIME type. Allowed: {', '.join(ALLOWED_VOICE_MIMES)}"
            )
        
        # Validate file size
        if file_size_bytes > MAX_VOICE_SIZE_BYTES:
            raise ValidationException(
                f"File size {file_size_bytes} exceeds maximum {MAX_VOICE_SIZE_BYTES} bytes"
            )
        
        # Generate unique key
        file_ext = mimetypes.guess_extension(mime_type) or '.webm'
        file_key = f"{user_id}/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{uuid.uuid4()}{file_ext}"
        
        if self.storage_backend == 's3':
            return self._get_s3_upload_url(file_key, mime_type, file_size_bytes)
        else:
            return self._get_local_upload_info(file_key, mime_type)

    def _get_s3_upload_url(
        self,
        s3_key: str,
        mime_type: str,
        file_size_bytes: int
    ) -> Dict[str, Any]:
        """Generate S3 presigned PUT URL"""
        try:
            upload_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.s3_bucket,
                    'Key': s3_key,
                    'ContentType': mime_type,
                    'ContentLength': file_size_bytes,
                },
                ExpiresIn=600  # 10 minutes
            )
            
            return {
                'upload_url': upload_url,
                's3_key': s3_key,
                'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
                'storage_backend': 's3'
            }
        except ClientError as e:
            raise ValidationException(f"Failed to generate upload URL: {str(e)}")

    def _get_local_upload_info(
        self,
        file_path: str,
        mime_type: str
    ) -> Dict[str, Any]:
        """Generate local file upload info"""
        full_path = UPLOADS_DIR / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        upload_token = str(uuid.uuid4())
        
        # Store upload token temporarily (in production, use Redis)
        # For now, we'll use a simple dict (not production-ready, needs Redis)
        if not hasattr(self, '_upload_tokens'):
            self._upload_tokens = {}
        
        self._upload_tokens[upload_token] = {
            'file_path': str(full_path),
            'mime_type': mime_type,
            'expires_at': datetime.now(timezone.utc) + timedelta(minutes=10)
        }
        
        return {
            'upload_url': f'/api/v1/voice/upload/{upload_token}',
            'file_path': file_path,
            'upload_token': upload_token,
            'expires_at': (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            'storage_backend': 'local'
        }

    async def handle_local_upload(
        self,
        upload_token: str,
        file_content: bytes
    ) -> Dict[str, str]:
        """
        Handle local file upload
        
        Args:
            upload_token: Token from get_upload_url
            file_content: Raw file bytes
            
        Returns:
            Dict with file_path
        """
        if not hasattr(self, '_upload_tokens') or upload_token not in self._upload_tokens:
            raise ValidationException("Invalid or expired upload token")
        
        token_info = self._upload_tokens[upload_token]
        
        # Check expiry
        if datetime.now(timezone.utc) > token_info['expires_at']:
            del self._upload_tokens[upload_token]
            raise ValidationException("Upload token expired")
        
        # Write file
        file_path = token_info['file_path']
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)
        
        # Clean up token
        del self._upload_tokens[upload_token]
        
        return {'file_path': file_path}

    async def create_voice_message(
        self,
        conversation_id: Optional[str],
        sender_id: str,
        receiver_id: Optional[str],
        storage_key: str,  # s3_key or file_path
        mime_type: str,
        duration_seconds: Optional[int] = None,
        waveform: Optional[List[float]] = None,
        storage_backend: str = 'local'
    ) -> Message:
        """
        Create a voice message record after upload
        
        Args:
            conversation_id: Conversation ID (optional for open chat)
            sender_id: Sender user ID
            receiver_id: Receiver user ID (optional for group chat)
            storage_key: S3 key or local file path
            mime_type: Audio MIME type
            duration_seconds: Duration in seconds
            waveform: Optional waveform data
            storage_backend: 'local' or 's3'
            
        Returns:
            Created Message object
        """
        # Validate duration
        if duration_seconds and duration_seconds > MAX_DURATION_SECONDS:
            raise ValidationException(
                f"Voice message duration {duration_seconds}s exceeds maximum {MAX_DURATION_SECONDS}s"
            )
        
        # Generate media URL
        media_url = self.get_media_url(storage_key, storage_backend)
        
        # Create message
        message_data = {
            'conversation_id': PyObjectId(conversation_id) if conversation_id else None,
            'sender_id': PyObjectId(sender_id),
            'receiver_id': PyObjectId(receiver_id) if receiver_id else None,
            'content': '[Voice message]',  # Fallback text
            'message_type': MessageType.VOICE,
            'media_url': media_url,
            'media_mime': mime_type,
            'media_duration_s': duration_seconds,
            'media_waveform': waveform,
            'is_open_chat': not bool(conversation_id),
            'created_at': datetime.now(timezone.utc)
        }
        
        message = Message(**message_data)
        
        # Save to database
        db = await get_database()
        result = await db.messages.insert_one(message.model_dump(by_alias=True, exclude={'id'}))
        message.id = result.inserted_id
        
        return message

    def get_media_url(
        self,
        storage_key: str,
        storage_backend: str = 'local',
        expires_in: int = 3600
    ) -> str:
        """
        Get playback URL for voice message
        
        Args:
            storage_key: S3 key or local file path
            storage_backend: 'local' or 's3'
            expires_in: URL expiry in seconds (for S3)
            
        Returns:
            Presigned GET URL (S3) or relative path (local)
        """
        if storage_backend == 's3':
            if self.cdn_base_url:
                # Use CloudFront/CDN if available
                return f"{self.cdn_base_url}/{storage_key}"
            else:
                # Generate presigned GET URL
                try:
                    return self.s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': self.s3_bucket,
                            'Key': storage_key
                        },
                        ExpiresIn=expires_in
                    )
                except ClientError as e:
                    raise ValidationException(f"Failed to generate media URL: {str(e)}")
        else:
            # Local storage - return relative path
            # In production, this should be served through a CDN or reverse proxy
            return f"/media/voice/{storage_key}"

    async def delete_voice_message(self, message_id: str, user_id: str) -> bool:
        """
        Delete a voice message (soft delete + optional file cleanup)
        
        Args:
            message_id: Message ID to delete
            user_id: User ID requesting deletion (must be sender or admin)
            
        Returns:
            True if deleted successfully
        """
        db = await get_database()
        
        # Find message
        message = await db.messages.find_one({
            '_id': PyObjectId(message_id),
            'message_type': MessageType.VOICE.value
        })
        
        if not message:
            raise NotFoundException("Voice message not found")
        
        # Check permissions (sender can delete their own messages)
        if str(message['sender_id']) != user_id:
            raise ValidationException("You can only delete your own messages")
        
        # Soft delete
        await db.messages.update_one(
            {'_id': PyObjectId(message_id)},
            {
                '$set': {
                    'deleted_at': datetime.now(timezone.utc),
                    'media_url': None  # Clear URL to prevent playback
                }
            }
        )
        
        # File deletion handled by background cleanup job
        # Files are retained for 30 days for moderation review before permanent deletion
        
        return True

    async def get_user_voice_storage_usage(self, user_id: str) -> Dict[str, Any]:
        """
        Get user's voice message storage statistics
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with count, total_duration, estimated_size
        """
        db = await get_database()
        
        pipeline = [
            {
                '$match': {
                    'sender_id': PyObjectId(user_id),
                    'message_type': MessageType.VOICE.value,
                    'deleted_at': None
                }
            },
            {
                '$group': {
                    '_id': None,
                    'count': {'$sum': 1},
                    'total_duration': {'$sum': '$media_duration_s'}
                }
            }
        ]
        
        result = await db.messages.aggregate(pipeline).to_list(1)
        
        if not result:
            return {
                'count': 0,
                'total_duration_seconds': 0,
                'estimated_size_mb': 0
            }
        
        # Estimate size (rough: 48kbps Opus = 6KB/s)
        total_duration = result[0].get('total_duration', 0) or 0
        estimated_size_mb = (total_duration * 6) / 1024  # Convert KB to MB
        
        return {
            'count': result[0]['count'],
            'total_duration_seconds': total_duration,
            'estimated_size_mb': round(estimated_size_mb, 2)
        }


# Singleton instance
voice_service = VoiceService()
