"""Trip membership endpoints."""
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.auth import current_user, trip_member
from backend.database import get_db
from backend.services.common import ServiceError, require, row, transaction

router = APIRouter(prefix="/api/trips/{trip_id}/members", tags=["Members"])


class MemberRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)


@router.post("", status_code=201)
def add_member(trip_id: str, body: MemberRequest, db: Session = Depends(get_db), uid: str = Depends(current_user)) -> dict:
    """방장만 기존 사용자를 추가할 수 있다."""
    with transaction(db):
        trip = require(db, "trips", trip_id, lock=True)
        if trip["owner_user_id"] != uid:
            raise ServiceError(403, "방장만 멤버를 추가할 수 있어요.")
        require(db, "users", body.user_id)
        if row(db, "SELECT user_id FROM trip_members WHERE trip_id=:trip AND user_id=:user", trip=trip_id, user=body.user_id):
            raise ServiceError(409, "이미 등록된 멤버입니다.")
        db.execute(text("INSERT INTO trip_members (trip_member_id,trip_id,user_id) VALUES (:id,:trip,:user)"),
                   {"id": str(uuid.uuid4()), "trip": trip_id, "user": body.user_id})
    return {"status": "success", "user_id": body.user_id}


@router.get("")
def list_members(trip_id: str, db: Session = Depends(get_db), _: str = Depends(trip_member)) -> dict:
    """멤버만 같은 여행의 멤버 이름을 볼 수 있다."""
    rows = db.execute(text("SELECT m.user_id,u.name,m.joined_at FROM trip_members m JOIN users u ON u.user_id=m.user_id WHERE m.trip_id=:id ORDER BY m.user_id"), {"id": trip_id}).mappings()
    return {"status": "success", "data": [dict(item) for item in rows]}


@router.delete("/{user_id}")
def delete_member(trip_id: str, user_id: str, db: Session = Depends(get_db), uid: str = Depends(current_user)) -> dict:
    """본인 나가기 또는 방장의 멤버 내보내기. 방장은 나갈 수 없다(여행 취소 사용)."""
    with transaction(db):
        trip = require(db, "trips", trip_id, lock=True)
        if uid != user_id and trip["owner_user_id"] != uid:
            raise ServiceError(403, "권한이 없어요.")
        if trip["owner_user_id"] == user_id:
            raise ServiceError(409, "방장은 나갈 수 없어요. 여행을 취소해 주세요.")
        result = db.execute(text("DELETE FROM trip_members WHERE trip_id=:trip AND user_id=:user"), {"trip": trip_id, "user": user_id})
        if not result.rowcount:
            raise ServiceError(404, "멤버를 찾을 수 없습니다.")
    return {"status": "success"}
