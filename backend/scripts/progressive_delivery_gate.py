"""Progressive delivery rollback gate evaluator (A22)."""

from __future__ import annotations

import json
from pathlib import Path


DEFAULT_THRESHOLDS = {
    "error_rate_pct_max": 2.0,
    "p95_latency_ms_max": 750.0,
    "anomaly_events_max": 5,
}


def evaluate(metrics: dict) -> tuple[bool, dict]:
    reasons = []
    if metrics.get("error_rate_pct", 0.0) > DEFAULT_THRESHOLDS["error_rate_pct_max"]:
        reasons.append("error_rate")
    if metrics.get("p95_latency_ms", 0.0) > DEFAULT_THRESHOLDS["p95_latency_ms_max"]:
        reasons.append("latency")
    if metrics.get("anomaly_events", 0) > DEFAULT_THRESHOLDS["anomaly_events_max"]:
        reasons.append("anomalies")
    return (len(reasons) == 0, {"reasons": reasons, "thresholds": DEFAULT_THRESHOLDS})


def main() -> int:
    payload_path = Path("metrics_gate_input.json")
    if not payload_path.exists():
        print("metrics_gate_input.json missing")
        return 1
    metrics = json.loads(payload_path.read_text(encoding="utf-8"))
    ok, details = evaluate(metrics)
    print(json.dumps({"ok": ok, **details}, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
