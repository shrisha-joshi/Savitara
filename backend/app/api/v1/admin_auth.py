"""
Admin Authentication API Endpoints
Email/Password based admin authentication with super admin management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any, Optional
from pydantic import BaseModel, EmailStr
import logging
from datetime import datetime, timezone

from app.core.security import SecurityManager, get_current_admin
from app.db.connection import get_db
from app.schemas.requests import StandardResponse
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/auth", tags=["Admin Authentication"])
security_manager = SecurityManager()

# Super admin email read from environment — SonarQube: S6437 no hardcoded secrets
SUPER_ADMIN_EMAIL = settings.SUPER_ADMIN_EMAIL


# Request/Response Models
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminEmailCheckRequest(BaseModel):
    email: EmailStr


class AdminSetupPasswordRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str


class AddAdminRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None


class RemoveAdminRequest(BaseModel):
    email: EmailStr


class AdminUserResponse(BaseModel):
    email: str
    name: Optional[str]
    is_super_admin: bool
    created_at: datetime
    last_login: Optional[datetime]
    has_password: bool


@router.post(
    "/login",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin Email/Password Login",
    description="Authenticate admin with email and password",
)
async def admin_login(
    request: AdminLoginRequest, db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Admin login with email/password

    Flow:
    1. Check if admin exists in admin_users collection
    2. Verify password
    3. Generate JWT tokens
    4. Return tokens and admin info
    """
    try:
        # Find admin user
        admin = await db.admin_users.find_one({"email": request.email.lower()})

        if not admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Check if password is set
        if not admin.get("password_hash"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Password not set. Please set up your password first.",
            )

        # Verify password
        if not security_manager.verify_password(
            request.password, admin["password_hash"]
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Update last login
        await db.admin_users.update_one(
            {"email": request.email.lower()},
            {"$set": {"last_login": datetime.now(timezone.utc)}},
        )

        # Generate JWT tokens
        access_token = security_manager.create_access_token(
            user_id=str(admin["_id"]), role="admin"
        )
        refresh_token = security_manager.create_refresh_token(user_id=str(admin["_id"]))

        return StandardResponse(
            success=True,
            message="Login successful",
            data={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "user": {
                    "id": str(admin["_id"]),
                    "email": admin["email"],
                    "name": admin.get("name", admin["email"].split("@")[0]),
                    "role": "admin",
                    "is_super_admin": admin["email"] == SUPER_ADMIN_EMAIL,
                },
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed"
        )


@router.post(
    "/check-email",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Check Admin Email Status",
    description="Check if an email is registered as admin and if password is set",
)
async def check_admin_email(
    request: AdminEmailCheckRequest, db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Check if email is registered and if password is set"""
    try:
        admin = await db.admin_users.find_one({"email": request.email.lower()})

        if not admin:
            return StandardResponse(
                success=False,
                message="Email not registered as admin",
                data={"is_admin": False, "has_password": False},
            )

        return StandardResponse(
            success=True,
            message="Admin found",
            data={
                "is_admin": True,
                "has_password": bool(admin.get("password_hash")),
                "name": admin.get("name"),
                "is_super_admin": admin["email"] == SUPER_ADMIN_EMAIL,
            },
        )
    except Exception as e:
        logger.error(f"Check email error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check email",
        )


@router.post(
    "/setup-password",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Setup Admin Password",
    description="Set password for first-time admin login",
)
async def setup_admin_password(
    request: AdminSetupPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Setup password for first-time admin login
    Only works if:
    1. Email is registered as admin
    2. Password is not already set
    """
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match"
        )

    if len(request.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    # Find admin user
    admin = await db.admin_users.find_one({"email": request.email.lower()})

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not registered as admin",
        )

    if admin.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password already set. Use login instead.",
        )

    # Set password
    password_hash = security_manager.get_password_hash(request.password)
    await db.admin_users.update_one(
        {"email": request.email.lower()},
        {
            "$set": {
                "password_hash": password_hash,
                "password_set_at": datetime.now(timezone.utc),
            }
        },
    )

    logger.info(f"Password set for admin: {request.email}")

    return StandardResponse(
        success=True, message="Password set successfully. You can now login.", data={}
    )


@router.get(
    "/admins",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="List All Admins",
    description="Get list of all admin users (Super Admin only)",
)
async def list_admins(
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all admin users - Super Admin only"""
    # Get current admin email
    admin_doc = await db.admin_users.find_one({"_id": current_admin.get("_id")})
    if not admin_doc or admin_doc.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can view all admins",
        )

    admins = await db.admin_users.find({}).to_list(length=100)

    admin_list = []
    for admin in admins:
        admin_list.append(
            {
                "id": str(admin["_id"]),
                "email": admin["email"],
                "name": admin.get("name"),
                "is_super_admin": admin["email"] == SUPER_ADMIN_EMAIL,
                "has_password": bool(admin.get("password_hash")),
                "created_at": admin.get("created_at"),
                "last_login": admin.get("last_login"),
            }
        )

    return StandardResponse(
        success=True,
        message=f"Found {len(admin_list)} admins",
        data={"admins": admin_list},
    )


@router.post(
    "/add-admin",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add New Admin",
    description="Add a new admin email (Super Admin only)",
)
async def add_admin(
    request: AddAdminRequest,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Add new admin - Super Admin only"""
    # Get current admin email
    admin_doc = await db.admin_users.find_one({"_id": current_admin.get("_id")})
    if not admin_doc or admin_doc.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can add new admins",
        )

    # Check if email already exists
    existing = await db.admin_users.find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered as admin",
        )

    # Add new admin
    new_admin = {
        "email": request.email.lower(),
        "name": request.name,
        "created_at": datetime.now(timezone.utc),
        "created_by": SUPER_ADMIN_EMAIL,
        "password_hash": None,  # Will be set on first login
        "last_login": None,
    }

    result = await db.admin_users.insert_one(new_admin)

    logger.info(f"New admin added: {request.email} by {SUPER_ADMIN_EMAIL}")

    return StandardResponse(
        success=True,
        message=f"Admin {request.email} added successfully. They can now set their password.",
        data={"admin_id": str(result.inserted_id), "email": request.email},
    )


@router.delete(
    "/remove-admin",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove Admin",
    description="Remove an admin (Super Admin only)",
)
async def remove_admin(
    request: RemoveAdminRequest,
    current_admin: Dict[str, Any] = Depends(get_current_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Remove admin - Super Admin only"""
    # Get current admin email
    admin_doc = await db.admin_users.find_one({"_id": current_admin.get("_id")})
    if not admin_doc or admin_doc.get("email") != SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can remove admins",
        )

    # Cannot remove super admin
    if request.email.lower() == SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove super admin"
        )

    # Remove admin
    result = await db.admin_users.delete_one({"email": request.email.lower()})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found"
        )

    logger.info(f"Admin removed: {request.email} by {SUPER_ADMIN_EMAIL}")

    return StandardResponse(
        success=True, message=f"Admin {request.email} removed successfully", data={}
    )


@router.post(
    "/init-super-admin",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Initialize Super Admin",
    description="Create super admin account if not exists (internal use)",
)
async def init_super_admin(db: AsyncIOMotorDatabase = Depends(get_db)):
    """
    Initialize super admin account
    This endpoint creates the super admin if it doesn't exist
    Should be called once during system setup
    """
    try:
        existing = await db.admin_users.find_one({"email": SUPER_ADMIN_EMAIL})

        if existing:
            return StandardResponse(
                success=True,
                message="Super admin already exists",
                data={
                    "email": SUPER_ADMIN_EMAIL,
                    "has_password": bool(existing.get("password_hash")),
                },
            )

        # Create super admin
        super_admin = {
            "email": SUPER_ADMIN_EMAIL,
            "name": "Super Admin",
            "created_at": datetime.now(timezone.utc),
            "created_by": "system",
            "password_hash": None,
            "last_login": None,
        }

        await db.admin_users.insert_one(super_admin)

        logger.info(f"Super admin initialized: {SUPER_ADMIN_EMAIL}")

        return StandardResponse(
            success=True,
            message="Super admin created. Set password to activate.",
            data={"email": SUPER_ADMIN_EMAIL},
        )
    except Exception as e:
        logger.error(f"Init super admin error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize super admin",
        )
