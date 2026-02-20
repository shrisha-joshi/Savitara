"""
Voice Messages API Router
Endpoints for voice message upload, creation, and playback
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request, BackgroundTasks
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.core.security import get_current_user
from app.models.database import User, Message
from app.services.voice_service import voice_service, MAX_VOICE_SIZE_BYTES, MAX_DURATION_SECONDS
from app.schemas.requests import StandardResponse
from app.workers.voice_transcode_worker import start_transcode_job


router = APIRouter(prefix="/voice", tags=["Voice Messages"])


# Request/Response Schemas

class UploadURLRequest(BaseModel):
    """Request for presigned upload URL"""
    mime_type: str = Field(..., description="Audio MIME type (e.g., audio/webm)")
    file_size_bytes: int = Field(..., gt=0, le=MAX_VOICE_SIZE_BYTES, description="File size in bytes")
    
    @field_validator('mime_type')
    @classmethod
    def validate_mime_type(cls, v: str) -> str:
        if not v.startswith('audio/'):
            raise ValueError("MIME type must start with 'audio/'")
        return v


class UploadURLResponse(BaseModel):
    """Response with upload URL"""
    upload_url: str
    storage_key: str  # s3_key or file_path
    upload_token: Optional[str] = None  # For local uploads
    expires_at: str
    storage_backend: str


class CreateVoiceMessageRequest(BaseModel):
    """Request to create voice message after upload"""
    conversation_id: Optional[str] = None
    receiver_id: Optional[str] = None
    storage_key: str = Field(..., description="S3 key or file path from upload URL response")
    mime_type: str
    duration_seconds: Optional[int] = Field(None, ge=1, le=MAX_DURATION_SECONDS)
    waveform: Optional[List[float]] = Field(None, max_length=100, description="Waveform amplitude data")
    storage_backend: str = Field(default='local', description="Storage backend used")
    
    @field_validator('conversation_id', 'receiver_id')
    @classmethod
    def validate_ids(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) == 0:
            return None
        return v


class VoiceMessageResponse(BaseModel):
    """Voice message response"""
    id: str
    conversation_id: Optional[str]
    sender_id: str
    receiver_id: Optional[str]
    media_url: str
    media_mime: str
    media_duration_s: Optional[int]
    media_waveform: Optional[List[float]]
    created_at: str


class VoiceStorageUsageResponse(BaseModel):
    """User's voice storage usage"""
    count: int
    total_duration_seconds: int
    estimated_size_mb: float


# Endpoints

@router.post("/upload-url", response_model=StandardResponse[UploadURLResponse])
async def request_upload_url(
    request: UploadURLRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Request presigned upload URL for voice message
    
    **For S3**: Returns presigned PUT URL. Upload directly to S3.
    **For Local**: Returns upload endpoint and token.
    
    **Validations:**
    - MIME type must be audio/*
    - File size <= 10MB
    - URL expires in 10 minutes
    """
    try:
        result = await voice_service.get_upload_url(
            user_id=str(current_user.id),
            mime_type=request.mime_type,
            file_size_bytes=request.file_size_bytes
        )
        
        # Map to response schema
        response_data = UploadURLResponse(
            upload_url=result['upload_url'],
            storage_key=result.get('s3_key') or result.get('file_path'),
            upload_token=result.get('upload_token'),
            expires_at=result['expires_at'],
            storage_backend=result['storage_backend']
        )
        
        return StandardResponse(
            status="success",
            message="Upload URL generated successfully",
            data=response_data
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/upload/{upload_token}", include_in_schema=False)
async def upload_voice_file_local(
    upload_token: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload voice file to local storage (development only)
    
    **Note:** In production, use S3 direct upload instead.
    This endpoint is hidden from OpenAPI docs.
    """
    # Read file content
    content = await file.read()
    
    # Validate size
    if len(content) > MAX_VOICE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum {MAX_VOICE_SIZE_BYTES} bytes"
        )
    
    # Handle upload
    try:
        result = await voice_service.handle_local_upload(upload_token, content)
        
        return StandardResponse(
            status="success",
            message="File uploaded successfully",
            data=result
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/messages", response_model=StandardResponse[VoiceMessageResponse])
async def create_voice_message(
    request: CreateVoiceMessageRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Create voice message record after file upload
    
    **Call this after:**
    1. Getting upload URL from `/upload-url`
    2. Uploading file to S3 (or local endpoint)
    
    **Required:**
    - storage_key: From upload URL response
    - One of: conversation_id OR receiver_id
    
    **Optional:**
    - duration_seconds: If known from client-side recording
    - waveform: Array of amplitude values for waveform visualization
    
    **Post-Processing:**
    - Server transcodes to Opus format (48kbps) in background
    - WebSocket event 'voice_message_ready' emitted when ready
    """
    # Validate conversation/receiver
    if not request.conversation_id and not request.receiver_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either conversation_id or receiver_id must be provided"
        )
    
    try:
        message = await voice_service.create_voice_message(
            conversation_id=request.conversation_id,
            sender_id=str(current_user.id),
            receiver_id=request.receiver_id,
            storage_key=request.storage_key,
            mime_type=request.mime_type,
            duration_seconds=request.duration_seconds,
            waveform=request.waveform,
            storage_backend=request.storage_backend
        )
        
        # Trigger background transcoding (only if not already Opus format)
        if request.mime_type not in ['audio/ogg; codecs=opus', 'audio/ogg']:
            background_tasks.add_task(
                start_transcode_job,
                message_id=str(message.id),
                storage_key=request.storage_key,
                storage_backend=request.storage_backend
            )
        
        # Convert to response
        response_data = VoiceMessageResponse(
            id=str(message.id),
            conversation_id=str(message.conversation_id) if message.conversation_id else None,
            sender_id=str(message.sender_id),
            receiver_id=str(message.receiver_id) if message.receiver_id else None,
            media_url=message.media_url,
            media_mime=message.media_mime,
            media_duration_s=message.media_duration_s,
            media_waveform=message.media_waveform,
            created_at=message.created_at.isoformat()
        )
        
        return StandardResponse(
            status="success",
            message="Voice message created successfully. Transcoding in progress." if request.mime_type not in ['audio/ogg; codecs=opus', 'audio/ogg'] else "Voice message created successfully",
            data=response_data
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/messages/{message_id}", response_model=StandardResponse[dict])
async def delete_voice_message(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete voice message (soft delete)
    
    **Permission:** Only message sender can delete
    **Effect:** Sets deleted_at timestamp and clears media_url
    **Note:** File remains in storage for 30 days for moderation review
    """
    try:
        await voice_service.delete_voice_message(
            message_id=message_id,
            user_id=str(current_user.id)
        )
        
        return StandardResponse(
            status="success",
            message="Voice message deleted successfully",
            data={"message_id": message_id, "deleted": True}
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/storage-usage", response_model=StandardResponse[VoiceStorageUsageResponse])
async def get_storage_usage(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's voice message storage usage
    
    **Returns:**
    - count: Total voice messages
    - total_duration_seconds: Sum of all durations
    - estimated_size_mb: Estimated storage size
    
    **Note:** Size is estimated based on 48kbps Opus encoding
    """
    usage = await voice_service.get_user_voice_storage_usage(str(current_user.id))
    
    response_data = VoiceStorageUsageResponse(**usage)
    
    return StandardResponse(
        status="success",
        message="Storage usage retrieved successfully",
        data=response_data
    )


@router.get("/playback-url/{message_id}", response_model=StandardResponse[dict])
async def get_playback_url(
    message_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get playback URL for a voice message
    
    **S3 Storage:** Returns presigned GET URL (expires in 1 hour)
    **Local Storage:** Returns media server path
    
    **Permission:** User must be participant in the conversation
    """
    from app.db.connection import get_database
    from app.models.database import PyObjectId, MessageType
    
    db = await get_database()
    
    # Find message
    message = await db.messages.find_one({
        '_id': PyObjectId(message_id),
        'message_type': MessageType.VOICE.value,
        'deleted_at': None
    })
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Voice message not found"
        )
    
    # Check conversation membership  
    conversation_id = message.get('conversation_id')
    if conversation_id:
        # Verify user is a participant in the conversation
        conv_check = await db.conversations.find_one({
            '_id': conversation_id,
            'participants': PyObjectId(str(current_user.id))
        })
        
        if not conv_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this voice message"
            )
    
    # Extract storage key from media_url
    media_url = message.get('media_url', '')
    
    # If already a full URL (S3 presigned), return as-is
    if media_url.startswith('http'):
        return StandardResponse(
            status="success",
            message="Playback URL retrieved",
            data={
                "message_id": message_id,
                "media_url": media_url,
                "media_mime": message.get('media_mime'),
                "duration_seconds": message.get('media_duration_s')
            }
        )
    
    # Otherwise, generate fresh presigned URL
    # Extract storage key from path
    storage_key = media_url.replace('/media/voice/', '')
    # In production, store storage_backend in message metadata
    # For now, infer from URL structure: S3 URLs start with http, local paths don't
    storage_backend = 's3' if media_url.startswith('http') else 'local'
    
    try:
        playback_url = voice_service.get_media_url(
            storage_key=storage_key,
            storage_backend=storage_backend,
            expires_in=3600  # 1 hour
        )
        
        return StandardResponse(
            status="success",
            message="Playback URL generated",
            data={
                "message_id": message_id,
                "media_url": playback_url,
                "media_mime": message.get('media_mime'),
                "duration_seconds": message.get('media_duration_s'),
                "waveform": message.get('media_waveform')
            }
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate playback URL: {str(e)}"
        )
