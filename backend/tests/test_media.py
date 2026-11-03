from tests.conftest import Harness

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


async def upload(harness: Harness, name: str, data: bytes, mime: str):
    return await harness.client.post("/api/v1/media", files={"file": (name, data, mime)})


async def test_upload_is_deduplicated_by_hash(harness: Harness) -> None:
    first = await upload(harness, "logo.png", PNG, "image/png")
    second = await upload(harness, "otra-copia.png", PNG, "image/png")

    assert first.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["url"].endswith(f"/api/v1/media/{first.json()['id']}")

    download = await harness.client.get(f"/api/v1/media/{first.json()['id']}")
    assert download.content == PNG
    assert download.headers["content-type"] == "image/png"


async def test_unsupported_type_is_rejected(harness: Harness) -> None:
    response = await upload(harness, "virus.exe", b"MZ", "application/x-msdownload")
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_media"


async def test_sticker_size_limit(harness: Harness) -> None:
    response = await upload(harness, "big.webp", b"x" * (500 * 1024 + 1), "image/webp")
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


async def test_image_size_limit(harness: Harness) -> None:
    response = await upload(harness, "big.jpg", b"x" * (5 * 1024 * 1024 + 1), "image/jpeg")
    assert response.status_code == 413


async def test_media_type_must_match_message_type(harness: Harness) -> None:
    pdf = await upload(harness, "doc.pdf", b"%PDF-1.4 demo", "application/pdf")
    first = await harness.simulate(body="Hola")

    response = await harness.client.post(
        f"/api/v1/conversations/{first['conversation_id']}/messages",
        json={"type": "image", "media_id": pdf.json()["id"]},
    )
    assert response.status_code == 422


async def test_inbound_image_with_caption(harness: Harness) -> None:
    image = await upload(harness, "foto.png", PNG, "image/png")
    inbound = await harness.simulate(type="image", media_id=image.json()["id"], body="Mi local")

    assert inbound["media"]["filename"] == "foto.png"
    conversation = await harness.conversation(inbound["conversation_id"])
    assert conversation["preview"] != ""
