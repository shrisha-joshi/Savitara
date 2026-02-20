"""
Voice Message Transcoding Worker
Handles background transcoding of voice messages to optimized Opus format
Supports both S3 and local storage backends
"""
import os
import asyncio
import subprocess
import tempfile
import logging
from typing import Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timezone
import aiofiles

try:
    import boto3
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False

from app.core.config import settings
from app.core.exceptions import ValidationException
from app.db.connection import get_database
from app.models.database import PyObjectId
from app.services.websocket_manager import manager as websocket_manager


logger = logging.getLogger(__name__)


# Transcoding configuration
TARGET_CODEC = 'libopus'  # Opus codec for optimal quality/compression
TARGET_BITRATE = '48k'  # 48 kbps for voice (excellent quality, small size)
TARGET_FORMAT = 'ogg'  # Ogg container for Opus
TARGET_MIME_TYPE = 'audio/ogg; codecs=opus'


class VoiceTranscodingWorker:
    """
    Worker for transcoding voice messages to optimized format
    
    Features:
    - Transcodes to Opus codec at 48kbps
    - Supports S3 and local storage
    - Updates message record after transcode
    - Emits WebSocket event on completion
    - Cleans up temporary files
    """
    
    def __init__(self):
        self.storage_backend = os.getenv('VOICE_STORAGE_BACKEND', 'local')
        self.s3_bucket = os.getenv('S3_VOICE_BUCKET', 'savitara-voice-messages')
        self.s3_region = os.getenv('AWS_REGION', 'us-east-1')
        self.cdn_base_url = os.getenv('CDN_BASE_URL', '')
        
        if self.storage_backend == 's3' and S3_AVAILABLE:
            self.s3_client = boto3.client('s3', region_name=self.s3_region)
        else:
            self.s3_client = None
        
        # Verify ffmpeg installation
        self._verify_ffmpeg()
    
    def _verify_ffmpeg(self):
        """Check if ffmpeg is installed and accessible"""
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5
            )
            if result.returncode != 0:
                logger.warning("ffmpeg not found or not working properly")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            logger.warning("ffmpeg not installed - transcoding will fail")
    
    async def transcode_voice_message(
        self,
        message_id: str,
        storage_key: str,
        storage_backend: str = 'local'
    ) -> Dict[str, Any]:
        """
        Transcode a voice message to optimized Opus format
        
        Args:
            message_id: MongoDB message ID
            storage_key: S3 key or local file path
            storage_backend: 'local' or 's3'
            
        Returns:
            Dict with transcoded storage_key, media_url, and success status
            
        Raises:
            Exception: If transcoding fails
        """
        temp_input = None
        temp_output = None
        
        try:
            logger.info(f"Starting transcode for message {message_id}")
            
            # Step 1: Download source file to temp directory
            temp_input = await self._download_source_file(storage_key, storage_backend)
            
            # Step 2: Transcode using ffmpeg
            temp_output = await self._transcode_audio(temp_input)
            
            # Step 3: Upload transcoded file
            transcoded_key = self._get_transcoded_key(storage_key)
            await self._upload_transcoded_file(temp_output, transcoded_key, storage_backend)
            
            # Step 4: Get media URL
            media_url = self._get_media_url(transcoded_key, storage_backend)
            
            # Step 5: Update message record in database
            await self._update_message_record(
                message_id=message_id,
                media_url=media_url,
                media_mime=TARGET_MIME_TYPE
            )
            
            # Step 6: Emit WebSocket event
            await self._emit_transcode_complete_event(message_id, media_url)
            
            logger.info(f"Transcode complete for message {message_id}")
            
            return {
                'success': True,
                'message_id': message_id,
                'storage_key': transcoded_key,
                'media_url': media_url
            }
            
        except Exception as e:
            logger.error(f"Transcode failed for message {message_id}: {e}")
            # Update message with error status
            await self._mark_transcode_failed(message_id, str(e))
            raise
            
        finally:
            # Step 7: Clean up temporary files
            self._cleanup_temp_files(temp_input, temp_output)
    
    async def _download_source_file(
        self,
        storage_key: str,
        storage_backend: str
    ) -> str:
        """
        Download source audio file to temporary location
        
        Returns:
            Path to temporary input file
        """
        # Create temporary file with appropriate extension
        temp_fd, temp_path = tempfile.mkstemp(suffix=Path(storage_key).suffix)
        os.close(temp_fd)  # Close file descriptor, we'll use async file I/O
        
        if storage_backend == 's3':
            # Download from S3
            try:
                self.s3_client.download_file(
                    Bucket=self.s3_bucket,
                    Key=storage_key,
                    Filename=temp_path
                )
                logger.info(f"Downloaded from S3: {storage_key}")
            except ClientError as e:
                logger.error(f"Failed to download from S3: {e}")
                raise ValidationException(f"S3 download failed: {e}")
        else:
            # Copy from local storage
            source_path = Path(storage_key)
            if not source_path.is_absolute():
                # Resolve relative path
                uploads_dir = Path(__file__).parent.parent.parent / 'uploads' / 'voice'
                source_path = uploads_dir / storage_key
            
            if not source_path.exists():
                raise ValidationException(f"Source file not found: {source_path}")
            
            async with aiofiles.open(source_path, 'rb') as src:
                content = await src.read()
            async with aiofiles.open(temp_path, 'wb') as dst:
                await dst.write(content)
            
            logger.info(f"Copied from local: {storage_key}")
        
        return temp_path
    
    async def _transcode_audio(self, input_path: str) -> str:
        """
        Transcode audio to Opus format using ffmpeg
        
        Args:
            input_path: Path to source audio file
            
        Returns:
            Path to transcoded output file
        """
        # Create temporary output file
        temp_fd, output_path = tempfile.mkstemp(suffix=f'.{TARGET_FORMAT}')
        os.close(temp_fd)
        
        # Build ffmpeg command
        # -i input: input file
        # -c:a libopus: use Opus codec
        # -b:a 48k: bitrate 48 kbps
        # -vbr on: variable bitrate mode
        # -compression_level 10: highest compression (slower encoding, smaller file)
        # -application voip: optimize for voice
        # -y: overwrite output file
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-c:a', TARGET_CODEC,
            '-b:a', TARGET_BITRATE,
            '-vbr', 'on',
            '-compression_level', '10',
            '-application', 'voip',
            '-y',
            output_path
        ]
        
        try:
            # Run ffmpeg in subprocess (async)
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            _, stderr = await asyncio.wait_for(process.communicate(), timeout=60)
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8', errors='ignore')
                logger.error(f"ffmpeg failed: {error_msg}")
                raise ValidationException(f"Transcoding failed: {error_msg}")
            
            # Verify output file exists and has content
            if not Path(output_path).exists() or Path(output_path).stat().st_size == 0:
                raise ValidationException("Transcoding produced empty file")
            
            logger.info(f"Transcoded audio: {input_path} -> {output_path}")
            return output_path
            
        except asyncio.TimeoutError:
            logger.error("ffmpeg timeout (>60s)")
            raise ValidationException("Transcoding timeout")
        except FileNotFoundError:
            logger.error("ffmpeg not found - install ffmpeg to enable transcoding")
            raise ValidationException("ffmpeg not installed")
    
    def _get_transcoded_key(self, original_key: str) -> str:
        """
        Generate storage key for transcoded file
        
        Changes extension to .ogg and adds 'transcoded' suffix
        Example: user/2024/01/file.webm -> user/2024/01/file_transcoded.ogg
        """
        path = Path(original_key)
        stem = path.stem
        parent = path.parent
        return str(parent / f"{stem}_transcoded.{TARGET_FORMAT}")
    
    async def _upload_transcoded_file(
        self,
        file_path: str,
        storage_key: str,
        storage_backend: str
    ) -> None:
        """Upload transcoded file to storage"""
        if storage_backend == 's3':
            # Upload to S3
            try:
                self.s3_client.upload_file(
                    Filename=file_path,
                    Bucket=self.s3_bucket,
                    Key=storage_key,
                    ExtraArgs={
                        'ContentType': TARGET_MIME_TYPE,
                        'CacheControl': 'max-age=31536000',  # 1 year cache
                    }
                )
                logger.info(f"Uploaded to S3: {storage_key}")
            except ClientError as e:
                logger.error(f"Failed to upload to S3: {e}")
                raise ValidationException(f"S3 upload failed: {e}")
        else:
            # Save to local storage
            uploads_dir = Path(__file__).parent.parent.parent / 'uploads' / 'voice'
            dest_path = uploads_dir / storage_key
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            
            async with aiofiles.open(file_path, 'rb') as src:
                content = await src.read()
            async with aiofiles.open(dest_path, 'wb') as dst:
                await dst.write(content)
            
            logger.info(f"Saved to local: {dest_path}")
    
    def _get_media_url(self, storage_key: str, storage_backend: str) -> str:
        """Generate media URL for transcoded file"""
        if storage_backend == 's3':
            if self.cdn_base_url:
                return f"{self.cdn_base_url}/{storage_key}"
            else:
                # Generate presigned URL (valid for 1 hour)
                try:
                    return self.s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': self.s3_bucket,
                            'Key': storage_key
                        },
                        ExpiresIn=3600
                    )
                except ClientError as e:
                    logger.error(f"Failed to generate presigned URL: {e}")
                    return f"s3://{self.s3_bucket}/{storage_key}"
        else:
            # Return relative path for local storage
            return f"/uploads/voice/{storage_key}"
    
    async def _update_message_record(
        self,
        message_id: str,
        media_url: str,
        media_mime: str
    ) -> None:
        """Update message record with transcoded media info"""
        db = await get_database()
        
        update_data = {
            'media_url': media_url,
            'media_mime': media_mime,
            'transcoding_status': 'completed',
            'transcoded_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        
        result = await db.messages.update_one(
            {'_id': PyObjectId(message_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            logger.warning(f"Message {message_id} not found or already updated")
        else:
            logger.info(f"Updated message {message_id} with transcoded URL")
    
    async def _mark_transcode_failed(self, message_id: str, error: str) -> None:
        """Mark message as failed transcoding"""
        db = await get_database()
        
        await db.messages.update_one(
            {'_id': PyObjectId(message_id)},
            {'$set': {
                'transcoding_status': 'failed',
                'transcoding_error': error,
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        logger.info(f"Marked message {message_id} as failed transcoding")
    
    async def _emit_transcode_complete_event(
        self,
        message_id: str,
        media_url: str
    ) -> None:
        """Emit WebSocket event when transcoding completes"""
        try:
            # Get message details for event
            db = await get_database()
            message = await db.messages.find_one({'_id': PyObjectId(message_id)})
            
            if not message:
                logger.warning(f"Message {message_id} not found for event emission")
                return
            
            event_data = {
                'type': 'voice_message_ready',
                'data': {
                    'message_id': str(message['_id']),
                    'conversation_id': str(message.get('conversation_id', '')),
                    'media_url': media_url,
                    'media_mime': TARGET_MIME_TYPE,
                    'duration': message.get('media_duration_s'),
                    'transcoded_at': datetime.now(timezone.utc).isoformat()
                }
            }
            
            # Send to sender
            sender_id = str(message['sender_id'])
            await websocket_manager.send_personal_message(event_data, sender_id)
            
            # If in conversation, broadcast to conversation participants
            if message.get('conversation_id'):
                # Note: Would need conversation_id to room mapping
                # For now, just send to sender
                pass
            
            logger.info(f"Emitted voice_message_ready event for message {message_id}")
            
        except Exception as e:
            logger.error(f"Failed to emit transcode event: {e}")
            # Don't raise - event emission failure shouldn't fail the transcode
    
    def _cleanup_temp_files(self, *file_paths: Optional[str]) -> None:
        """Remove temporary files"""
        for file_path in file_paths:
            if file_path and Path(file_path).exists():
                try:
                    Path(file_path).unlink()
                    logger.debug(f"Cleaned up temp file: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup {file_path}: {e}")


# Global worker instance
transcoding_worker = VoiceTranscodingWorker()


async def start_transcode_job(
    message_id: str,
    storage_key: str,
    storage_backend: str = 'local'
) -> None:
    """
    Start a transcoding job (can be called as FastAPI BackgroundTask)
    
    Args:
        message_id: Message ID to transcode
        storage_key: Storage key of original file
        storage_backend: 'local' or 's3'
    """
    try:
        await transcoding_worker.transcode_voice_message(
            message_id=message_id,
            storage_key=storage_key,
            storage_backend=storage_backend
        )
    except Exception as e:
        logger.error(f"Transcode job failed for {message_id}: {e}")
