"""Configuration drift detection between runtime and baseline env spec (A19)."""

from __future__ import annotations

from pathlib import Path


def parse_env(path: Path) -> dict:
    data = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        data[k.strip()] = v.strip()
    return data


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    example = parse_env(root / ".env.example")
    actual_path = root / ".env"
    if not actual_path.exists():
        print("No .env file present; drift check skipped")
        return 0

    actual = parse_env(actual_path)
    missing = sorted(k for k in example if k not in actual)
    extra = sorted(k for k in actual if k not in example)

    if missing or extra:
        print("CONFIG DRIFT DETECTED")
        if missing:
            print("Missing keys:", ", ".join(missing))
        if extra:
            print("Extra keys:", ", ".join(extra))
        return 1

    print("No config drift detected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
