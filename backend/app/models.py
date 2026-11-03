import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.enums import (
    Author,
    ConversationMode,
    ConversationStatus,
    DeliveryStatus,
    Direction,
    MessageStatus,
    MessageType,
)

Json = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime | None) -> datetime | None:
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=UTC)


def pg_enum(enum_cls: type, name: str) -> Enum:
    return Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow, onupdate=utcnow
    )


class Contact(Timestamped, Base):
    __tablename__ = "contacts"
    __table_args__ = (
        CheckConstraint("phone ~ '^\\+[1-9][0-9]{7,14}$'", name="phone_e164").ddl_if(
            dialect="postgresql"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(120), default="", server_default="")
    attributes: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, server_default="{}")
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    conversations: Mapped[list["Conversation"]] = relationship(back_populates="contact")


class Conversation(Timestamped, Base):
    __tablename__ = "conversations"
    __table_args__ = (
        CheckConstraint("unread_count >= 0", name="unread_not_negative"),
        CheckConstraint(
            "(status = 'closed') = (closed_at IS NOT NULL)", name="closed_at_matches_status"
        ),
        Index(
            "uq_conversations_one_open_per_contact",
            "contact_id",
            unique=True,
            postgresql_where=text("status = 'open'"),
            sqlite_where=text("status = 'open'"),
        ),
        Index("ix_conversations_inbox", "status", text("last_message_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), index=True
    )
    mode: Mapped[ConversationMode] = mapped_column(
        pg_enum(ConversationMode, "conversation_mode"), default=ConversationMode.AUTO
    )
    status: Mapped[ConversationStatus] = mapped_column(
        pg_enum(ConversationStatus, "conversation_status"), default=ConversationStatus.OPEN
    )
    flow_node: Mapped[str | None] = mapped_column(String(64))
    unread_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    preview: Mapped[str] = mapped_column(String(160), default="", server_default="")
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
    last_inbound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    contact: Mapped[Contact] = relationship(back_populates="conversations", lazy="joined")


class Media(Base):
    __tablename__ = "media"
    __table_args__ = (CheckConstraint("size_bytes > 0", name="size_positive"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(127))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "(direction = 'inbound') = (author = 'contact')", name="author_matches_direction"
        ),
        Index("ix_messages_timeline", "conversation_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    external_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    direction: Mapped[Direction] = mapped_column(pg_enum(Direction, "message_direction"))
    author: Mapped[Author] = mapped_column(pg_enum(Author, "message_author"))
    type: Mapped[MessageType] = mapped_column(pg_enum(MessageType, "message_type"))
    body: Mapped[str] = mapped_column(Text, default="", server_default="")
    content: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, server_default="{}")
    media_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("media.id", ondelete="SET NULL"), index=True
    )
    reply_to_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL")
    )
    status: Mapped[MessageStatus] = mapped_column(pg_enum(MessageStatus, "message_status"))
    error: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    media: Mapped[Media | None] = relationship(lazy="joined")


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="attempts_not_negative"),
        Index(
            "ix_webhook_deliveries_due",
            "next_attempt_at",
            postgresql_where=text("status = 'pending'"),
            sqlite_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict[str, Any]] = mapped_column(Json)
    status: Mapped[DeliveryStatus] = mapped_column(
        pg_enum(DeliveryStatus, "webhook_delivery_status"), default=DeliveryStatus.PENDING
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_error: Mapped[str | None] = mapped_column(String(500))
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow
    )
