"""initial schema

Revision ID: 0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ENUMS = {
    "conversation_mode": ("auto", "manual"),
    "conversation_status": ("open", "closed"),
    "message_direction": ("inbound", "outbound"),
    "message_author": ("contact", "bot", "agent", "api"),
    "message_type": (
        "text",
        "image",
        "video",
        "audio",
        "document",
        "sticker",
        "location",
        "buttons",
        "list",
        "cta_url",
        "template",
        "reply",
    ),
    "message_status": ("received", "pending", "sent", "delivered", "read", "failed"),
    "webhook_delivery_status": ("pending", "delivered", "failed"),
}

JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def enum(name: str) -> sa.Enum:
    return sa.Enum(*ENUMS[name], name=name)


def timestamp(name: str, *, nullable: bool = False, default: bool = True) -> sa.Column:
    server_default = sa.text("now()") if default else None
    return sa.Column(
        name, sa.DateTime(timezone=True), server_default=server_default, nullable=nullable
    )


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("phone", sa.String(16), nullable=False),
        sa.Column("name", sa.String(120), server_default="", nullable=False),
        sa.Column("attributes", JSON, server_default="{}", nullable=False),
        timestamp("blocked_at", nullable=True, default=False),
        timestamp("created_at"),
        timestamp("updated_at"),
        sa.PrimaryKeyConstraint("id", name="pk_contacts"),
        sa.UniqueConstraint("phone", name="uq_contacts_phone"),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.create_check_constraint(
            op.f("ck_contacts_phone_e164"), "contacts", "phone ~ '^\\+[1-9][0-9]{7,14}$'"
        )

    op.create_table(
        "media",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("mime_type", sa.String(127), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False),
        timestamp("created_at"),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_media_size_positive")),
        sa.PrimaryKeyConstraint("id", name="pk_media"),
        sa.UniqueConstraint("sha256", name="uq_media_sha256"),
        sa.UniqueConstraint("storage_key", name="uq_media_storage_key"),
    )

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event", sa.String(64), nullable=False),
        sa.Column("payload", JSON, nullable=False),
        sa.Column("status", enum("webhook_delivery_status"), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_error", sa.String(500), nullable=True),
        timestamp("next_attempt_at"),
        timestamp("delivered_at", nullable=True, default=False),
        timestamp("created_at"),
        sa.CheckConstraint(
            "attempts >= 0", name=op.f("ck_webhook_deliveries_attempts_not_negative")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_webhook_deliveries"),
    )
    op.create_index(
        "ix_webhook_deliveries_due",
        "webhook_deliveries",
        ["next_attempt_at"],
        postgresql_where=sa.text("status = 'pending'"),
        sqlite_where=sa.text("status = 'pending'"),
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("contact_id", sa.Uuid(), nullable=False),
        sa.Column("mode", enum("conversation_mode"), nullable=False),
        sa.Column("status", enum("conversation_status"), nullable=False),
        sa.Column("flow_node", sa.String(64), nullable=True),
        sa.Column("unread_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("preview", sa.String(160), server_default="", nullable=False),
        timestamp("last_message_at"),
        timestamp("last_inbound_at", nullable=True, default=False),
        timestamp("closed_at", nullable=True, default=False),
        timestamp("created_at"),
        timestamp("updated_at"),
        sa.CheckConstraint(
            "(status = 'closed') = (closed_at IS NOT NULL)",
            name=op.f("ck_conversations_closed_at_matches_status"),
        ),
        sa.CheckConstraint("unread_count >= 0", name=op.f("ck_conversations_unread_not_negative")),
        sa.ForeignKeyConstraint(
            ["contact_id"],
            ["contacts.id"],
            name="fk_conversations_contact_id_contacts",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_conversations"),
    )
    op.create_index("ix_conversations_contact_id", "conversations", ["contact_id"])
    op.create_index(
        "ix_conversations_inbox",
        "conversations",
        ["status", sa.literal_column("last_message_at DESC")],
    )
    op.create_index(
        "uq_conversations_one_open_per_contact",
        "conversations",
        ["contact_id"],
        unique=True,
        postgresql_where=sa.text("status = 'open'"),
        sqlite_where=sa.text("status = 'open'"),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(128), nullable=True),
        sa.Column("direction", enum("message_direction"), nullable=False),
        sa.Column("author", enum("message_author"), nullable=False),
        sa.Column("type", enum("message_type"), nullable=False),
        sa.Column("body", sa.Text(), server_default="", nullable=False),
        sa.Column("content", JSON, server_default="{}", nullable=False),
        sa.Column("media_id", sa.Uuid(), nullable=True),
        sa.Column("reply_to_id", sa.Uuid(), nullable=True),
        sa.Column("status", enum("message_status"), nullable=False),
        sa.Column("error", sa.String(500), nullable=True),
        timestamp("created_at"),
        timestamp("sent_at", nullable=True, default=False),
        timestamp("delivered_at", nullable=True, default=False),
        timestamp("read_at", nullable=True, default=False),
        sa.CheckConstraint(
            "(direction = 'inbound') = (author = 'contact')",
            name=op.f("ck_messages_author_matches_direction"),
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name="fk_messages_conversation_id_conversations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["media_id"], ["media.id"], name="fk_messages_media_id_media", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["reply_to_id"],
            ["messages.id"],
            name="fk_messages_reply_to_id_messages",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_messages"),
        sa.UniqueConstraint("external_id", name="uq_messages_external_id"),
    )
    op.create_index("ix_messages_media_id", "messages", ["media_id"])
    op.create_index("ix_messages_timeline", "messages", ["conversation_id", "created_at"])


def downgrade() -> None:
    for table in ("messages", "conversations", "webhook_deliveries", "media", "contacts"):
        op.drop_table(table)
    for name in ENUMS:
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
