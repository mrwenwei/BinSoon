"""Application integration, scoped errors, CORS and bounded uploads."""
from uuid import uuid4
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.modules.common import ProductError


def error_response(request, status, code, message, fields=None):
    headers = {"Cache-Control":"no-store", "X-Request-ID":getattr(request.state, "request_id", str(uuid4()))}
    if status == 401: headers["WWW-Authenticate"] = "Bearer"
    if status == 429: headers["Retry-After"] = "300"
    return JSONResponse(status_code=status, headers=headers, content={"detail":dict(code=code, message=message,
        fields=fields or [], request_id=headers["X-Request-ID"])})


def install(app):
    from app.modules.api import router
    from app.modules.media import router as media_router
    app.include_router(router)
    app.include_router(media_router)
    app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "If-Match"],
        expose_headers=["ETag", "Idempotency-Replayed", "X-Request-ID"])

    original_openapi = app.openapi

    def openapi():
        schema = original_openapi()
        # FastAPI may keep included routers lazy; inspect our source router.
        for route in router.routes:
            endpoint = getattr(route, "endpoint", None)
            if not endpoint or endpoint.__module__ != "app.modules.api": continue
            path = route.path
            for method in route.methods:
                operation = schema.get("paths", {}).get(path, {}).get(method.lower())
                if not operation: continue
                if method in {"POST", "PATCH"} and path != "/api/v1/auth/demo/login":
                    parameters = operation.setdefault("parameters", [])
                    if not any(p.get("name") == "Idempotency-Key" for p in parameters):
                        parameters.append(dict(name="Idempotency-Key", **{"in":"header"}, required=True,
                            schema=dict(type="string", format="uuid"), description="Reuse the same UUID when retrying this operation"))
                    needs_version = ("/work-orders/" in path or path.endswith("/lifecycle") or
                        "/adoptions/" in path or path.endswith("/name-requests") or path.endswith("/name-review") or
                        path.startswith("/api/v1/admin/proposals/"))
                    if needs_version and not any(p.get("name") == "If-Match" for p in parameters):
                        parameters.append(dict(name="If-Match", **{"in":"header"}, required=True,
                            schema=dict(type="string", example='"v1"'), description="ETag of the current resource; reviews use the work order ETag"))
                for code, result in operation.get("responses", {}).items():
                    if code.startswith("2"):
                        result.setdefault("headers", {})["ETag"] = dict(schema=dict(type="string"), description="Present for versioned resources")
        return schema

    app.openapi = openapi

    @app.exception_handler(ProductError)
    async def product_error(request, exc):
        return error_response(request, exc.status, exc.code, exc.message, exc.fields)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        endpoint = request.scope.get("endpoint")
        if endpoint and endpoint.__module__.startswith("app.modules"):
            fields = [dict(field=".".join(map(str, e["loc"])), code=e["type"], message=e["msg"]) for e in exc.errors()]
            return error_response(request, 422, "VALIDATION_ERROR", "Request validation failed", fields)
        return await request_validation_exception_handler(request, exc)

    @app.middleware("http")
    async def headers_and_upload_bound(request, call_next):
        request.state.request_id = str(uuid4())
        if request.method == "POST" and request.url.path == "/api/v1/media":
            # Reject unbounded chunked multipart before Starlette spools to disk.
            try:
                length = int(request.headers["content-length"])
                if length < 0: raise ValueError()
            except (KeyError, ValueError):
                return error_response(request, 411, "CONTENT_LENGTH_REQUIRED", "Provide Content-Length for multipart uploads")
            if length > 6 * 1024 * 1024:
                return error_response(request, 413, "FILE_TOO_LARGE", "Upload exceeds request size limit")
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        endpoint = request.scope.get("endpoint")
        if endpoint and endpoint.__module__.startswith("app.modules"):
            response.headers["Cache-Control"] = "no-store"
        return response
