"""Vercel @vercel/python entrypoint.

@vercel/python serves the module-level `app` ASGI application.
"""

from app.main import app  # noqa: F401  (re-exported for Vercel)

__all__ = ["app"]
