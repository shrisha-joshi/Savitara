"""
Authentication API Endpoints
Handles Google OAuth login, JWT token management
SonarQube: S5122 - Proper CORS handled in main.py
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from typing import Annotated, Dict, Any, Optional
import asyncio
import logging

from app.schemas.requests import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    StandardResponse,
)
from bson import ObjectId
from app.core.config import get_settings
from app.core.security import SecurityManager, get_current_user
from app.core.exceptions import AuthenticationError, InvalidInputError
from app.core.constants import PHONE_REGEX
from app.db.connection import get_db
from app.db.redis import get_redis, blacklist_token
from app.models.database import User, UserRole, UserStatus
from app.services.otp_service import OTPService, EmailOTPService, PasswordResetOTPService
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field, field_validator
from redis.asyncio import Redis
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])
security_manager = SecurityManager()
security = HTTPBearer()
settings = get_settings()

# Error message constants
ADMIN_ROLE_ERROR = "Admin role cannot be self-assigned"
ACCOUNT_SUSPENDED_ERROR = "Account suspended"
SUPPORT_EMAIL = "support@savitara.com"
OTP_REGEX = r"^\d{6}$"

# ── Password-reset request models ────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=320, description="Registered email address")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or "@" not in v:
            raise ValueError("Enter a valid email address")
        return v


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., max_length=320)
    otp: str = Field(..., min_length=6, max_length=6, pattern=OTP_REGEX)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("at least 8 characters")
        if not any(c.islower() for c in v):
            errors.append("a lowercase letter")
        if not any(c.isupper() for c in v):
            errors.append("an uppercase letter")
        if not any(c.isdigit() for c in v):
            errors.append("a number")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return v


def verify_google_token(token: str) -> Dict[str, Any]:
    """
    Verify Google ID token and extract user info
    SonarQube: S4502 - Uses Google's official library for secure token verification
    """
    try:
        # Verify token with Google
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )

        # Verify issuer
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Invalid issuer")

        # Extract user info
        return {
            "email": idinfo["email"],
            "google_id": idinfo["sub"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "email_verified": idinfo.get("email_verified", False),
        }
    except ValueError as e:
        logger.error(f"Google token verification failed: {e}")
        raise AuthenticationError(
            message="Invalid Google token", details={"error": str(e)}
        )


async def verify_google_access_token(access_token: str) -> Dict[str, Any]:
    """
    Verify a Google OAuth2 access token via Google's tokeninfo endpoint.
    Used when the frontend sends an access_token (from @react-oauth/google useGoogleLogin).
    SonarQube: S4502 - Validates audience to prevent token substitution attacks.
    """
    import httpx
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": access_token},
        )
    if resp.status_code != 200:
        raise AuthenticationError(
            message="Invalid Google access token",
            details={"error": resp.text[:200]},
        )
    info = resp.json()
    # Validate audience — ensures token was issued for this application
    if settings.GOOGLE_CLIENT_ID and info.get("aud") != settings.GOOGLE_CLIENT_ID:
        logger.warning(
            f"[GOOGLE_AUTH] Token audience mismatch: got '{info.get('aud')}', "
            f"expected '{settings.GOOGLE_CLIENT_ID}'"
        )
        raise AuthenticationError(
            message="Google token not issued for this application"
        )
    if not info.get("email"):
        raise AuthenticationError(message="Could not retrieve email from Google token")
    return {
        "email": info["email"],
        "google_id": info.get("sub", ""),
        "name": info.get("name"),
        "picture": info.get("picture"),
        "email_verified": str(info.get("email_verified", "")).lower() == "true",
    }


@router.post(
    "/google",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Google OAuth Login",
    description="Authenticate user with Google OAuth and return JWT tokens",
)
async def google_login(
    auth_request: GoogleAuthRequest, db: Annotated[AsyncIOMotorDatabase, Depends(get_db)]
):
    """
    Google OAuth authentication endpoint

    Flow:
    1. Verify Google ID token
    2. Check if user exists, create if new
    3. Generate JWT access + refresh tokens
    4. Return tokens and user info

    SonarQube: S6437 - No hardcoded credentials, uses Google OAuth
    """
    try:
        # Verify Google token (run in thread pool to avoid blocking event loop)
        if auth_request.id_token:
            google_info = await asyncio.to_thread(verify_google_token, auth_request.id_token)
        else:
            google_info = await verify_google_access_token(auth_request.access_token)

        # Prevent admin role self-assignment via OAuth
        if auth_request.role == UserRole.ADMIN:
            raise InvalidInputError(
                message=ADMIN_ROLE_ERROR, field="role"
            )

        if not google_info["email_verified"]:
            raise AuthenticationError(
                message="Email not verified with Google",
                details={"email": google_info["email"]},
            )

        # Check if user exists
        user_doc = await db.users.find_one({"email": google_info["email"]})

        if user_doc:
            # Existing user - update last login and profile info
            update_fields = {
                "google_id": google_info["google_id"],
                "profile_picture": google_info.get("picture"),
                "last_login": datetime.now(timezone.utc),
            }
            # Store name if not already set
            if google_info.get("name") and not user_doc.get("name"):
                update_fields["name"] = google_info["name"]

            await db.users.update_one(
                {"email": google_info["email"]}, {"$set": update_fields}
            )
            user = User(**user_doc)
            is_new_user = False
        else:
            # New user - create account with PENDING status until onboarding
            user = User(
                email=google_info["email"],
                google_id=google_info["google_id"],
                role=auth_request.role,
                status=UserStatus.PENDING,  # Always PENDING for new users until onboarding
                email_verified=True,  # Google verifies email as part of OAuth
                profile_picture=google_info.get("picture"),
                credits=100,  # Welcome bonus
            )

            result = await db.users.insert_one(user.model_dump(by_alias=True))
            user.id = str(result.inserted_id)
            is_new_user = True

            logger.info(f"New user created: {user.email} with role {user.role}")

        # Check user status
        if user.status == UserStatus.SUSPENDED:
            raise AuthenticationError(
                message=ACCOUNT_SUSPENDED_ERROR, details={"contact": SUPPORT_EMAIL}
            )

        if user.status == UserStatus.DELETED:
            raise AuthenticationError(message="Account deleted", details={})

        # Check if user has completed onboarding by checking if profile exists
        profile_collection = (
            "grihasta_profiles"
            if user.role == UserRole.GRIHASTA
            else "acharya_profiles"
        )
        profile = await db[profile_collection].find_one({"user_id": str(user.id)})
        has_completed_onboarding = profile is not None

        # Generate JWT tokens
        access_token = security_manager.create_access_token(
            user_id=str(user.id), role=user.role.value
        )
        refresh_token = security_manager.create_refresh_token(user_id=str(user.id))

        return StandardResponse(
            success=True,
            data={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "role": user.role.value,
                    "status": user.status.value,
                    "credits": user.credits,
                    "is_new_user": is_new_user,
                    "onboarded": has_completed_onboarding,
                    "onboarding_completed": has_completed_onboarding,
                },
            },
            message="Authentication successful",
        )

    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed",
        )


@router.post(
    "/register",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Email Registration",
    description="Register a new user with email and password",
)
async def register(
    request: RegisterRequest, db: Annotated[AsyncIOMotorDatabase, Depends(get_db)]
):
    """
    Register new user with email/password
    """
    try:
        # Check if user exists
        existing_user = await db.users.find_one({"email": request.email})
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Prevent admin role self-assignment via registration
        if request.role == UserRole.ADMIN:
            raise InvalidInputError(
                message=ADMIN_ROLE_ERROR,
                field="role",
            )

        # Create new user - status is PENDING until onboarding is complete
        user = User(
            email=request.email,
            password_hash=security_manager.get_password_hash(request.password),
            name=request.name,
            role=request.role,
            status=UserStatus.PENDING,  # Always PENDING for new users until onboarding
            email_verified=False,  # Must verify email before tokens are issued
            credits=100,  # Welcome bonus
        )

        result = await db.users.insert_one(
            user.model_dump(by_alias=True, exclude_none=True)
        )
        user_id = str(result.inserted_id)

        # Send email OTP — user must verify before they can log in
        otp_result = await EmailOTPService.send_otp(db, request.email)
        if not otp_result["sent"]:
            # Clean up the user we just created if OTP send failed
            await db.users.delete_one({"_id": result.inserted_id})
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not send verification email. Please try again.",
            )

        return StandardResponse(
            success=True,
            message="Account created! Please check your email for the verification code.",
            data={
                "user_id": user_id,
                "email": user.email,
                "requires_email_verification": True,
                "expires_in": otp_result["expires_in"],
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again.",
        )


@router.post(
    "/login",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Email Login",
    description="Authenticate user with email and password",
)
async def login(request: LoginRequest, db: Annotated[AsyncIOMotorDatabase, Depends(get_db)]):
    """
    Login with email/password
    """
    try:
        # Find user
        user_doc = await db.users.find_one({"email": request.email})
        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No account found with this email. Please sign up first.",
            )

        user = User(**user_doc)

        # Verify password
        if not user.password_hash or not security_manager.verify_password(
            request.password, user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Check status
        if user.status == UserStatus.SUSPENDED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=ACCOUNT_SUSPENDED_ERROR
            )

        # Block login for unverified email accounts (Google OAuth users are always verified)
        if not getattr(user, 'email_verified', False) and not user.google_id:
            # Resend OTP — user will be redirected to the OTP verification screen
            await EmailOTPService.send_otp(db, request.email)
            return StandardResponse(
                success=False,
                message="Email not verified. A verification code has been sent to your email.",
                data={
                    "requires_email_verification": True,
                    "email": request.email,
                    "expires_in": 600,
                },
            )

        # Update last login
        from bson import ObjectId
        user_obj_id = ObjectId(user.id) if isinstance(user.id, str) else user.id
        await db.users.update_one(
            {"_id": user_obj_id}, {"$set": {"last_login": datetime.now(timezone.utc)}}
        )

        # Check if user has completed onboarding by checking if profile exists
        profile_collection = (
            "grihasta_profiles"
            if user.role == UserRole.GRIHASTA
            else "acharya_profiles"
        )
        profile = await db[profile_collection].find_one({"user_id": str(user.id)})
        has_completed_onboarding = profile is not None

        # Generate tokens
        access_token = security_manager.create_access_token(
            user_id=str(user.id), role=user.role.value
        )

        refresh_token = security_manager.create_refresh_token(user_id=str(user.id))

        return StandardResponse(
            success=True,
            message="Login successful",
            data={
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "role": user.role.value,
                    "status": user.status.value,
                    "credits": user.credits,
                    "is_new_user": False,
                    "onboarded": has_completed_onboarding,
                    "onboarding_completed": has_completed_onboarding,
                },
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed. Please try again.",
        )


@router.post(
    "/refresh",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    description="Get new access token using refresh token",
)
async def refresh_token(
    refresh_request: RefreshTokenRequest, db: Annotated[AsyncIOMotorDatabase, Depends(get_db)]
):
    """
    Refresh access token

    SonarQube: Token rotation prevents replay attacks
    """
    try:
        # Verify refresh token
        payload = security_manager.verify_token(refresh_request.refresh_token)

        # Validate token type
        if payload.get("type") != "refresh":
            raise AuthenticationError(
                message="Invalid token type. Expected refresh token."
            )

        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError(message="Invalid token payload")

        # Verify user still exists and is active
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            raise AuthenticationError(message="User not found")

        user = User(**user_doc)
        if user.status in [UserStatus.SUSPENDED, UserStatus.DELETED]:
            raise AuthenticationError(message="Account not active")

        # Generate new tokens
        access_token = security_manager.create_access_token(
            user_id=str(user.id), role=user.role.value
        )
        new_refresh_token = security_manager.create_refresh_token(user_id=str(user.id))

        return StandardResponse(
            success=True,
            data={
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            },
            message="Token refreshed successfully",
        )

    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token refresh failed"
        )


@router.post(
    "/logout",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Logout",
    description="Invalidate user session (client should delete tokens)",
)
async def logout(
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    redis: Annotated[Optional[Redis], Depends(get_redis)] = None,
):
    """
    Logout endpoint — blacklists the token JTI in Redis so it cannot be reused.
    Client MUST also delete tokens locally.
    SonarQube: S2068 - No password in code
    """
    user_id = current_user["id"]
    jti = current_user.get("jti")
    logger.info(f"User {user_id} logged out")

    # Blacklist the access token so it is rejected on future requests
    if jti and redis is not None:
        try:
            from app.core.config import settings
            ttl_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            await blacklist_token(redis, jti, ttl_seconds)
            logger.info(f"Token {jti[:8]}... blacklisted for user {user_id}")
        except Exception as exc:
            # Non-fatal — client still deletes tokens; log for ops awareness
            logger.warning(f"Could not blacklist token in Redis: {exc}")
    elif not redis:
        logger.warning("Redis unavailable — token not server-side blacklisted")

    return StandardResponse(
        success=True,
        message="Logged out successfully. Please delete tokens on client side.",
    )


@router.get(
    "/me",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User",
    description="Get authenticated user information",
)
async def get_current_user_info(
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Get current authenticated user information
    """
    from bson import ObjectId
    
    # Convert user_id to ObjectId if it's a string
    user_id = current_user["id"]
    if isinstance(user_id, str):
        user_id = ObjectId(user_id)
    
    user_doc = await db.users.find_one({"_id": user_id})

    if not user_doc:
        raise AuthenticationError(message="User not found")

    user = User(**user_doc)

    # Check if user has completed onboarding by checking if profile exists
    profile_collection = (
        "grihasta_profiles" if user.role == UserRole.GRIHASTA else "acharya_profiles"
    )
    profile = await db[profile_collection].find_one({"user_id": str(user.id)})
    has_completed_onboarding = profile is not None

    return StandardResponse(
        success=True,
        data={
            "id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "status": user.status.value,
            "credits": user.credits,
            "profile_picture": getattr(user, "profile_picture", None),
            "created_at": user.created_at,
            "last_login": user.last_login,
            "onboarded": has_completed_onboarding,
            "onboarding_completed": has_completed_onboarding,
        },
    )

@router.post(
    "/forgot-password",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Request Password Reset OTP",
    description=(
        "Send a password-reset OTP to the given email address. "
        "Returns success regardless of whether the email is registered "
        "(security: does not reveal account existence)."
    ),
)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    SonarQube: S5131 — response does not reveal whether the email exists.
    Sends OTP to any registered user (including Google OAuth users who want to add a password).
    When DEBUG=True the OTP is included in the response for development convenience.
    """
    is_debug = getattr(settings, "DEBUG", False)
    otp_hint: Optional[str] = None

    user_doc = await db.users.find_one({"email": request.email})
    if user_doc:
        # Send reset OTP regardless of auth method (email/password OR Google OAuth)
        result = await PasswordResetOTPService.send_otp(db, request.email)
        if result.get("sent"):
            logger.info(f"[FORGOT_PW] Reset OTP dispatched for {request.email}")
            # Only expose the OTP in the response when SMTP failed to deliver it
            # (e.g. SMTP not configured, credentials expired, network error).
            # When email_delivered=True the user already has the code in their inbox.
            if is_debug and not result.get("email_delivered"):
                otp_hint = result.get("otp")

    # Always return the same message to avoid leaking account existence
    return StandardResponse(
        success=True,
        message="If an account exists for this email, a reset code has been sent.",
        data={"debug_otp": otp_hint} if is_debug and otp_hint else {},
    )


@router.post(
    "/reset-password",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset Password with OTP",
    description="Verify the 6-digit reset OTP and set a new password.",
)
async def reset_password(
    request: ResetPasswordRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Flow:
    1. Verify and consume the one-time reset OTP.
    2. Validate the new password differs from the current one.
    3. Store the new bcrypt hash.
    """
    # 1. Verify and consume OTP
    verification = await PasswordResetOTPService.verify_and_consume(
        db, request.email, request.otp
    )
    if not verification["verified"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=verification["error"],
        )

    # 2. Look up user
    user_doc = await db.users.find_one({"email": request.email})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No account found for this email.",
        )

    user = User(**user_doc)
    if user.status == UserStatus.SUSPENDED:
        raise AuthenticationError(
            message=ACCOUNT_SUSPENDED_ERROR, details={"contact": SUPPORT_EMAIL}
        )

    existing_hash = user_doc.get("password_hash")

    # 3. If the user already has a password, ensure the new one is different
    if existing_hash and security_manager.verify_password(request.new_password, existing_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password.",
        )

    # 4. Hash and persist the new password (first-time set for Google OAuth users is fine)
    new_hash = security_manager.get_password_hash(request.new_password)
    await db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc)}},
    )

    logger.info(f"[RESET_PW] Password updated for user {str(user.id)}")

    return StandardResponse(
        success=True,
        message="Your password has been reset successfully. Please sign in with your new password.",
        data={},
    )

@router.post(
    "/ws-ticket",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Issue WebSocket Ticket",
    description=(
        "Issues a short-lived one-time ticket for authenticating a WebSocket "
        "connection. Pass the returned ticket as the 'ticket' query parameter "
        "instead of the JWT token to avoid exposing long-lived credentials in URLs."
    ),
)
async def issue_ws_ticket(
    current_user: Annotated[Dict[str, Any], Depends(get_current_user)] = None,
    redis: Annotated[Optional[Redis], Depends(get_redis)] = None,
):
    """
    Generates a 64-byte random ticket stored in Redis (TTL=60 s).
    The WebSocket endpoint redeems and deletes the ticket on first use.
    """
    import secrets as _secrets

    ticket = _secrets.token_urlsafe(48)  # 64 URL-safe chars
    user_id = current_user["id"]

    if redis is not None:
        try:
            # Store as "ws_ticket:<ticket>" → user_id with 60 s TTL
            await redis.setex(f"ws_ticket:{ticket}", 60, user_id)
        except Exception as exc:
            logger.warning(f"Could not store WS ticket in Redis: {exc}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ticket service temporarily unavailable",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis not available — cannot issue WebSocket ticket",
        )

    return StandardResponse(
        success=True,
        data={"ticket": ticket, "ttl_seconds": 60},
        message="Connect within 60 seconds using this ticket",
    )


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Auth Health Check",
    description="Check if authentication service is working",
)
async def auth_health_check():
    """Health check endpoint for auth service"""
    return {
        "status": "healthy",
        "service": "authentication",
        "google_oauth": "configured" if settings.GOOGLE_CLIENT_ID else "not_configured",
    }


# ============= Phone OTP Authentication (Strategy Report §12.5 #3) =============


class PhoneSendOTPRequest(BaseModel):
    """Request to send OTP to phone"""
    phone: str = Field(..., pattern=PHONE_REGEX, description="Phone number with country code")


class PhoneVerifyOTPRequest(BaseModel):
    """Request to verify phone OTP and login/register"""
    phone: str = Field(..., pattern=PHONE_REGEX)
    otp: str = Field(..., min_length=6, max_length=6, pattern=OTP_REGEX)
    role: UserRole = Field(UserRole.GRIHASTA, description="Role for new users")

    @field_validator("role")
    @classmethod
    def restrict_admin_role(cls, v: UserRole) -> UserRole:
        if v == UserRole.ADMIN:
            raise ValueError(ADMIN_ROLE_ERROR)
        return v


@router.post(
    "/phone/send-otp",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Send Phone OTP",
    description="Send a 6-digit OTP to the provided phone number for authentication",
)
async def phone_send_otp(
    request: PhoneSendOTPRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Send OTP to phone number for authentication.
    Strategy Report §12.5 #3: Phone-number OTP login — unblocks Acharya onboarding at scale.
    """
    result = await OTPService.send_otp(db, request.phone)

    if not result["sent"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=result["message"],
        )

    return StandardResponse(
        success=True,
        data={"expires_in": result["expires_in"]},
        message=result["message"],
    )


@router.post(
    "/phone/verify-otp",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Phone OTP & Login",
    description="Verify OTP and authenticate. Creates account if phone is new.",
)
async def phone_verify_otp(
    request: PhoneVerifyOTPRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Verify phone OTP. If user exists, logs in; if not, creates new account.
    Strategy Report §12.5 #3.
    """
    # Verify OTP first
    verification = await OTPService.verify_otp(db, request.phone, request.otp)

    if not verification["verified"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=verification["error"],
        )

    phone = verification["phone"]

    # Find user by phone number (check profiles and users)
    user_doc = await db.users.find_one({"phone": phone})

    if not user_doc:
        # Also search in grihasta/acharya profiles by phone
        profile = await db.grihasta_profiles.find_one({"phone": phone})
        if not profile:
            profile = await db.acharya_profiles.find_one({"phone": phone})
        if profile:
            user_doc = await db.users.find_one({"_id": ObjectId(profile["user_id"])})

    if user_doc:
        # Existing user — login
        user = User(**user_doc)

        if user.status == UserStatus.SUSPENDED:
            raise AuthenticationError(
                message=ACCOUNT_SUSPENDED_ERROR,
                details={"contact": SUPPORT_EMAIL},
            )
        if user.status == UserStatus.DELETED:
            raise AuthenticationError(message="Account deleted")

        # Update last login
        await db.users.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"last_login": datetime.now(timezone.utc), "phone": phone}},
        )

        is_new_user = False
        user_id = str(user.id)

        # Check onboarding status
        profile_collection = (
            "grihasta_profiles" if user.role == UserRole.GRIHASTA else "acharya_profiles"
        )
        profile = await db[profile_collection].find_one({"user_id": user_id})
        has_onboarded = profile is not None
    else:
        # New user — create account with phone
        new_user = User(
            email=f"{phone.replace('+', '')}@phone.savitara.com",  # Placeholder email
            phone=phone,
            role=request.role,
            status=UserStatus.PENDING,
            credits=100,  # Welcome bonus
        )
        result = await db.users.insert_one(
            {**new_user.model_dump(by_alias=True, exclude_none=True), "phone": phone}
        )
        user_id = str(result.inserted_id)
        is_new_user = True
        has_onboarded = False

        logger.info(f"New phone user created: {phone} with role {request.role}")

    # Generate JWT tokens
    role_value = request.role.value if is_new_user else user.role.value
    access_token = security_manager.create_access_token(
        user_id=user_id, role=role_value,
    )
    refresh_token = security_manager.create_refresh_token(user_id=user_id)

    return StandardResponse(
        success=True,
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": user_id,
                "phone": phone,
                "role": role_value,
                "is_new_user": is_new_user,
                "onboarded": has_onboarded,
                "onboarding_completed": has_onboarded,
            },
        },
        message="Phone authentication successful",
    )


# ============= Email OTP Verification =============


class EmailSendOTPRequest(BaseModel):
    """Request to resend email verification OTP"""
    email: str = Field(..., description="Email address to send OTP to")


class EmailVerifyOTPRequest(BaseModel):
    """Request to verify email with OTP"""
    email: str = Field(..., description="Email address that was registered")
    otp: str = Field(..., min_length=6, max_length=6, pattern=OTP_REGEX, description="6-digit code from email")


@router.post(
    "/email/send-otp",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Send Email Verification OTP",
    description="Send or resend a 6-digit OTP to the provided email address for verification",
)
async def email_send_otp(
    request: EmailSendOTPRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Send or resend email verification OTP.
    Rate-limited: 60-second cooldown between sends.
    """
    # Verify email belongs to a registered, unverified user
    user_doc = await db.users.find_one({"email": request.email.strip().lower()})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address.",
        )

    user = User(**user_doc)
    if getattr(user, 'email_verified', False):
        return StandardResponse(
            success=True,
            data={},
            message="Email is already verified. Please sign in.",
        )

    result = await EmailOTPService.send_otp(db, request.email)

    if not result["sent"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=result["message"],
        )

    return StandardResponse(
        success=True,
        data={"expires_in": result["expires_in"]},
        message=result["message"],
    )


@router.post(
    "/email/verify-otp",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify Email OTP and Complete Registration",
    description="Verify the 6-digit email OTP. On success, marks email as verified and returns JWT tokens.",
)
async def email_verify_otp(
    request: EmailVerifyOTPRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """
    Verify email OTP. On success:
    - marks the user's email as verified
    - returns JWT access + refresh tokens so the user is logged in immediately
    """
    # Verify OTP
    verification = await EmailOTPService.verify_otp(db, request.email, request.otp)
    if not verification["verified"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=verification["error"],
        )

    email = verification["email"]

    # Fetch user
    user_doc = await db.users.find_one({"email": email})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found.",
        )

    user = User(**user_doc)

    if user.status == UserStatus.SUSPENDED:
        raise AuthenticationError(
            message=ACCOUNT_SUSPENDED_ERROR, details={"contact": SUPPORT_EMAIL}
        )

    # Mark email as verified
    await db.users.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"email_verified": True, "last_login": datetime.now(timezone.utc)}},
    )

    # Generate tokens — user is now fully authenticated
    user_id = str(user.id)
    access_token = security_manager.create_access_token(
        user_id=user_id, role=user.role.value
    )
    refresh_token = security_manager.create_refresh_token(user_id=user_id)

    logger.info(f"Email verified for user {user_id}")

    return StandardResponse(
        success=True,
        message="Email verified successfully! Welcome to Savitara.",
        data={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": {
                "id": user_id,
                "email": user.email,
                "role": user.role.value,
                "status": user.status.value,
                "credits": user.credits,
                "is_new_user": True,
                "onboarded": False,
                "onboarding_completed": False,
            },
        },
    )
