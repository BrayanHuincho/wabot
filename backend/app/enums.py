from enum import StrEnum


class MessageType(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    STICKER = "sticker"
    LOCATION = "location"
    BUTTONS = "buttons"
    LIST = "list"
    CTA_URL = "cta_url"
    TEMPLATE = "template"
    REPLY = "reply"


MEDIA_TYPES = frozenset(
    {
        MessageType.IMAGE,
        MessageType.VIDEO,
        MessageType.AUDIO,
        MessageType.DOCUMENT,
        MessageType.STICKER,
    }
)


class Direction(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class Author(StrEnum):
    CONTACT = "contact"
    BOT = "bot"
    AGENT = "agent"
    API = "api"


class MessageStatus(StrEnum):
    RECEIVED = "received"
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class ConversationMode(StrEnum):
    AUTO = "auto"
    MANUAL = "manual"


class ConversationStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class DeliveryStatus(StrEnum):
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
