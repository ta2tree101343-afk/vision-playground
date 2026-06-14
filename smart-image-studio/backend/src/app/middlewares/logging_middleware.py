import logging
import time
import typing

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: typing.Callable) -> Response:  # type: ignore[type-arg]
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info("%s %s %d %.1fms", request.method, request.url.path, response.status_code, elapsed_ms)
        return response


def add_logging_middleware(app: FastAPI) -> None:
    app.add_middleware(LoggingMiddleware)
