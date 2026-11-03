import json
import re
from pathlib import Path

from pydantic import BaseModel, Field, TypeAdapter, model_validator

from app.errors import InvalidMessage

PLACEHOLDER = re.compile(r"\{\{(\d+)\}\}")


class Template(BaseModel):
    name: str = Field(pattern=r"^[a-z0-9_]+$")
    language: str = "es"
    body: str = Field(min_length=1, max_length=1024)
    params: list[str] = Field(default_factory=list)
    buttons: list[str] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def check_placeholders(self) -> "Template":
        found = sorted({int(number) for number in PLACEHOLDER.findall(self.body)})
        if found != list(range(1, len(self.params) + 1)):
            raise ValueError(f"la plantilla {self.name} no coincide con sus params")
        return self

    def render(self, values: list[str]) -> str:
        if len(values) != len(self.params):
            raise InvalidMessage(
                f"La plantilla {self.name} requiere {len(self.params)} parámetros "
                f"({', '.join(self.params) or 'ninguno'})."
            )
        return PLACEHOLDER.sub(lambda match: values[int(match.group(1)) - 1], self.body)


class TemplateCatalog:
    def __init__(self, templates: list[Template]) -> None:
        self._templates = {template.name: template for template in templates}

    @classmethod
    def load(cls, path: Path) -> "TemplateCatalog":
        if not path.is_file():
            return cls([])
        raw = json.loads(path.read_text(encoding="utf-8"))
        return cls(TypeAdapter(list[Template]).validate_python(raw))

    def all(self) -> list[Template]:
        return list(self._templates.values())

    def get(self, name: str) -> Template:
        template = self._templates.get(name)
        if template is None:
            raise InvalidMessage(f"La plantilla {name} no existe.")
        return template
