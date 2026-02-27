from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import Annotated, List, Dict, Any
import os
import uuid
from pathlib import Path
import logging
import aiofiles

from app.core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# Configure upload directory - use /tmp in production for write permissions
def _get_upload_dir() -> Path:
    """Get upload directory, handling permission issues in containerized environments."""
    # Try the standard path first
    standard_path = Path("uploads/documents")
    try:
        standard_path.mkdir(parents=True, exist_ok=True)
        return standard_path
    except PermissionError:
        # Fall back to /tmp for containerized environments
        fallback_path = Path("/tmp/uploads/documents")
        fallback_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Using fallback upload directory: {fallback_path}")
        return fallback_path

UPLOAD_DIR = _get_upload_dir()

# Allowed file types
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
# M13 fix: Magic byte signatures for file type validation (cannot be spoofed like content_type)
_MAGIC_BYTES = {
    b"\x25\x50\x44\x46": "application/pdf",        # %PDF
    b"\xff\xd8\xff": "image/jpeg",                   # JPEG SOI
    b"\x89\x50\x4e\x47": "image/png",                # PNG header
    b"\xd0\xcf\x11\xe0": "application/msword",       # OLE2 (DOC)
    b"\x50\x4b\x03\x04": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # ZIP/DOCX
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
            detail=f"File extension {file_ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400, detail=f"MIME type {file.content_type} not allowed."
        )

    return file_ext


async def _validate_magic_bytes(file: UploadFile) -> None:
    """M13 fix: Validate actual file content via magic bytes to prevent MIME spoofing."""
    header = await file.read(8)
    await file.seek(0)  # Reset file position
    if not header:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    for magic in _MAGIC_BYTES:
        if header.startswith(magic):
            return  # Valid file type
    raise HTTPException(
        status_code=400,
        detail="File content does not match any allowed file type. Possible MIME spoofing detected.",
    )


async def _save_file_with_size_check(
    file: UploadFile, file_path: Path, original_filename: str
) -> None:
    """Save uploaded file asynchronously with size checking"""
    total_size = 0

    async with aiofiles.open(file_path, "wb") as buffer:
        while chunk := await file.read(CHUNK_SIZE):
            total_size += len(chunk)

            if total_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File {original_filename} exceeds maximum size of 10MB",
                )

            await buffer.write(chunk)


async def _process_single_file(file: UploadFile) -> str:
    """Process and save a single file. Returns the file URL."""
    file_ext = _validate_file_type(file)
    await _validate_magic_bytes(file)  # M13: Validate actual file content
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


@router.post(
    "/documents",
    responses={
        400: {"description": "Invalid file type, size, or no files provided"},
        500: {"description": "File upload failed"},
    },
)
async def upload_documents(
    files: Annotated[List[UploadFile], File(...)],
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
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
        "data": {"urls": uploaded_urls, "count": len(uploaded_urls)},
        "message": f"{len(uploaded_urls)} document(s) uploaded successfully",
    }


@router.delete(
    "/documents/{filename}",
    responses={
        400: {"description": "Invalid filename"},
        404: {"description": "File not found"},
        500: {"description": "Failed to delete file"},
    },
)
async def delete_document(
    filename: str,
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
):
    """Delete an uploaded document"""
    # Sanitize filename
    safe_filename = validate_filename(filename)

    file_path = UPLOAD_DIR / safe_filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        file_path.unlink()
        logger.info(f"File deleted: {safe_filename}")
        return {"success": True, "message": "Document deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting file {safe_filename}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete file")
