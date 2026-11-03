import re

WHATSAPP_LIMIT = 4096

_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"```[a-zA-Z]*\n?"), "```"),
    (re.compile(r"^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$", re.MULTILINE), r"*\1*"),
    (re.compile(r"\*\*(.+?)\*\*"), r"*\1*"),
    (re.compile(r"__(.+?)__"), r"*\1*"),
    (re.compile(r"~~(.+?)~~"), r"~\1~"),
    (re.compile(r"!\[([^\]]*)\]\(([^)]+)\)"), r"\2"),
    (re.compile(r"\[([^\]]+)\]\(([^)]+)\)"), r"\1 (\2)"),
    (re.compile(r"^[ \t]*[*+-][ \t]+", re.MULTILINE), "• "),
    (re.compile(r"^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$", re.MULTILINE), ""),
]
_TABLE_SEPARATOR = re.compile(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")


def _flatten_table_line(line: str) -> str | None:
    if _TABLE_SEPARATOR.match(line):
        return None
    if line.strip().startswith("|"):
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        return " · ".join(cell for cell in cells if cell)
    return line


def to_whatsapp(markdown: str) -> str:
    lines = (_flatten_table_line(line) for line in markdown.replace("\r\n", "\n").split("\n"))
    text = "\n".join(line for line in lines if line is not None)
    for pattern, replacement in _RULES:
        text = pattern.sub(replacement, text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def split_message(text: str, limit: int = WHATSAPP_LIMIT) -> list[str]:
    chunks: list[str] = []
    current = ""
    for paragraph in (p.strip() for p in text.split("\n\n")):
        if not paragraph:
            continue
        candidate = f"{current}\n\n{paragraph}" if current else paragraph
        if len(candidate) <= limit:
            current = candidate
            continue
        if current:
            chunks.append(current)
        while len(paragraph) > limit:
            cut = paragraph.rfind(" ", 0, limit)
            cut = cut if cut > 0 else limit
            chunks.append(paragraph[:cut].rstrip())
            paragraph = paragraph[cut:].lstrip()
        current = paragraph
    if current:
        chunks.append(current)
    return chunks
