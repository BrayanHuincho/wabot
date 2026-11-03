import uuid

import pytest
from pydantic import ValidationError

from app.schemas import OutboundContent, SendMessageRequest, SimulatedInbound


def button(index: int, title: str = "Opción") -> dict[str, str]:
    return {"id": f"b{index}", "title": title}


def test_text_limit() -> None:
    OutboundContent(type="text", body="a" * 4096)
    with pytest.raises(ValidationError, match="4096"):
        OutboundContent(type="text", body="a" * 4097)


def test_text_requires_body() -> None:
    with pytest.raises(ValidationError, match="body"):
        OutboundContent(type="text", body="   ")


def test_media_requires_media_id_and_caption_limit() -> None:
    with pytest.raises(ValidationError, match="media_id"):
        OutboundContent(type="image")
    with pytest.raises(ValidationError, match="1024"):
        OutboundContent(type="image", media_id=uuid.uuid4(), body="x" * 1025)


@pytest.mark.parametrize("count", [0, 4])
def test_buttons_count(count: int) -> None:
    with pytest.raises(ValidationError, match="entre 1 y 3"):
        OutboundContent(type="buttons", body="Elige", buttons=[button(i) for i in range(count)])


def test_button_title_limit() -> None:
    with pytest.raises(ValidationError):
        OutboundContent(type="buttons", body="Elige", buttons=[button(1, "x" * 21)])


def test_list_rows_limit() -> None:
    rows = [{"id": f"r{i}", "title": f"Fila {i}"} for i in range(11)]
    with pytest.raises(ValidationError, match="10 filas"):
        OutboundContent(
            type="list", body="Elige", list_button="Ver", sections=[{"title": "A", "rows": rows}]
        )


def test_list_description_limit() -> None:
    row = {"id": "r", "title": "Fila", "description": "d" * 73}
    with pytest.raises(ValidationError):
        OutboundContent(
            type="list", body="Elige", list_button="Ver", sections=[{"title": "A", "rows": [row]}]
        )


def test_cta_url_label_limit() -> None:
    with pytest.raises(ValidationError):
        OutboundContent(type="cta_url", body="Visítanos", url="https://x.pe", url_label="x" * 21)


def test_header_and_footer_limits() -> None:
    with pytest.raises(ValidationError):
        OutboundContent(type="buttons", body="Hola", buttons=[button(1)], header="h" * 61)


def test_reply_is_inbound_only() -> None:
    with pytest.raises(ValidationError):
        OutboundContent(type="reply", reply_id="x")
    with pytest.raises(ValidationError):
        SimulatedInbound(phone="+51924368603", type="buttons", body="x", buttons=[button(1)])


def test_phone_is_normalized_to_e164() -> None:
    request = SendMessageRequest(to="51 924-368-603", type="text", body="Hola")
    assert request.to == "+51924368603"
    with pytest.raises(ValidationError, match=r"E\.164"):
        SendMessageRequest(to="12", type="text", body="Hola")
