"""エラーは {detail, code, request_id} に統一。詳細はログだけ。"""
from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("hitomeguri")


class AppError(Exception):
    def __init__(self, status: int, code: str, detail: str):
        super().__init__(detail)
        self.status = status
        self.code = code
        self.detail = detail


def _rid(request: Request) -> str:
    return getattr(request.state, "request_id", None) or uuid.uuid4().hex[:12]


def error_json(request: Request, status: int, code: str, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail, "code": code, "request_id": _rid(request)})


def install_error_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_id_mw(request: Request, call_next):
        request.state.request_id = uuid.uuid4().hex[:12]
        response = await call_next(request)
        response.headers["X-Request-Id"] = request.state.request_id
        return response

    @app.exception_handler(AppError)
    async def app_error(request: Request, exc: AppError):
        return error_json(request, exc.status, exc.code, exc.detail)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        code = "not_found" if exc.status_code == 404 else f"http_{exc.status_code}"
        detail = exc.detail if isinstance(exc.detail, str) else "エラーが発生しました"
        return error_json(request, exc.status_code, code, detail)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        log.info("validation error rid=%s errors=%s", _rid(request), exc.errors())
        return error_json(request, 422, "validation_error", "入力内容を確認してください")

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        log.exception("unhandled rid=%s", _rid(request))
        return error_json(request, 500, "internal_error", "サーバーでエラーが発生しました")
