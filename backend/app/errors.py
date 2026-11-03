import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class Unauthorized(AppError):
    status_code = 401
    code = "unauthorized"


class NotFound(AppError):
    status_code = 404
    code = "not_found"


class WindowClosed(AppError):
    status_code = 409
    code = "window_closed"


class ConversationClosed(AppError):
    status_code = 409
    code = "conversation_closed"


class FileTooLarge(AppError):
    status_code = 413
    code = "file_too_large"


class UnsupportedMedia(AppError):
    status_code = 415
    code = "unsupported_media"


class InvalidMessage(AppError):
    status_code = 422
    code = "invalid_message"


HTTP_CODES = {401: "unauthorized", 404: "not_found", 405: "method_not_allowed"}


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status_code)


def describe_validation_error(exc: RequestValidationError) -> str:
    errors = exc.errors()
    if not errors:
        return "Solicitud inválida."
    first = errors[0]
    location = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    message = str(first.get("msg", "valor inválido")).removeprefix("Value error, ")
    return f"{location}: {message}" if location else message


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.status_code, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, InvalidMessage.code, describe_validation_error(exc))

    @app.exception_handler(HTTPException)
    async def handle_http(_: Request, exc: HTTPException) -> JSONResponse:
        code = HTTP_CODES.get(exc.status_code, "http_error")
        return error_response(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return error_response(500, "internal_error", "Error interno del servidor.")
