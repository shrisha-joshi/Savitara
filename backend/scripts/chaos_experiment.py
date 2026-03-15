"""Chaos automation script for integration failure modes (A30)."""

from __future__ import annotations

import os
import subprocess


def main() -> int:
    scenarios = [
        ["pytest", "tests/test_outbox_worker.py", "-q"],
        ["pytest", "tests/test_resilience.py", "-q"],
        ["pytest", "tests/test_query_budget.py", "-q"],
    ]

    env = os.environ.copy()
    env.setdefault("PYTHONPATH", ".")
    failed = 0
    for cmd in scenarios:
        print("Running chaos scenario:", " ".join(cmd))
        rc = subprocess.call(cmd, env=env)
        if rc != 0:
            failed += 1

    if failed:
        print(f"Chaos run completed with {failed} failed scenarios")
        return 1
    print("Chaos run passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
