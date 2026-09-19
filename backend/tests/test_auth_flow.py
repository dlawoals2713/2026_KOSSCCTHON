"""로그인·프로필·계정삭제·여행취소·항목삭제·다중 플랫폼 URL 검증."""
from unittest.mock import patch

from sqlalchemy import text

from backend.auth import current_user
from backend.main import app
from backend.tests.test_backend import BackendFixture

FAKE = {"metadata": {"title": "t"}, "analysis": {"category": "cafe", "keywords": ["카페"], "area": "성수",
                                                   "activity": None, "place_name": None, "recommended_time": None}}


class AuthFlowTests(BackendFixture):
    def setUp(self):
        super().setUp()
        app.dependency_overrides.pop(current_user, None)  # 실제 토큰 인증 사용

    def signup(self, name):
        email = f"{name}@x.com"
        self.assertEqual(self.client.post("/api/users", json={"name": name, "email": email, "password": "secret12"}).status_code, 201)
        res = self.client.post("/api/auth/login", json={"email": email, "password": "secret12"})
        self.assertEqual(res.status_code, 200)
        return res.json()["user"]["user_id"], {"Authorization": "Bearer " + res.json()["token"]}

    def test_privacy_and_trip_cancel(self):
        (a, ha), (b, hb), (c, hc) = self.signup("a"), self.signup("b"), self.signup("c")
        self.assertIn(self.client.get("/api/users").status_code, (404, 405))          # 전체 목록 비공개
        self.assertEqual(self.client.get("/api/users/lookup?email=b@x.com", headers=ha).json()["data"]["name"], "b")
        self.assertEqual(self.client.get("/api/users/lookup?email=b@x.com").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "a@x.com", "password": "bad"}).status_code, 401)
        self.body["owner_user_id"] = a
        trip = self.client.post("/api/trips", json=self.body, headers=ha).json()["trip_id"]
        self.assertEqual(self.client.post("/api/trips", json=self.body, headers=hb).status_code, 403)
        self.assertEqual(self.client.post(f"/api/trips/{trip}/members", json={"user_id": b}, headers=hb).status_code, 403)
        self.assertEqual(self.client.post(f"/api/trips/{trip}/members", json={"user_id": b}, headers=ha).status_code, 201)
        self.assertEqual(self.client.get(f"/api/trips/{trip}", headers=hc).status_code, 403)   # 비멤버 차단
        self.assertEqual(self.client.get(f"/api/trips/{trip}/members", headers=hb).status_code, 200)
        # 항목 삭제/수정 권한
        with patch("backend.services.preference_service.analyze_source", return_value=FAKE):
            ca = self.client.post(f"/api/trips/{trip}/shortforms", json={"user_id": a, "url": "https://www.instagram.com/reel/abc/"}, headers=ha)
            cb = self.client.post(f"/api/trips/{trip}/shortforms", json={"user_id": b, "url": "https://www.tiktok.com/@x/video/2"}, headers=hb)
            self.assertEqual((ca.status_code, cb.status_code), (201, 201), (ca.text, cb.text))
            self.assertEqual(self.client.post(f"/api/trips/{trip}/shortforms", json={"user_id": a, "url": "https://tiktok.com/@x/video/1"}, headers=hb).status_code, 403)
        ida, idb = ca.json()["content_id"], cb.json()["content_id"]
        self.assertEqual(ca.json()["analysis"]["platform"], "instagram")
        self.assertEqual(self.client.delete(f"/api/trips/{trip}/shortforms/{ida}", headers=hb).status_code, 403)
        self.assertEqual(self.client.patch(f"/api/trips/{trip}/shortforms/{idb}", json={"place_name": "새 이름"}, headers=hb).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/trips/{trip}/shortforms/{idb}", headers=hb).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/trips/{trip}/shortforms/{ida}", headers=ha).status_code, 200)
        # 여행 취소: 방장만, 멤버는 나가기
        self.assertEqual(self.client.delete(f"/api/trips/{trip}", headers=hb).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/trips/{trip}/members/{b}", headers=hb).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/trips/{trip}/members/{a}", headers=ha).status_code, 409)
        self.assertEqual(self.client.delete(f"/api/trips/{trip}", headers=ha).status_code, 200)
        self.assertEqual(self.client.get(f"/api/users/{a}/trips", headers=ha).json()["count"], 0)

    def test_profile_and_account_deletion(self):
        (a, ha), (b, hb) = self.signup("a"), self.signup("b")
        self.assertEqual(self.client.patch("/api/users/me", json={"name": "새이름", "bio": "안녕"}, headers=ha).json()["data"]["name"], "새이름")
        self.assertEqual(self.client.patch("/api/users/me", json={"new_password": "newpass1", "current_password": "x"}, headers=ha).status_code, 403)
        self.assertEqual(self.client.patch("/api/users/me", json={"new_password": "newpass1", "current_password": "secret12"}, headers=ha).status_code, 200)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "a@x.com", "password": "newpass1"}).status_code, 200)
        self.body["owner_user_id"] = a
        trip = self.client.post("/api/trips", json=self.body, headers=ha).json()["trip_id"]
        self.client.post(f"/api/trips/{trip}/members", json={"user_id": b}, headers=ha)
        solo = self.client.post("/api/trips", json=self.body, headers=ha).json()["trip_id"]
        self.assertEqual(self.client.request("DELETE", "/api/users/me", json={"password": "wrong"}, headers=ha).status_code, 403)
        self.assertEqual(self.client.request("DELETE", "/api/users/me", json={"password": "newpass1"}, headers=ha).status_code, 200)
        self.assertEqual(self.client.get("/api/users/me", headers=ha).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={"email": "a@x.com", "password": "newpass1"}).status_code, 401)
        self.assertEqual(self.client.get(f"/api/trips/{trip}", headers=hb).json()["data"]["owner_user_id"], b)   # 소유권 이전
        with self.engine.connect() as db:
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM trips WHERE trip_id=:t"), {"t": solo}).scalar_one(), 0)

    def test_source_urls(self):
        from ai.preference_analyzer.metadata_fetcher import MetadataError
        from ai.preference_analyzer.source_fetcher import analyze_source, normalize_source_url as n
        self.assertEqual(n("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1")[0], "youtube")
        self.assertEqual(n("https://www.instagram.com/reel/AbC_1/?igsh=zz"), ("instagram", "https://www.instagram.com/reel/AbC_1"))
        self.assertEqual(n("https://vm.tiktok.com/ZS123/")[0], "tiktok")
        self.assertEqual(n("https://blog.example.com/post/1")[0], "other")
        for bad in ("ftp://x.com/a", "https://localhost/a", "not a url", "https://instagram.com/user"):
            with self.assertRaises(MetadataError):
                n(bad)
        with self.assertRaises(MetadataError):
            analyze_source(1, "other", "https://blog.example.com/post/1", "")
        result = analyze_source(1, "other", "https://blog.example.com/post/1", "성수 감성 카페 #디저트")
        self.assertEqual(result["analysis"]["category"], "cafe")
