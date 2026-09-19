"""Persistent preference lookup endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.auth import current_user, trip_member
from backend.database import get_db
from backend.services.common import ServiceError
from backend.services.preference_service import get_profile, trip_profiles

router = APIRouter(tags=["Preferences"])


@router.get("/api/users/{user_id}/preferences")
def user_preferences(user_id: str, db: Session = Depends(get_db), uid: str = Depends(current_user)) -> dict:
    if user_id != uid:
        raise ServiceError(403, "본인의 취향만 조회할 수 있어요.")
    return get_profile(db, user_id)


@router.get("/api/trips/{trip_id}/preferences")
def group_preferences(trip_id: str, db: Session = Depends(get_db), _: str = Depends(trip_member)) -> list[dict]:
    return trip_profiles(db, trip_id)
