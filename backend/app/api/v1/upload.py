from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Tuple
import os
import uuid
from pathlib import Path
import logging
import aiofiles

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure upload directory
UPLOAD_DIR = Path("uploads/documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed file types
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}
ALLOWED_MIME_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
CHUNK_SIZE = 1024 * 1024  # 1MB chunks


def validate_filename(filename: str) -> str:
    """Ensure filename is safe and doesn't contain path traversal"""
    basename = os.path.basename(filename)
    if basename != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return basename


def _validate_file_type(file: UploadFile) -> str:
    """Validate file extension and MIME type. Returns file extension."""
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File extension {file_ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"MIME type {file.content_type} not allowed."
        )
    
    return file_ext


async def _save_file_with_size_check(file: UploadFile, file_path: Path, original_filename: str) -> None:
    """Save uploaded file asynchronously with size checking"""
    total_size = 0
    
    async with aiofiles.open(file_path, "wb") as buffer:
        while chunk := await file.read(CHUNK_SIZE):
            total_size += len(chunk)
            
            if total_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File {original_filename} exceeds maximum size of 10MB"
                )
            
            await buffer.write(chunk)


async def _process_single_file(file: UploadFile) -> str:
    """Process and save a single file. Returns the file URL."""
    file_ext = _validate_file_type(file)
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    try:
        await _save_file_with_size_check(file, file_path, file.filename)
        logger.info(f"File uploaded successfully: {unique_filename}")
        return f"/uploads/documents/{unique_filename}"
    except HTTPException:
        # Clean up partial file on validation error
        if file_path.exists():
            file_path.unlink()
        raise
    except Exception as e:
        # Clean up on unexpected error
        if file_path.exists():
            file_path.unlink()
        logger.error(f"Failed to upload {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload {file.filename}")


@router.post("/documents")
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Upload multiple documents for KYC verification.
    
    Accepts: PDF, JPG, JPEG, PNG, DOC, DOCX
    Max size: 10MB per file
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    uploaded_urls = [await _process_single_file(file) for file in files]
    
    return {
        "success": True,
        "data": {
            "urls": uploaded_urls,
            "count": len(uploaded_urls)
        },
        "message": f"{len(uploaded_urls)} document(s) uploaded successfully"
    }


@router.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Delete an uploaded document"""
    # Sanitize filename
    safe_filename = validate_filename(filename)
    
    file_path = UPLOAD_DIR / safe_filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        file_path.unlink()
        logger.info(f"File deleted: {safe_filename}")
        return {
            "success": True,
            "message": "Document deleted successfully"
        }
    except Exception as e:
        logger.error(f"Error deleting file {safe_filename}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete file")
