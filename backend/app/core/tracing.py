"""Tracing helpers for W3C Trace Context propagation.

This module provides a lightweight OpenTelemetry-compatible trace-context layer
that allows frontend clients to pass `traceparent`/`tracestate` headers and
backend middleware to continue spans safely.
"""

from __future__ import annotations

import re
import secrets
from dataclasses import dataclass
from typing import Optional


_TRACEPARENT_RE = re.compile(
    r"^(?P<version>[0-9a-f]{2})-"
    r"(?P<trace_id>[0-9a-f]{32})-"
    r"(?P<span_id>[0-9a-f]{16})-"
    r"(?P<trace_flags>[0-9a-f]{2})$"
)


@dataclass(frozen=True)
class TraceContext:
    """Resolved trace context for the current backend request span."""

    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    trace_flags: str = "01"
    tracestate: Optional[str] = None

    @property
    def traceparent(self) -> str:
        return build_traceparent(
            trace_id=self.trace_id,
            span_id=self.span_id,
            trace_flags=self.trace_flags,
        )


def _is_all_zeros(hex_value: str) -> bool:
    return set(hex_value) == {"0"}


def parse_traceparent(traceparent_header: Optional[str]) -> Optional[dict]:
    """Parse and validate W3C traceparent header.

    Returns parsed fields for valid values; otherwise returns None.
    """
    if not traceparent_header:
        return None
    value = traceparent_header.strip().lower()
    match = _TRACEPARENT_RE.match(value)
    if not match:
        return None

    data = match.groupdict()
    version = data["version"]
    if version == "ff":
        return None
    if _is_all_zeros(data["trace_id"]) or _is_all_zeros(data["span_id"]):
        return None
    return data


def generate_trace_id() -> str:
    """Generate a 16-byte (32 hex chars) trace id."""
    return secrets.token_hex(16)


def generate_span_id() -> str:
    """Generate an 8-byte (16 hex chars) span id."""
    return secrets.token_hex(8)


def build_traceparent(trace_id: str, span_id: str, trace_flags: str = "01") -> str:
    """Build a valid traceparent header value."""
    return f"00-{trace_id}-{span_id}-{trace_flags}"


def resolve_trace_context(
    incoming_traceparent: Optional[str],
    incoming_tracestate: Optional[str] = None,
) -> TraceContext:
    """Continue incoming trace context if valid; otherwise start a new one."""
    parsed = parse_traceparent(incoming_traceparent)
    if parsed:
        return TraceContext(
            trace_id=parsed["trace_id"],
            span_id=generate_span_id(),
            parent_span_id=parsed["span_id"],
            trace_flags=parsed["trace_flags"],
            tracestate=incoming_tracestate.strip() if incoming_tracestate else None,
        )

    return TraceContext(
        trace_id=generate_trace_id(),
        span_id=generate_span_id(),
        parent_span_id=None,
        trace_flags="01",
        tracestate=incoming_tracestate.strip() if incoming_tracestate else None,
    )