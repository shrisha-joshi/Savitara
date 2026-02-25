"""
Automated KYC Service Interface
Stub implementation for Phase 4
Integrates with HyperVerge / Zoop.one in production
"""
import logging
from typing import Dict, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class KYCService:
    @staticmethod
    async def verify_document(
        user_id: str, document_type: str, document_url: str
    ) -> Dict[str, Any]:
        """
        Verify an uploaded document using OCR/API

        Real World Logic:
        1. Send document_url to HyperVerge API
        2. Receive OCR data (Name, Aadhaar Number)
        3. Match Name with User Profile Name
        4. Return verification status
        """
        logger.info(f"Initiating KYC verify for {user_id} - {document_type}")

        # In production, route to manual review queue (real OCR integration pending)
        # SonarQube: Never auto-approve KYC in production based on URL string match
        if settings.is_production:
            logger.warning(
                f"KYC for user {user_id} queued for manual review (real OCR not yet wired)"
            )
            return {
                "verified": False,
                "status": "pending_manual_review",
                "details": {
                    "provider": "Manual-Review",
                    "document_type": document_type,
                },
                "message": "Document submitted. Under review by our team.",
            }

        # DEVELOPMENT MOCK ONLY — not executed in production
        is_valid = "valid" in document_url.lower()

        return {
            "verified": is_valid,
            "details": {
                "name_match": 95 if is_valid else 40,
                "document_number": "XXXX-XXXX-1234" if is_valid else None,
                "provider": "Mock-HyperVerge",
            },
            "message": "Verification Successful"
            if is_valid
            else "Document blurry or invalid",
        }
