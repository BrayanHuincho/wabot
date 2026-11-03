from dataclasses import dataclass
from enum import StrEnum

from app.bot.flow import Flow
from app.bot.text import contains_phrase, normalize
from app.enums import ConversationMode, MessageType
from app.models import Conversation, Message


class Action(StrEnum):
    NONE = "none"
    NODE = "node"
    AI = "ai"
    NOT_UNDERSTOOD = "not_understood"


@dataclass(frozen=True, slots=True)
class Decision:
    action: Action
    node: str | None = None


SILENT = Decision(Action.NONE)


def route_reply(flow: Flow, current: str | None, reply_id: str) -> str | None:
    node = flow.nodes.get(current) if current else None
    if node is not None and reply_id in node.routes:
        return node.routes[reply_id]
    return reply_id if reply_id in flow.nodes else None


def match_keyword(flow: Flow, body: str) -> str | None:
    text = normalize(body)
    if not text:
        return None
    matches = [keyword for keyword in flow.keywords if contains_phrase(text, keyword)]
    if not matches:
        return None
    return flow.keywords[max(matches, key=len)]


def is_question(body: str) -> bool:
    return "?" in body or len(normalize(body).split()) >= 4


def decide(
    flow: Flow,
    conversation: Conversation,
    inbound: Message,
    *,
    first_contact: bool,
    ai_enabled: bool,
) -> Decision:
    if conversation.mode is ConversationMode.MANUAL:
        return SILENT

    reply_id = (inbound.content or {}).get("reply_id")
    if inbound.type is MessageType.REPLY and reply_id:
        target = route_reply(flow, conversation.flow_node, reply_id)
        if target:
            return Decision(Action.NODE, target)

    if inbound.body and (target := match_keyword(flow, inbound.body)):
        return Decision(Action.NODE, target)
    wants_ai = ai_enabled and flow.fallback == "ai"
    if first_contact and not (wants_ai and is_question(inbound.body)):
        return Decision(Action.NODE, flow.start)
    if wants_ai:
        return Decision(Action.AI)
    return Decision(Action.NOT_UNDERSTOOD, flow.start)
