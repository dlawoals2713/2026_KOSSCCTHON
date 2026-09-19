"""Shortform HTTP boundary."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from backend.auth import current_user, trip_member
from backend.database import get_db
from backend.services import preference_service as service
from backend.services.common import ServiceError, row

router = APIRouter(prefix="/api/trips/{trip_id}/shortforms", tags=["Shortforms"])


class ShortformRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)
    url: str = Field(min_length=1, max_length=500)
    note: str | None = Field(default=None, max_length=2000)

class ShortformUpdateRequest(BaseModel):
    place_name: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=50)
    keywords: list[str] | None = None
    recommended_time: str | None = Field(default=None, max_length=50)


def _assert_can_modify(db: Session, trip_id: str, content_id: str, uid: str) -> None:
    """저장한 본인 또는 방장만 수정/삭제할 수 있다."""
    content = row(db, "SELECT user_id FROM shortform_contents WHERE content_id=:c AND trip_id=:t", c=content_id, t=trip_id)
    trip = row(db, "SELECT owner_user_id FROM trips WHERE trip_id=:t", t=trip_id)
    db.rollback()
    if not content:
        raise ServiceError(404, "콘텐츠를 찾을 수 없습니다.")
    if uid not in (content["user_id"], trip and trip["owner_user_id"]):
        raise ServiceError(403, "내가 담은 항목 또는 방장만 수정·삭제할 수 있어요.")


@router.post("", status_code=201)
def create(trip_id: str, body: ShortformRequest, db: Session = Depends(get_db), uid: str = Depends(trip_member)) -> dict:
    if body.user_id != uid:
        raise ServiceError(403, "본인 계정으로만 저장할 수 있어요.")
    return service.save_shortform(db, trip_id, uid, body.url, body.note or "")


@router.get("")
def listing(trip_id: str, db: Session = Depends(get_db), _: str = Depends(trip_member)) -> dict:
    return {"status": "success", "data": service.list_shortforms(db, trip_id)}

@router.patch("/{content_id}")
def update(
    trip_id: str,
    content_id: str,
    body: ShortformUpdateRequest,
    db: Session = Depends(get_db),
    uid: str = Depends(trip_member),
) -> dict:
    _assert_can_modify(db, trip_id, content_id, uid)
    return service.update_shortform(db, trip_id, content_id, body.model_dump(exclude_unset=True))

@router.delete("/{content_id}")
def delete(trip_id: str, content_id: str, db: Session = Depends(get_db), uid: str = Depends(trip_member)) -> dict:
    _assert_can_modify(db, trip_id, content_id, uid)
    return service.delete_shortform(db, trip_id, content_id)
