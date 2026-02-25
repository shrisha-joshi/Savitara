"""
FastAPI Application Lifespan Manager
SonarQube: S2095 - Proper resource management
Extracted from main.py for Single Responsibility Principle (SRP).
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.startup import startup, shutdown


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage the full application lifecycle:
    - startup: connect DB, Redis, search; create indexes; init services
    - shutdown: gracefully release all resources
    """
    await startup(app)
    try:
        yield
    finally:
        await shutdown(app)
