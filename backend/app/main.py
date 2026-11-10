"""アプリ本体。画面(frontend/dist)と /api を同じポートで配る。"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db as dbmod
from .config import settings
from .errors import install_error_handlers
from .security import install_security_headers
from .seed.master import seed_master
from .services.cleanup import purge_old_receipt_images
from .services.photos import seed_sample_photos

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("hitomeguri")


def create_app(db_path: str | Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # SQLite の接続は 1 本なので、同期エンドポイントを 1 本ずつ実行する（並行アクセスの InterfaceError を防ぐ）
        import anyio

        anyio.to_thread.current_default_thread_limiter().total_tokens = 1
        conn = dbmod.connect(db_path or settings.db_path)
        dbmod.init_schema(conn)
        seed_master(conn)
        from .seed.shop_details import seed_shop_details

        seed_shop_details(conn)
        try:
            from .services.survey import seed_dummy as seed_dummy_surveys

            seed_dummy_surveys(conn)
        except Exception:
            log.exception("アンケートのダミー作成に失敗")
        app.state.conn = conn
        settings.uploads_dir.mkdir(parents=True, exist_ok=True)
        settings.photos_dir.mkdir(parents=True, exist_ok=True)
        try:
            seed_sample_photos(conn, settings.hero_user_id)
        except Exception:
            log.exception("サンプル写真の作成に失敗")
        try:
            n = purge_old_receipt_images(conn)
            if n:
                log.info("古いレシート画像を %d 件削除", n)
        except Exception:
            log.exception("画像の削除に失敗")
        log.info("起動 DEMO_MODE=%s db=%s", settings.demo_mode, db_path or settings.db_path)
        yield
        conn.close()

    app = FastAPI(title="ひとめぐり便", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    install_security_headers(app)
    install_error_handlers(app)

    from .api import router as api_router

    app.include_router(api_router, prefix="/api")

    @app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def api_not_found(request: Request, rest: str):
        return JSONResponse(
            status_code=404,
            content={"detail": "見つかりません", "code": "not_found", "request_id": getattr(request.state, "request_id", "")},
        )

    dist = settings.frontend_dist
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
        dist_root = dist.resolve()
        index_html = dist_root / "index.html"

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa(full_path: str):
            # dist の外は絶対に返さない（%2F や %5C でエンコードした .. も resolve で潰す）
            if full_path:
                candidate = (dist_root / full_path).resolve()
                if candidate.is_relative_to(dist_root) and candidate.is_file():
                    return FileResponse(candidate)
            return FileResponse(index_html)

    return app


app = create_app()
