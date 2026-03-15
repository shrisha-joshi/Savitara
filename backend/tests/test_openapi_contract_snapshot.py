"""Contract test validating OpenAPI snapshot consistency (A21)."""

from pathlib import Path

from app.main import app


def test_openapi_snapshot_exists():
    snapshot = Path(__file__).resolve().parent / "contracts" / "openapi_snapshot.json"
    assert snapshot.exists(), "OpenAPI snapshot missing. Run openapi_contract_snapshot.py generate"


def test_openapi_snapshot_matches_runtime():
    import json

    snapshot = Path(__file__).resolve().parent / "contracts" / "openapi_snapshot.json"
    expected = snapshot.read_text(encoding="utf-8")
    current = json.dumps(app.openapi(), indent=2, sort_keys=True)
    assert current == expected
