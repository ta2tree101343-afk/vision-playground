import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError

from app.core.responses import UnicodeJSONResponse

logger = logging.getLogger(__name__)


def add_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> UnicodeJSONResponse:
        return UnicodeJSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> UnicodeJSONResponse:
        return UnicodeJSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={"detail": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> UnicodeJSONResponse:
        if isinstance(exc, (HTTPException, RequestValidationError)):
            raise exc
        logger.exception("未処理の例外が発生しました: %s %s", request.method, request.url.path)
        return UnicodeJSONResponse(status_code=500, content={"detail": "内部サーバーエラーが発生しました。"})
