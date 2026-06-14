import logging
from typing import cast

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError

from app.core.responses import UnicodeJSONResponse

logger = logging.getLogger(__name__)


async def http_exception_handler(_request: Request, exc: Exception) -> UnicodeJSONResponse:
    http_exc = cast(HTTPException, exc)
    return UnicodeJSONResponse(
        status_code=http_exc.status_code,
        content={"detail": http_exc.detail},
        headers=getattr(http_exc, "headers", None),
    )


async def validation_exception_handler(_request: Request, exc: Exception) -> UnicodeJSONResponse:
    validation_exc = cast(RequestValidationError, exc)
    return UnicodeJSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": validation_exc.errors()},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> UnicodeJSONResponse:
    logger.exception("未処理の例外が発生しました: %s %s", request.method, request.url.path, exc_info=exc)
    return UnicodeJSONResponse(status_code=500, content={"detail": "内部サーバーエラーが発生しました。"})


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
