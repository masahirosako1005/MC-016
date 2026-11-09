from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..errors import AppError
from ..repositories import master
from ..services import admin as svc
from ..services.dummy import dummy_summary, generate_dummy
from ..services.importer import import_dir, import_text
from ..services.lottery import prize_table
from ..services.metrics import compute_metrics

router = APIRouter()


@router.get("/metrics")
def get_metrics(conn=Depends(get_conn)):
    return compute_metrics(conn, clock.now(conn))


@router.get("/admin/overview")
def overview(conn=Depends(get_conn)):
    return {
        "shops": [
            {"id": s["id"], "name": s["name"], "area": s["area"], "category": s["category"], "rate_percent": s["rate_percent"],
             "person_name": next((p["name"] for p in master.people(conn) if p["shop_id"] == s["id"]), None)}
            for s in master.shops(conn)
        ],
        "prizes": prize_table(conn),
        "history": svc.history(conn),
        "recent_receipts": svc.recent_receipts(conn),
        "import_runs": [dict(r) for r in conn.execute("SELECT * FROM import_runs ORDER BY id DESC LIMIT 20")],
        "sample_dir": str(settings.sample_data_dir),
        "sample_files": sorted(p.name for p in settings.sample_data_dir.glob("*.csv")) if settings.sample_data_dir.exists() else [],
        "dummy": dummy_summary(conn),
        "demo_mode": settings.demo_mode,
    }


@router.post("/admin/import/preview")
def import_preview(conn=Depends(get_conn)):
    return {"results": [r.to_dict() for r in import_dir(conn, settings.sample_data_dir, dry_run=True)]}


@router.post("/admin/import")
def import_run(with_dummy: bool = Query(True), conn=Depends(get_conn)):
    now = clock.now(conn)
    with write_tx(conn):
        results = [r.to_dict() for r in import_dir(conn, settings.sample_data_dir)]
        dummy_n = generate_dummy(conn) if with_dummy else 0
        if results:
            svc._hist(conn, now, "import", "csv", None, {"files": [r["file"] for r in results], "inserted": sum(r["inserted"] for r in results), "dummy_rows": dummy_n})
    return {"results": results, "dummy_rows": dummy_n}


@router.post("/admin/import/upload")
async def import_upload(file: UploadFile = File(...), dry_run: bool = Query(False), conn=Depends(get_conn)):
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise AppError(413, "file_too_large", "CSV は 20MB までです")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise AppError(415, "bad_encoding", "CSV は UTF-8（BOM 可）で保存してください")
    name = Path(file.filename or "upload.csv").name
    if dry_run:
        return import_text(conn, name, text, dry_run=True).to_dict()
    with write_tx(conn):
        res = import_text(conn, name, text)
        svc._hist(conn, clock.now(conn), "import", name, None, {"inserted": res.inserted, "failed": len(res.failed)})
    return res.to_dict()


class RateIn(BaseModel):
    rate_percent: int = Field(ge=1, le=20)


@router.put("/admin/shops/{shop_id}/rate")
def put_rate(shop_id: int, body: RateIn, conn=Depends(get_conn)):
    with write_tx(conn):
        return svc.set_rate(conn, shop_id, body.rate_percent, clock.now(conn))


class PrizeIn(BaseModel):
    name: str | None = Field(default=None, max_length=40)
    face_value: int | None = Field(default=None, ge=0, le=100000)
    weight: int | None = Field(default=None, ge=0, le=1000)
    stock: int | None = Field(default=None, ge=0, le=100000)
    unlimited: bool = False
    enabled: bool | None = None


@router.put("/admin/prizes/{prize_id}")
def put_prize(prize_id: int, body: PrizeIn, conn=Depends(get_conn)):
    patch = body.model_dump(exclude_none=True)
    if body.unlimited:
        patch["stock"] = None
    patch.pop("unlimited", None)
    if "enabled" in patch:
        patch["enabled"] = int(patch["enabled"])
    with write_tx(conn):
        svc.update_prize(conn, prize_id, patch, clock.now(conn))
    return {"prizes": prize_table(conn)}


@router.get("/admin/reimbursement")
def get_reimbursement(month: str = Query(..., min_length=7, max_length=7), conn=Depends(get_conn)):
    return svc.reimbursement(conn, month)


@router.get("/admin/visits")
def visits(conn=Depends(get_conn)):
    """いつ人が来るか: 予定日ごとの計画の数と、行く場所の内訳（利用者名は出さない）。"""
    today = clock.today(conn).isoformat()
    rows = conn.execute(
        "SELECT p.target_date, COUNT(DISTINCT p.id) AS plans, SUM(p.is_dummy) AS dummy FROM plans p WHERE p.target_date IS NOT NULL AND p.target_date >= ? "
        "GROUP BY p.target_date ORDER BY p.target_date LIMIT 60",
        (today,),
    ).fetchall()
    out = []
    for r in rows:
        places = conn.execute(
            "SELECT sp.name, COUNT(*) AS n FROM plan_items pi JOIN plans p ON p.id = pi.plan_id JOIN spots sp ON sp.id = pi.target_id "
            "WHERE p.target_date = ? AND pi.kind = 'spot' GROUP BY sp.name ORDER BY n DESC",
            (r["target_date"],),
        ).fetchall()
        out.append({
            "date": r["target_date"], "plans": r["plans"], "dummy": r["dummy"] or 0,
            "places": [{"name": x["name"].split("（")[0], "n": x["n"]} for x in places],
        })
    return {"visits": out, "today": today}


@router.get("/admin/history")
def get_history(conn=Depends(get_conn)):
    return {"history": svc.history(conn)}


@router.get("/admin/receipts/{receipt_id}/image")
def admin_receipt_image(receipt_id: int, conn=Depends(get_conn)):
    r = conn.execute("SELECT image_path, image_mime FROM receipts WHERE id = ?", (receipt_id,)).fetchone()
    if r is None or r["image_path"] is None or not Path(r["image_path"]).exists():
        raise AppError(404, "image_not_found", "画像は保存期間（7 日）を過ぎたか、見つかりません")
    return FileResponse(r["image_path"], media_type=r["image_mime"], headers={"Cache-Control": "private, no-store"})
