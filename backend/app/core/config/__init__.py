"""
Config package — environment-aware settings factory
----------------------------------------------------
Usage (unchanged from the old config.py API)::

    from app.core.config import settings, get_settings

    print(settings.APP_ENV)
    print(settings.MONGODB_URL)

Environment selection
~~~~~~~~~~~~~~~~~~~~~
Set the ``APP_ENV`` environment variable *before* importing this module:

+---------------+---------------------------------------+
| APP_ENV value | Class used                            |
+===============+=======================================+
| development   | DevelopmentSettings  (default)        |
| staging       | StagingSettings                       |
| production    | ProductionSettings (strict validators) |
+---------------+---------------------------------------+

All three inherit from ``BaseAppSettings`` which declares every available field.
"""
from __future__ import annotations

import os

APP_ENV = os.getenv("APP_ENV", "development")

if APP_ENV == "production":
    from .production import ProductionSettings as Settings
elif APP_ENV == "staging":
    from .staging import StagingSettings as Settings
else:
    from .development import DevelopmentSettings as Settings

# Singleton — instantiated once at import time (same behaviour as before).
settings: Settings = Settings()  # type: ignore[assignment]


def get_settings() -> Settings:
    """FastAPI dependency: ``Depends(get_settings)``."""
    return settings


__all__ = ["settings", "get_settings", "Settings"]
