"""
Encryption Service for Sensitive Data
Provides AES encryption for PII and sensitive information
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class EncryptionService:
    """
    Service for encrypting and decrypting sensitive data
    Uses Fernet (symmetric encryption) for fast, secure encryption
    """

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryption service

        Args:
            encryption_key: Base64-encoded encryption key. If not provided,
                          generates from ENCRYPTION_PASSWORD env variable
        """
        if encryption_key:
            self.key = (
                encryption_key.encode()
                if isinstance(encryption_key, str)
                else encryption_key
            )
        else:
            # Generate key from password
            # SonarQube: S6437 — never use default credentials
            password = os.getenv("ENCRYPTION_PASSWORD")
            salt_raw = os.getenv("ENCRYPTION_SALT")

            if not password:
                raise ValueError(
                    "ENCRYPTION_PASSWORD environment variable is not set. "
                    "Set a strong secret in your .env file before starting the server."
                )
            insecure_defaults = (
                "savitara-default-password-change-this",
                "change-this",
                "default",
            )
            if any(d in password.lower() for d in insecure_defaults):
                raise ValueError(
                    "ENCRYPTION_PASSWORD appears to be a placeholder value. "
                    "Set a cryptographically strong password in your production .env file."
                )
            if not salt_raw:
                raise ValueError(
                    "ENCRYPTION_SALT environment variable is not set. "
                    "Set a random 16-byte hex string in your .env file."
                )
            salt = salt_raw.encode()

            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
                backend=default_backend(),
            )

            self.key = base64.urlsafe_b64encode(kdf.derive(password.encode()))

        self.cipher = Fernet(self.key)

    def encrypt(self, data: str) -> str:
        """
        Encrypt sensitive data

        Args:
            data: Plain text string to encrypt

        Returns:
            Base64-encoded encrypted string
        """
        try:
            if not data:
                return data

            encrypted_bytes = self.cipher.encrypt(data.encode())
            return encrypted_bytes.decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise ValueError("Failed to encrypt data")

    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt encrypted data

        Args:
            encrypted_data: Base64-encoded encrypted string

        Returns:
            Plain text string
        """
        try:
            if not encrypted_data:
                return encrypted_data

            decrypted_bytes = self.cipher.decrypt(encrypted_data.encode())
            return decrypted_bytes.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError("Failed to decrypt data")

    def encrypt_dict(self, data: dict, fields: list) -> dict:
        """
        Encrypt specific fields in a dictionary

        Args:
            data: Dictionary containing data
            fields: List of field names to encrypt

        Returns:
            Dictionary with encrypted fields
        """
        encrypted_data = data.copy()

        for field in fields:
            if field in encrypted_data and encrypted_data[field]:
                encrypted_data[field] = self.encrypt(str(encrypted_data[field]))

        return encrypted_data

    def decrypt_dict(self, data: dict, fields: list) -> dict:
        """
        Decrypt specific fields in a dictionary

        Args:
            data: Dictionary containing encrypted data
            fields: List of field names to decrypt

        Returns:
            Dictionary with decrypted fields
        """
        decrypted_data = data.copy()

        for field in fields:
            if field in decrypted_data and decrypted_data[field]:
                try:
                    decrypted_data[field] = self.decrypt(decrypted_data[field])
                except Exception as e:
                    logger.warning(f"Failed to decrypt field {field}: {e}")
                    # Keep original value if decryption fails

        return decrypted_data

    @staticmethod
    def hash_data(data: str) -> str:
        """
        Create one-way hash of data (for passwords, etc.)

        Args:
            data: Data to hash

        Returns:
            Hex-encoded hash
        """
        from hashlib import sha256

        return sha256(data.encode()).hexdigest()

    @staticmethod
    def verify_hash(data: str, hashed: str) -> bool:
        """
        Verify data against hash

        Args:
            data: Original data
            hashed: Hash to verify against

        Returns:
            True if hash matches
        """
        return EncryptionService.hash_data(data) == hashed


# Singleton instance
encryption_service = EncryptionService()
