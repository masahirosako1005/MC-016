from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..services import photos as svc

router = APIRouter()


@router.get("/photos")
def list_photos(conn=Depends(get_conn)):
    return {"photos": svc.album(conn, settings.hero_user_id)}


@router.get("/photos/frame/{kind}/{target_id}")
def get_frame(kind: str, target_id: int, conn=Depends(get_conn)):
    return svc.frame_info(conn, settings.hero_user_id, kind, target_id, clock.now(conn))


@router.post("/photos")
async def post_photo(kind: str = Form(pattern="^(person|spot)$"), target_id: int = Form(ge=1), image: UploadFile = File(...), conn=Depends(get_conn)):
    data = await image.read()
    now = clock.now(conn)
    with write_tx(conn):
        return svc.save_photo(conn, settings.hero_user_id, kind, target_id, data, now)


@router.get("/photos/{photo_id}")
def get_photo(photo_id: int, conn=Depends(get_conn)):
    return svc.photo_detail(conn, settings.hero_user_id, photo_id)


@router.get("/photos/{photo_id}/print")
def get_photo_print(photo_id: int, conn=Depends(get_conn)):
    return svc.photo_detail(conn, settings.hero_user_id, photo_id)


@router.get("/photos/{photo_id}/image")
def get_photo_image(photo_id: int, conn=Depends(get_conn)):
    path, mime = svc.photo_file(conn, settings.hero_user_id, photo_id)
    return FileResponse(path, media_type=mime, headers={"Cache-Control": "private, max-age=3600"})
