import json
from pathlib import Path
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

from app.bot.text import normalize
from app.schemas import OutboundContent


class FlowMessage(OutboundContent):
    asset: str | None = None

    def has_media(self) -> bool:
        return self.media_id is not None or bool(self.asset)


class Node(BaseModel):
    messages: list[FlowMessage] = Field(min_length=1)
    routes: dict[str, str] = Field(default_factory=dict)
    next: str | None = None
    handoff: bool = False
    capture: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_]*$")


class Flow(BaseModel):
    start: str
    fallback: Literal["ai", "start"] = "ai"
    keywords: dict[str, str] = Field(default_factory=dict)
    nodes: dict[str, Node]

    @model_validator(mode="after")
    def check_targets(self) -> Self:
        targets = {"start": self.start, **{f"keyword '{k}'": v for k, v in self.keywords.items()}}
        for name, node in self.nodes.items():
            targets |= {f"{name}.routes.{reply}": target for reply, target in node.routes.items()}
            if node.next:
                targets[f"{name}.next"] = node.next
        missing = {source: target for source, target in targets.items() if target not in self.nodes}
        if missing:
            detail = ", ".join(f"{source} -> {target}" for source, target in missing.items())
            raise ValueError(f"el flujo apunta a nodos inexistentes: {detail}")
        self.keywords = {normalize(keyword): node for keyword, node in self.keywords.items()}
        return self

    @classmethod
    def load(cls, path: Path) -> Self:
        return cls.model_validate(json.loads(path.read_text(encoding="utf-8")))

    def chain(self, node_id: str) -> list[str]:
        visited: list[str] = []
        current: str | None = node_id
        while current is not None and current not in visited:
            visited.append(current)
            current = self.nodes[current].next
        return visited
