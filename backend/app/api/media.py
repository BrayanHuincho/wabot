import uuid

from fastapi import APIRouter, Depends, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CtxDep, SessionDep, require_api_key
from app.errors import FileTooLarge, NotFound
from app.models import Media
from app.schemas import MediaOut

router = APIRouter(prefix="/media", tags=["media"])

CHUNK_SIZE = 1024 * 1024


async def read_limited(file: UploadFile, max_bytes: int) -> bytes:
    data = bytearray()
    while chunk := await file.read(CHUNK_SIZE):
        data.extend(chunk)
        if len(data) > max_bytes:
            raise FileTooLarge(f"El archivo supera {max_bytes // CHUNK_SIZE} MB.")
    return bytes(data)


@router.post(
    "",
    response_model=MediaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_api_key)],
)
async def upload(file: UploadFile, ctx: CtxDep, session: SessionDep) -> MediaOut:
    data = await read_limited(file, ctx.settings.max_upload_mb * CHUNK_SIZE)
    media = await ctx.store.save(session, data, file.filename or "archivo", file.content_type)
    await session.commit()
    return MediaOut.model_validate(media)


@router.get("/{media_id}", response_class=FileResponse)
async def download(media_id: uuid.UUID, ctx: CtxDep, session: SessionDep) -> FileResponse:
    media = await session.get(Media, media_id)
    if media is None or not ctx.store.path_for(media).is_file():
        raise NotFound("El archivo no existe.")
    return FileResponse(
        ctx.store.path_for(media), media_type=media.mime_type, filename=media.filename
    )
