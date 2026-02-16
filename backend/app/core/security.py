"""
Security utilities for authentication and authorization
SonarQube: S5659 - Use strong cryptographic algorithms
SonarQube: S6437 - No hardcoded credentials
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import secrets

from app.core.config import settings

# Password hashing context - SonarQube: Use bcrypt with sufficient rounds
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12,  # Secure rounds (not too low)
)

# HTTP Bearer for JWT tokens
security = HTTPBearer(auto_error=False)


class SecurityManager:
    """Centralized security management"""

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash - truncate to 72 bytes for bcrypt"""
        # Bcrypt has a 72 byte limit, truncate if needed
        password_bytes = plain_password.encode("utf-8")[:72]
        plain_password = password_bytes.decode("utf-8", errors="ignore")
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Generate password hash - truncate to 72 bytes for bcrypt"""
        # Bcrypt has a 72 byte limit, truncate if needed
        password_bytes = password.encode("utf-8")[:72]
        password = password_bytes.decode("utf-8", errors="ignore")
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(
        user_id: str = None,
        role: str = None,
        data: Dict[str, Any] = None,
        expires_delta: Optional[timedelta] = None,
    ) -> str:
        """
        Create JWT access token
        SonarQube: S5659 - Uses HS256 algorithm (approved)
        """
        if data:
            to_encode = data.copy()
        else:
            to_encode = {"sub": user_id, "role": role}

        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )

        to_encode.update(
            {"exp": expire, "iat": datetime.now(timezone.utc), "type": "access"}
        )

        # SonarQube: Ensure secret key is from environment
        encoded_jwt = jwt.encode(
            to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

        return encoded_jwt

    @staticmethod
    def create_refresh_token(user_id: str) -> str:
        """Create refresh token with longer expiry"""
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

        to_encode = {
            "sub": user_id,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh",
        }

        return jwt.encode(
            to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
        )

    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        """
        Verify and decode JWT token
        SonarQube: S5659 - Proper token validation
        """
        try:
            payload = jwt.decode(
                token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
            )
            return payload
        except JWTError as e:
            raise HTTPException(
                status_code=401,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt - SonarQube compliant (delegates to get_password_hash)"""
        return SecurityManager.get_password_hash(password)

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """
        Generate cryptographically secure random token
        SonarQube: S2245 - Use secrets module for secure random
        """
        return secrets.token_urlsafe(length)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user
    SonarQube: Validates token on every request
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials

    payload = SecurityManager.verify_token(token)

    # Validate token type
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Return user info with consistent field names
    return {
        "id": user_id,
        "role": payload.get("role"),
        "sub": user_id,  # Keep for backwards compatibility
    }


def get_current_user_with_role(
    required_role: str, current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Dependency to check user role
    SonarQube: S4792 - Proper authorization check
    """
    user_role = current_user.get("role")

    if user_role != required_role:
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Required: {required_role}",
        )

    return current_user


# Specific role dependencies
def get_current_grihasta(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Ensure current user is Grihasta"""
    return get_current_user_with_role("grihasta", current_user)


def get_current_acharya(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Ensure current user is Acharya"""
    return get_current_user_with_role("acharya", current_user)


def get_current_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Ensure current user is Admin"""
    return get_current_user_with_role("admin", current_user)
