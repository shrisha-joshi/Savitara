"""Generate and validate OpenAPI snapshot contracts (A21)."""

from __future__ import annotations

import json
from pathlib import Path

from app.main import app


SNAPSHOT = Path(__file__).resolve().parents[1] / "tests" / "contracts" / "openapi_snapshot.json"


def generate() -> None:
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True), encoding="utf-8")
    print(f"Snapshot generated: {SNAPSHOT}")


def validate() -> int:
    if not SNAPSHOT.exists():
        print("Snapshot missing. Run generate first.")
        return 1
    current = json.dumps(app.openapi(), indent=2, sort_keys=True)
    expected = SNAPSHOT.read_text(encoding="utf-8")
    if current != expected:
        print("OpenAPI contract drift detected")
        return 1
    print("OpenAPI contract snapshot valid")
    return 0


if __name__ == "__main__":
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "validate"
    if mode == "generate":
        generate()
    else:
        raise SystemExit(validate())
