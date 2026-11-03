import re
import unicodedata

_NON_WORD = re.compile(r"[^\w\s]")
_SPACES = re.compile(r"\s+")


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    stripped = "".join(char for char in decomposed if not unicodedata.combining(char))
    return _SPACES.sub(" ", _NON_WORD.sub(" ", stripped)).strip()


def contains_phrase(text: str, phrase: str) -> bool:
    return f" {phrase} " in f" {text} "
