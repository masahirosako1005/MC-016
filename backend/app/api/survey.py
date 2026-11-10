"""旅のあとの任意アンケートと、お礼（ほしまるの素材）。運営の窓むけの集計。"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..errors import AppError
from ..repositories import master
from ..services import survey as svc

router = APIRouter()


class SurveyIn(BaseModel):
    satisfaction: int = Field(ge=1, le=5)
    revisit: int = Field(ge=1, le=5)
    good: list[str] = Field(default_factory=list, max_length=10)
    trouble: list[str] = Field(default_factory=list, max_length=10)
    spot_id: int | None = Field(default=None, ge=1)
    comment: str | None = Field(default=None, max_length=300)


@router.get("/survey")
def get_survey(conn=Depends(get_conn)):
    return svc.form(conn, settings.hero_user_id)


@router.post("/survey")
def post_survey(body: SurveyIn, conn=Depends(get_conn)):
    with write_tx(conn):
        return svc.submit(conn, settings.hero_user_id, clock.now(conn), body.satisfaction, body.revisit, body.good, body.trouble, body.spot_id, body.comment)


@router.get("/gifts")
def get_gifts(conn=Depends(get_conn)):
    return svc.gifts(conn, settings.hero_user_id)


@router.get("/admin/survey")
def admin_survey(conn=Depends(get_conn)):
    return svc.summary(conn)


@router.get("/admin/shops/{shop_id}/survey")
def shop_survey(shop_id: int, conn=Depends(get_conn)):
    sh = master.shop(conn, shop_id)
    if sh is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    sp = master.spot(conn, sh["spot_id"])
    out = svc.summary(conn, sh["spot_id"])
    out["place"] = sp["name"].split("（")[0] if sp else None
    return out
