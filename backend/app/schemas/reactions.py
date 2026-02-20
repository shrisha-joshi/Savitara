"""
Reactions Request/Response Schemas
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict

from app.utils.emoji_whitelist import is_valid_emoji


class AddReactionRequest(BaseModel):
    """Request to add a reaction to a message"""

    emoji: str = Field(..., max_length=8, description="Unicode emoji to add")

    @field_validator("emoji")
    @classmethod
    def validate_emoji(cls, v):
        if not is_valid_emoji(v):
            raise ValueError("Emoji not in allowed whitelist")
        return v


class ReactionSummaryResponse(BaseModel):
    """Summary of a single emoji reaction"""

    emoji: str
    count: int = Field(ge=0)
    reactedByMe: bool


class ReactionsResponse(BaseModel):
    """Response containing list of reaction summaries"""

    success: bool = True
    data: Dict[str, List[ReactionSummaryResponse]] = Field(
        default_factory=lambda: {"reactions": []}
    )
    message: str = "Reactions retrieved successfully"


# Import Dict for the type hint
from typing import Dict
