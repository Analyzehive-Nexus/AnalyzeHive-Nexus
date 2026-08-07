"""Vercel serverless entrypoint.

Vercel's Python runtime detects a module-level ASGI application named ``app``
and serves it directly, so no uvicorn process is involved in production -
uvicorn is only used for local development (see the README).
"""

from app.main import app as fastapi_app

app = fastapi_app
