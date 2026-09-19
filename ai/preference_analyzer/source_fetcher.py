"""YouTube(일반 영상·Shorts 모두) / Instagram / TikTok / 기타 링크를 분석 입력으로 변환한다.

- YouTube: 기존 메타데이터 수집기를 재사용한다.
- Instagram/TikTok: 공개 oEmbed·OG 태그만 읽는다(허용 호스트 한정, 리다이렉트도 호스트 검증).
- 기타 링크: 서버가 접속하지 않는다(SSRF 방지). '보정 입력'(note)만으로 분석한다.
"""

import html
import re
from urllib.parse import urljoin, urlsplit

import httpx

from .content_parser import analyze_content
from .metadata_fetcher import MetadataError, extract_youtube_video_id, fetch_youtube_metadata
from .schemas import ContentInput

_YOUTUBE = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
_INSTAGRAM = {"instagram.com", "www.instagram.com"}
_TIKTOK = {"tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"}
_UA = "Mozilla/5.0 (compatible; TripClipBot/1.0)"
_META = re.compile(r"<meta\s[^>]*>", re.I)
_ATTR = re.compile(r'(\w[\w:-]*)\s*=\s*("([^"]*)"|\'([^\']*)\')')
_HASHTAG = re.compile(r"#([0-9A-Za-z_가-힣]{1,30})")


def normalize_source_url(url: str) -> tuple[str, str]:
    """(platform, canonical_url). 잘못된 URL이면 MetadataError."""
    try:
        parsed = urlsplit(url.strip())
        host = (parsed.hostname or "").lower()
        if (parsed.scheme not in ("http", "https") or not host or "." not in host
                or parsed.username or parsed.password or parsed.port not in (None, 80, 443)):
            raise ValueError
    except ValueError:
        raise MetadataError("올바른 링크(URL)를 입력해주세요.") from None
    path = parsed.path.rstrip("/")
    if host in _YOUTUBE:
        video_id = extract_youtube_video_id(url)
        return "youtube", f"https://www.youtube.com/watch?v={video_id}"
    if host in _INSTAGRAM:
        if not re.search(r"/(reel|reels|p|tv)/[\w-]+", path):
            raise MetadataError("Instagram 릴스/게시물 링크를 입력해주세요.")
        canonical = f"https://www.instagram.com{path}"
        platform = "instagram"
    elif host in _TIKTOK:
        if not path:
            raise MetadataError("TikTok 영상 링크를 입력해주세요.")
        canonical = f"https://{'www.tiktok.com' if host in ('tiktok.com', 'm.tiktok.com') else host}{path}"
        platform = "tiktok"
    else:
        canonical = f"{parsed.scheme}://{host}{parsed.path}" + (f"?{parsed.query}" if parsed.query else "")
        platform = "other"
    if len(canonical) > 500 or not canonical.isascii():
        raise MetadataError("링크가 너무 길거나 지원하지 않는 문자가 포함되어 있어요.")
    return platform, canonical


def _safe_get(url: str, allowed: set[str], params: dict | None = None) -> httpx.Response:
    for _ in range(4):
        response = httpx.get(url, params=params, headers={"User-Agent": _UA, "Accept-Language": "ko,en;q=0.8"},
                             timeout=8.0, follow_redirects=False)
        params = None
        if not response.is_redirect:
            response.raise_for_status()
            return response
        target = urljoin(url, response.headers.get("location", ""))
        parsed = urlsplit(target)
        if parsed.scheme != "https" or (parsed.hostname or "").lower() not in allowed:
            raise MetadataError("허용되지 않은 주소로 이동하는 링크예요.")
        url = target
    raise MetadataError("리다이렉트가 너무 많아요.")


def _og(page: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for tag in _META.findall(page[:300_000]):
        attrs = {m.group(1).lower(): html.unescape(m.group(3) if m.group(3) is not None else m.group(4)) for m in _ATTR.finditer(tag)}
        key = attrs.get("property") or attrs.get("name")
        if key in ("og:title", "og:description", "description") and attrs.get("content"):
            found.setdefault(key, attrs["content"])
    return found


def _fetch_public_meta(platform: str, url: str) -> dict[str, str]:
    allowed = _TIKTOK if platform == "tiktok" else _INSTAGRAM
    try:
        if platform == "tiktok":
            try:
                data = _safe_get("https://www.tiktok.com/oembed", _TIKTOK, {"url": url}).json()
                if isinstance(data, dict) and str(data.get("title", "")).strip():
                    return {"title": str(data["title"]).strip(), "description": str(data.get("author_name") or "")}
            except (httpx.HTTPError, ValueError):
                pass
        meta = _og(_safe_get(url, allowed).text)
        return {"title": meta.get("og:title", ""), "description": meta.get("og:description") or meta.get("description", "")}
    except MetadataError:
        raise
    except httpx.HTTPError:
        return {}


def analyze_source(user_id: int, platform: str, canonical: str, note: str = "") -> dict:
    """{'metadata': {...}, 'analysis': {...}} — analyze_youtube_url과 같은 형태."""
    note = (note or "").strip()[:2000]
    if platform == "youtube":
        md = fetch_youtube_metadata(canonical)
        title, description, tags = md.title, md.description, list(md.tags)
    else:
        meta = _fetch_public_meta(platform, canonical) if platform in ("instagram", "tiktok") else {}
        title, description, tags = meta.get("title", ""), meta.get("description", ""), []
        if not (title or description or note):
            raise MetadataError("링크에서 내용을 가져오지 못했어요. '보정 입력'에 게시글 내용이나 해시태그를 붙여넣어 주세요.")
        title = title or note.splitlines()[0][:80]
    if note:
        description = f"{description}\n{note}".strip()
    for tag in _HASHTAG.findall(f"{title} {description}"):
        if tag not in tags:
            tags.append(tag)
    title = title.strip()[:500]
    analysis = analyze_content(ContentInput(user_id=user_id, url=canonical, title=title, description=description, tags=tags))
    return {"metadata": {"title": title, "platform": platform}, "analysis": analysis.model_dump(mode="json")}
