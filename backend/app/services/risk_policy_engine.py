"""Dynamic risk scoring and anti-abuse policy checks (A17)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Request


@dataclass
class RiskAssessment:
    score: float
    level: str
    throttle_factor: float
    blocked: bool


class RiskPolicyEngine:
    """Simple deterministic risk engine suitable for middleware-time decisions."""

    def assess_request(self, request: Request, user_id: Optional[str]) -> RiskAssessment:
        path = request.url.path.lower()
        method = request.method.upper()
        ua = (request.headers.get("user-agent") or "").lower()
        ip = request.client.host if request.client else "unknown"

        score = 0.0
        if path.startswith("/api/v1/auth"):
            score += 20
        if path.startswith("/api/v1/payments") or "refund" in path:
            score += 25
        if method in {"POST", "PUT", "PATCH", "DELETE"}:
            score += 10
        if "bot" in ua or "crawler" in ua:
            score += 40
        if user_id is None:
            score += 10
        if ip in {"127.0.0.1", "::1", "unknown"}:
            score += 5

        if score >= 80:
            return RiskAssessment(score=score, level="critical", throttle_factor=0.2, blocked=True)
        if score >= 55:
            return RiskAssessment(score=score, level="high", throttle_factor=0.4, blocked=False)
        if score >= 30:
            return RiskAssessment(score=score, level="medium", throttle_factor=0.7, blocked=False)
        return RiskAssessment(score=score, level="low", throttle_factor=1.0, blocked=False)
