import asyncio
import hashlib
import mimetypes
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import MessageType
from app.errors import FileTooLarge, UnsupportedMedia
from app.models import Media

MB = 1024 * 1024
OOXML = "application/vnd.openxmlformats-officedocument"

MIME_TYPES: dict[str, MessageType] = {
    "image/jpeg": MessageType.IMAGE,
    "image/png": MessageType.IMAGE,
    "image/webp": MessageType.STICKER,
    "video/mp4": MessageType.VIDEO,
    "video/3gpp": MessageType.VIDEO,
    "audio/aac": MessageType.AUDIO,
    "audio/amr": MessageType.AUDIO,
    "audio/mpeg": MessageType.AUDIO,
    "audio/mp4": MessageType.AUDIO,
    "audio/ogg": MessageType.AUDIO,
    "application/pdf": MessageType.DOCUMENT,
    "application/msword": MessageType.DOCUMENT,
    f"{OOXML}.wordprocessingml.document": MessageType.DOCUMENT,
    "application/vnd.ms-excel": MessageType.DOCUMENT,
    f"{OOXML}.spreadsheetml.sheet": MessageType.DOCUMENT,
    "application/vnd.ms-powerpoint": MessageType.DOCUMENT,
    f"{OOXML}.presentationml.presentation": MessageType.DOCUMENT,
    "text/plain": MessageType.DOCUMENT,
}

SIZE_LIMITS: dict[MessageType, int] = {
    MessageType.IMAGE: 5 * MB,
    MessageType.STICKER: 500 * 1024,
    MessageType.VIDEO: 16 * MB,
    MessageType.AUDIO: 16 * MB,
    MessageType.DOCUMENT: 100 * MB,
}


def normalize_mime(mime_type: str | None, filename: str) -> str:
    base = (mime_type or "").split(";")[0].strip().lower()
    if base and base != "application/octet-stream":
        return base
    return (mimetypes.guess_type(filename)[0] or "application/octet-stream").lower()


def message_type_for(mime_type: str) -> MessageType:
    kind = MIME_TYPES.get(mime_type)
    if kind is None:
        raise UnsupportedMedia(f"Tipo de archivo no soportado: {mime_type}")
    return kind


def accepts(kind: MessageType, mime_type: str) -> bool:
    actual = MIME_TYPES.get(mime_type)
    return actual == kind or (kind is MessageType.DOCUMENT and actual is not None)


class MediaStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def path_for(self, media: Media) -> Path:
        return self.root / media.storage_key

    async def save(
        self, session: AsyncSession, data: bytes, filename: str, mime_type: str | None
    ) -> Media:
        mime = normalize_mime(mime_type, filename)
        kind = message_type_for(mime)
        if not data:
            raise UnsupportedMedia("El archivo está vacío.")
        if len(data) > SIZE_LIMITS[kind]:
            raise FileTooLarge(f"Un {kind} admite como máximo {SIZE_LIMITS[kind] // 1024} KB.")

        digest = hashlib.sha256(data).hexdigest()
        existing = await session.scalar(select(Media).where(Media.sha256 == digest))
        if existing is not None:
            return existing

        suffix = Path(filename).suffix.lower() or (mimetypes.guess_extension(mime) or "")
        key = f"{digest[:2]}/{digest}{suffix}"
        await asyncio.to_thread(self._write, self.root / key, data)
        media = Media(
            sha256=digest,
            filename=Path(filename).name[:255] or key,
            mime_type=mime,
            size_bytes=len(data),
            storage_key=key,
        )
        session.add(media)
        await session.flush()
        return media

    async def import_asset(self, session: AsyncSession, path: Path) -> Media:
        data = await asyncio.to_thread(path.read_bytes)
        return await self.save(session, data, path.name, None)

    @staticmethod
    def _write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_bytes(data)
