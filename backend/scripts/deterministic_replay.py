"""Deterministic replay utility for production incidents (A28 baseline)."""

from __future__ import annotations

import json
from pathlib import Path


def replay(event_log_path: Path) -> int:
    events = json.loads(event_log_path.read_text(encoding="utf-8"))
    state = {"bookings": {}, "payments": {}}

    for event in events:
        kind = event.get("kind")
        if kind == "booking.transition":
            bid = event["booking_id"]
            state["bookings"][bid] = event["to_status"]
        elif kind == "payment.verified":
            state["payments"][event["payment_id"]] = "verified"

    print(json.dumps(state, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        raise SystemExit("Usage: python deterministic_replay.py <event_log.json>")
    raise SystemExit(replay(Path(sys.argv[1])))
