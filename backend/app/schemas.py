import re
import uuid
from datetime import datetime, timedelta
from typing import Annotated, Any, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
    model_validator,
)

from app.config import get_settings
from app.enums import (
    MEDIA_TYPES,
    Author,
    ConversationMode,
    ConversationStatus,
    Direction,
    MessageStatus,
    MessageType,
)
from app.models import as_utc, utcnow

UtcDatetime = Annotated[datetime, AfterValidator(as_utc)]

PHONE_PATTERN = re.compile(r"^\+[1-9]\d{7,14}$")
TEXT_LIMIT = 4096
CAPTION_LIMIT = 1024
INTERACTIVE_BODY_LIMIT = 1024
MAX_LIST_ROWS = 10
INBOUND_TYPES = MEDIA_TYPES | {MessageType.TEXT, MessageType.LOCATION, MessageType.REPLY}
INTERACTIVE_TYPES = frozenset({MessageType.BUTTONS, MessageType.LIST, MessageType.CTA_URL})


def normalize_phone(value: str) -> str:
    digits = re.sub(r"[\s\-().]", "", value)
    if digits.startswith("00"):
        digits = digits[2:]
    if not digits.startswith("+"):
        digits = f"+{digits}"
    if not PHONE_PATTERN.match(digits):
        raise ValueError("número inválido, usa formato E.164 (ej. +51924368603)")
    return digits


Phone = Annotated[str, AfterValidator(normalize_phone)]


class Button(BaseModel):
    id: str = Field(min_length=1, max_length=256)
    title: str = Field(min_length=1, max_length=20)


class ListRow(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=24)
    description: str = Field(default="", max_length=72)


class ListSection(BaseModel):
    title: str = Field(default="", max_length=24)
    rows: list[ListRow] = Field(min_length=1)


class Location(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    name: str = Field(default="", max_length=1000)
    address: str = Field(default="", max_length=1000)


class MessageContent(BaseModel):
    type: MessageType
    body: str = ""
    media_id: uuid.UUID | None = None
    header: str | None = Field(default=None, max_length=60)
    footer: str | None = Field(default=None, max_length=60)
    buttons: list[Button] = Field(default_factory=list)
    list_button: str | None = Field(default=None, max_length=20)
    sections: list[ListSection] = Field(default_factory=list)
    url: str | None = Field(default=None, max_length=2000)
    url_label: str | None = Field(default=None, max_length=20)
    location: Location | None = None
    template: str | None = None
    params: list[str] = Field(default_factory=list)
    reply_id: str | None = Field(default=None, max_length=256)
    reply_title: str | None = Field(default=None, max_length=72)

    def has_media(self) -> bool:
        return self.media_id is not None

    @model_validator(mode="after")
    def check_type_rules(self) -> Self:
        self.body = self.body.strip()
        kind = self.type
        if kind is MessageType.TEXT:
            require(self.body, "body es obligatorio en mensajes de texto")
            limit(self.body, TEXT_LIMIT, "body")
        elif kind in MEDIA_TYPES:
            require(self.has_media(), f"media_id es obligatorio en mensajes {kind}")
            limit(self.body, CAPTION_LIMIT, "body")
        elif kind in INTERACTIVE_TYPES:
            require(self.body, "body es obligatorio en mensajes interactivos")
            limit(self.body, INTERACTIVE_BODY_LIMIT, "body")
            self.check_interactive()
        elif kind is MessageType.LOCATION:
            require(self.location, "location es obligatorio")
        elif kind is MessageType.TEMPLATE:
            require(self.template, "template es obligatorio")
        elif kind is MessageType.REPLY:
            require(self.reply_id, "reply_id es obligatorio en respuestas")
        return self

    def check_interactive(self) -> None:
        if self.type is MessageType.BUTTONS:
            require(1 <= len(self.buttons) <= 3, "buttons debe tener entre 1 y 3 botones")
            ids = [button.id for button in self.buttons]
            require(len(set(ids)) == len(ids), "los ids de buttons deben ser únicos")
        elif self.type is MessageType.LIST:
            require(self.list_button, "list_button es obligatorio en listas")
            require(self.sections, "sections es obligatorio en listas")
            rows = sum(len(section.rows) for section in self.sections)
            require(rows <= MAX_LIST_ROWS, f"una lista admite como máximo {MAX_LIST_ROWS} filas")
        else:
            require(self.url, "url es obligatorio en cta_url")
            require(self.url_label, "url_label es obligatorio en cta_url")
            require(
                str(self.url).startswith(("http://", "https://")), "url debe empezar con http(s)"
            )

    def extras(self) -> dict[str, Any]:
        own_fields = set(type(self).model_fields) - set(MessageContent.model_fields)
        excluded = {"type", "body", "media_id"} | own_fields
        return self.model_dump(
            mode="json", exclude=excluded, exclude_none=True, exclude_defaults=True
        )


def require(condition: object, message: str) -> None:
    if not condition:
        raise ValueError(message)


def limit(value: str, size: int, field: str) -> None:
    require(len(value) <= size, f"{field} supera {size} caracteres")


class OutboundContent(MessageContent):
    @field_validator("type")
    @classmethod
    def reject_reply(cls, value: MessageType) -> MessageType:
        require(value is not MessageType.REPLY, "reply solo existe en mensajes entrantes")
        return value


class SendMessageRequest(OutboundContent):
    to: Phone
    name: str | None = Field(default=None, max_length=120)


class SimulatedInbound(MessageContent):
    phone: Phone
    name: str | None = Field(default=None, max_length=120)
    reply_to_id: uuid.UUID | None = None

    @field_validator("type")
    @classmethod
    def inbound_only(cls, value: MessageType) -> MessageType:
        require(value in INBOUND_TYPES, f"un cliente no puede enviar mensajes {value}")
        return value


class ConversationPatch(BaseModel):
    mode: ConversationMode | None = None
    status: ConversationStatus | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    name: str


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    contact: ContactOut
    mode: ConversationMode
    status: ConversationStatus
    unread_count: int
    preview: str
    last_message_at: UtcDatetime
    last_inbound_at: UtcDatetime | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def window_expires_at(self) -> datetime | None:
        if self.last_inbound_at is None:
            return None
        return self.last_inbound_at + timedelta(hours=get_settings().service_window_hours)

    @computed_field
    @property
    def window_open(self) -> bool:
        expires = self.window_expires_at
        return expires is not None and expires > utcnow()


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    mime_type: str
    size_bytes: int

    @computed_field
    @property
    def url(self) -> str:
        return f"{get_settings().public_url.rstrip('/')}/api/v1/media/{self.id}"


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    direction: Direction
    author: Author
    type: MessageType
    body: str
    content: dict[str, Any]
    media: MediaOut | None
    reply_to_id: uuid.UUID | None
    status: MessageStatus
    created_at: UtcDatetime
    sent_at: UtcDatetime | None
    delivered_at: UtcDatetime | None
    read_at: UtcDatetime | None


class TemplateOut(BaseModel):
    name: str
    body: str
    params: list[str]
    buttons: list[str]
