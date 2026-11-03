from pathlib import Path

from app.ai.client import ChatMessage
from app.enums import MEDIA_TYPES, Direction, MessageType
from app.models import Message

HANDOFF_TOKEN = "[[handoff]]"

MEDIA_LABELS = {
    MessageType.IMAGE: "imagen",
    MessageType.VIDEO: "video",
    MessageType.AUDIO: "audio",
    MessageType.DOCUMENT: "documento",
    MessageType.STICKER: "sticker",
}


def load_system_prompt(config_dir: Path, business_name: str) -> str:
    sections = []
    for name in ("prompt.md", "knowledge.md"):
        path = config_dir / name
        if path.is_file():
            sections.append(path.read_text(encoding="utf-8").strip())
    return "\n\n".join(sections).replace("{business_name}", business_name)


def describe(message: Message) -> str:
    content = message.content or {}
    if message.type in MEDIA_TYPES:
        label = MEDIA_LABELS[message.type]
        return f"[{label}: {message.body}]" if message.body else f"[{label}]"
    if message.type is MessageType.LOCATION:
        place = content.get("location", {})
        return f"[ubicación: {place.get('name') or place.get('address') or 'compartida'}]"
    if message.type is MessageType.REPLY:
        return f"[eligió: {content.get('reply_title') or message.body}]"
    return message.body


def build_messages(system_prompt: str, history: list[Message]) -> list[ChatMessage]:
    messages: list[ChatMessage] = [{"role": "system", "content": system_prompt}]
    for message in history:
        role = "user" if message.direction is Direction.INBOUND else "assistant"
        text = describe(message)
        if text:
            messages.append({"role": role, "content": text})
    return messages


def extract_handoff(reply: str) -> tuple[str, bool]:
    if HANDOFF_TOKEN not in reply:
        return reply, False
    return reply.replace(HANDOFF_TOKEN, "").strip(), True
