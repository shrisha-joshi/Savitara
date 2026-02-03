"""
Automated KYC Service Interface
Stub implementation for Phase 4
Integrates with HyperVerge / Zoop.one in production
"""
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class KYCService:
    @staticmethod
    async def verify_document(user_id: str, document_type: str, document_url: str) -> Dict[str, Any]:
        """
        Verify an upload document using OCR/API
        
        Real World Logic:
        1. Send document_url to HyperVerge API
        2. Receive OCR data (Name, Aadhaar Number)
        3. Match Name with User Profile Name
        4. Return verification status
        """
        logger.info(f"Initiating KYC verify for {user_id} - {document_type}")
        
        # MOCK IMPLEMENTATION
        # Auto-verify if the URL contains "valid"
        is_valid = "valid" in document_url.lower()
        
        return {
            "verified": is_valid,
            "details": {
                "name_match": 95 if is_valid else 40,
                "document_number": "XXXX-XXXX-1234" if is_valid else None,
                "provider": "Mock-HyperVerge"
            },
            "message": "Verification Successful" if is_valid else "Document blurry or invalid"
        }
