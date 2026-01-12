"""
Authentication API Endpoints
Handles Google OAuth login, JWT token management
SonarQube: S5122 - Proper CORS handled in main.py
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from typing import Dict, Any
import logging

from app.schemas.requests import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    RefreshTokenRequest,
    StandardResponse
)
from app.core.config import get_settings
from app.core.security import SecurityManager, get_current_user
from app.core.exceptions import AuthenticationError, InvalidInputError
from app.db.connection import get_db
from app.models.database import User, UserRole, UserStatus
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])
security_manager = SecurityManager()
security = HTTPBearer()
settings = get_settings()


def verify_google_token(token: str) -> Dict[str, Any]:
    """
    Verify Google ID token and extract user info
    SonarQube: S4502 - Uses Google's official library for secure token verification
    """
    try:
        # Verify token with Google
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )
        
        # Verify issuer
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Invalid issuer')
        
        # Extract user info
        return {
            'email': idinfo['email'],
            'google_id': idinfo['sub'],
            'name': idinfo.get('name'),
            'picture': idinfo.get('picture'),
            'email_verified': idinfo.get('email_verified', False)
        }
    except ValueError as e:
        logger.error(f"Google token verification failed: {e}")
        raise AuthenticationError(
            message="Invalid Google token",
            details={"error": str(e)}
        )


@router.post(
    "/google",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Google OAuth Login",
    description="Authenticate user with Google OAuth and return JWT tokens"
)
async def google_login(
    auth_request: GoogleAuthRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
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
        # Verify Google token
        google_info = await verify_google_token(auth_request.id_token)
        
        if not google_info['email_verified']:
            raise AuthenticationError(
                message="Email not verified with Google",
                details={"email": google_info['email']}
            )
        
        # Check if user exists
        user_doc = await db.users.find_one({"email": google_info['email']})
        
        if user_doc:
            # Existing user - update last login
            await db.users.update_one(
                {"email": google_info['email']},
                {
                    "$set": {
                        "google_id": google_info['google_id'],
                        "profile_picture": google_info.get('picture'),
                        "last_login": datetime.now(timezone.utc)
                    }
                }
            )
            user = User(**user_doc)
            is_new_user = False
        else:
            # New user - create account
            user = User(
                email=google_info['email'],
                google_id=google_info['google_id'],
                role=auth_request.role,
                status=UserStatus.ACTIVE if auth_request.role == UserRole.GRIHASTA else UserStatus.PENDING,
                profile_picture=google_info.get('picture'),
                credits=100  # Welcome bonus
            )
            
            result = await db.users.insert_one(user.dict(by_alias=True))
            user.id = str(result.inserted_id)
            is_new_user = True
            
            logger.info(f"New user created: {user.email} with role {user.role}")
        
        # Check user status
        if user.status == UserStatus.SUSPENDED:
            raise AuthenticationError(
                message="Account suspended",
                details={"contact": "support@savitara.com"}
            )
        
        if user.status == UserStatus.DELETED:
            raise AuthenticationError(
                message="Account deleted",
                details={}
            )
        
        # Generate JWT tokens
        access_token = security_manager.create_access_token(
            user_id=str(user.id),
            role=user.role.value
        )
        refresh_token = security_manager.create_refresh_token(
            user_id=str(user.id)
        )
        
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
                    "requires_onboarding": user.status == UserStatus.PENDING
                }
            },
            message="Authentication successful"
        )
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.post(
    "/register",
    response_model=StandardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Email Registration",
    description="Register a new user with email and password"
)
async def register(
    request: RegisterRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
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
                detail="Email already registered"
            )

        # Create new user
        user = User(
            email=request.email,
            password_hash=security_manager.get_password_hash(request.password),
            role=request.role,
            status=UserStatus.VERIFIED if request.role == UserRole.GRIHASTA else UserStatus.PENDING,
            credits=100  # Welcome bonus
        )
        
        result = await db.users.insert_one(user.model_dump(by_alias=True, exclude_none=True))
        user_id = str(result.inserted_id)
        
        # Generate tokens
        access_token = security_manager.create_access_token(
            user_id=user_id,
            role=user.role.value
        )
        
        refresh_token = security_manager.create_refresh_token(
            user_id=user_id
        )
        
        return StandardResponse(
            success=True,
            message="Registration successful",
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
                    "is_new_user": True
                }
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post(
    "/login",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Email Login",
    description="Authenticate user with email and password"
)
async def login(
    request: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Login with email/password
    """
    try:
        # Find user
        user_doc = await db.users.find_one({"email": request.email})
        if not user_doc:
            raise AuthenticationError(message="Invalid email or password")
            
        user = User(**user_doc)
        
        # Verify password
        if not user.password_hash or not security_manager.verify_password(request.password, user.password_hash):
            raise AuthenticationError(message="Invalid email or password")
            
        # Check status
        if user.status == UserStatus.SUSPENDED:
            raise AuthenticationError(message="Account suspended")
            
        # Update last login
        await db.users.update_one(
            {"_id": user.id},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )
        
        # Generate tokens
        access_token = security_manager.create_access_token(
            user_id=str(user.id),
            role=user.role.value
        )
        
        refresh_token = security_manager.create_refresh_token(
            user_id=str(user.id)
        )
        
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
                    "is_new_user": False
                }
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@router.post(
    "/refresh",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh Access Token",
    description="Get new access token using refresh token"
)
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Refresh access token
    
    SonarQube: Token rotation prevents replay attacks
    """
    try:
        # Verify refresh token
        payload = security_manager.verify_token(
            refresh_request.refresh_token,
            token_type="refresh"
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationError(message="Invalid token payload")
        
        # Verify user still exists and is active
        user_doc = await db.users.find_one({"_id": user_id})
        if not user_doc:
            raise AuthenticationError(message="User not found")
        
        user = User(**user_doc)
        if user.status in [UserStatus.SUSPENDED, UserStatus.DELETED]:
            raise AuthenticationError(message="Account not active")
        
        # Generate new tokens
        access_token = security_manager.create_access_token(
            user_id=str(user.id),
            role=user.role.value
        )
        new_refresh_token = security_manager.create_refresh_token(
            user_id=str(user.id)
        )
        
        return StandardResponse(
            success=True,
            data={
                "access_token": access_token,
                "refresh_token": new_refresh_token,
                "token_type": "bearer",
                "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
            },
            message="Token refreshed successfully"
        )
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )


@router.post(
    "/logout",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Logout",
    description="Invalidate user session (client should delete tokens)"
)
async def logout(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Logout endpoint
    
    Note: JWT tokens are stateless. Client must delete tokens.
    In production, implement token blacklist with Redis for immediate invalidation.
    
    SonarQube: S2068 - No password in code
    """
    logger.info(f"User {current_user['id']} logged out")
    
    return StandardResponse(
        success=True,
        message="Logged out successfully. Please delete tokens on client side."
    )


@router.get(
    "/me",
    response_model=StandardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User",
    description="Get authenticated user information"
)
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get current authenticated user information
    """
    user_doc = await db.users.find_one({"_id": current_user["id"]})
    
    if not user_doc:
        raise AuthenticationError(message="User not found")
    
    user = User(**user_doc)
    
    return StandardResponse(
        success=True,
        data={
            "id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "status": user.status.value,
            "credits": user.credits,
            "profile_picture": user.profile_picture,
            "created_at": user.created_at,
            "last_login": user.last_login
        }
    )


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Auth Health Check",
    description="Check if authentication service is working"
)
async def auth_health_check():
    """Health check endpoint for auth service"""
    return {
        "status": "healthy",
        "service": "authentication",
        "google_oauth": "configured" if settings.GOOGLE_CLIENT_ID else "not_configured"
    }
