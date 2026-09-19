"""Stateless Bearer 토큰(HMAC-SHA256) 인증과 FastAPI 의존성."""
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time

import bcrypt
from fastapi import Depends, Header
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.common import ServiceError

logger = logging.getLogger(__name__)
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
DUMMY_HASH = bcrypt.hashpw(b"tripclip-dummy", bcrypt.gensalt()).decode("ascii")
_secret_cache: bytes | None = None


def _secret() -> bytes:
    global _secret_cache
    if _secret_cache is None:
        value = os.getenv("AUTH_SECRET", "").strip()
        if not value:
            logger.warning("AUTH_SECRET 미설정: 임시 시크릿 사용(재시작 시 로그인 풀림). 배포 환경에서는 반드시 설정하세요.")
            value = secrets.token_urlsafe(48)
        _secret_cache = value.encode("utf-8")
    return _secret_cache


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text_: str) -> bytes:
    return base64.urlsafe_b64decode(text_ + "=" * (-len(text_) % 4))


def create_token(user_id: str) -> str:
    payload = _b64(json.dumps({"sub": user_id, "exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode())
    signature = _b64(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def verify_token(token: str) -> str | None:
    try:
        payload, signature = token.split(".", 1)
        expected = _b64(hmac.new(_secret(), payload.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        data = json.loads(_unb64(payload))
        if int(data["exp"]) < time.time():
            return None
        return str(data["sub"])
    except (ValueError, KeyError, TypeError):
        return None


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> str:
    """유효한 토큰의 user_id를 반환한다. 탈퇴/비활성 계정은 거부한다."""
    scheme, _, token = (authorization or "").partition(" ")
    user_id = verify_token(token.strip()) if scheme.lower() == "bearer" else None
    if user_id:
        found = db.execute(text("SELECT 1 FROM users WHERE user_id=:u AND is_active = TRUE"), {"u": user_id}).first()
        db.rollback()  # 읽기 전용 트랜잭션 종료(이후 서비스 로직의 스냅샷 오염 방지)
        if found:
            return user_id
    raise ServiceError(401, "로그인이 필요합니다.")


def is_trip_owner(db: Session, trip_id: str, user_id: str) -> bool:
    found = db.execute(text("SELECT 1 FROM trips WHERE trip_id=:t AND owner_user_id=:u"),
                       {"t": trip_id, "u": user_id}).first()
    db.rollback()
    return found is not None


def trip_member(trip_id: str, user_id: str = Depends(current_user), db: Session = Depends(get_db)) -> str:
    """여행 멤버만 통과시킨다."""
    found = db.execute(text("SELECT 1 FROM trip_members WHERE trip_id=:t AND user_id=:u"),
                       {"t": trip_id, "u": user_id}).first()
    db.rollback()
    if not found:
        raise ServiceError(403, "이 여행의 멤버만 접근할 수 있어요.")
    return user_id
