from app.formatting import split_message, to_whatsapp


def test_markdown_becomes_whatsapp() -> None:
    markdown = (
        "## Planes\n\n**Básico** y __Pro__, ~~viejo~~.\n\n- uno\n* dos\n\n[Web](https://x.pe)"
    )
    assert to_whatsapp(markdown) == (
        "*Planes*\n\n*Básico* y *Pro*, ~viejo~.\n\n• uno\n• dos\n\nWeb (https://x.pe)"
    )


def test_tables_are_flattened() -> None:
    table = "| Plan | Precio |\n|---|---|\n| Ads | S/ 790 |"
    assert to_whatsapp(table) == "Plan · Precio\nAds · S/ 790"


def test_split_keeps_paragraphs_together() -> None:
    text = "uno uno\n\ndos dos\n\ntres tres"
    assert split_message(text, limit=16) == ["uno uno\n\ndos dos", "tres tres"]


def test_split_cuts_oversized_paragraph_on_words() -> None:
    chunks = split_message("palabra " * 10, limit=20)
    assert all(len(chunk) <= 20 for chunk in chunks)
    assert " ".join(chunks).split() == ["palabra"] * 10
