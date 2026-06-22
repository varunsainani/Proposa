"""The real data-gathering work of the Python layer.

Three jobs, all deterministic and dependency-light:

1. parse_constraints(text) -> budget (cents + currency), timeline text, keywords.
2. rank_items(text, keywords, catalog) -> top ~12 catalog items scored by
   relevance with a heuristic suggestedQty.
3. (FX conversion lives in app.fx and is applied by the /match handler.)
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Stopwords (EN / ES / PT common words) so keyword extraction keeps meaning.
# ---------------------------------------------------------------------------

_STOPWORDS = {
    # English
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "have",
    "has", "had", "i", "in", "into", "is", "it", "its", "me", "my", "need",
    "needs", "of", "on", "or", "our", "so", "that", "the", "their", "them",
    "they", "this", "to", "want", "wants", "was", "we", "will", "with", "would",
    "you", "your", "can", "could", "should", "do", "does", "get", "make",
    "looking", "like", "some", "any", "all", "about", "also", "just", "new",
    "build", "building", "create", "creating", "please", "would", "must",
    # Spanish
    "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "de",
    "del", "en", "con", "para", "por", "que", "se", "su", "sus", "es", "son",
    "necesito", "necesita", "quiero", "queremos", "tengo", "tenemos", "mi",
    "mis", "nuestro", "nuestra", "lo", "al", "como", "mas", "muy", "pero",
    # Portuguese
    "o", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "de", "do", "da",
    "dos", "das", "em", "no", "na", "nos", "nas", "com", "para", "por", "que",
    "se", "seu", "sua", "seus", "suas", "preciso", "precisa", "quero",
    "queremos", "tenho", "temos", "meu", "minha", "nosso", "nossa", "como",
    "mais", "muito", "mas",
}

# ---------------------------------------------------------------------------
# Budget parsing.
# ---------------------------------------------------------------------------

# Map symbols / ISO codes / words to ISO currency codes.
_CURRENCY_SYMBOLS: List[Tuple[str, str]] = [
    ("R$", "BRL"),
    ("US$", "USD"),
    ("AR$", "ARS"),
    ("$", "USD"),
    ("€", "EUR"),
    ("£", "GBP"),
    ("¥", "JPY"),
]

_CURRENCY_CODES = {
    "USD", "BRL", "ARS", "EUR", "GBP", "JPY", "MXN", "CLP", "COP", "PEN",
    "UYU", "CAD", "AUD", "CHF", "CNY", "INR",
}

# A number that may use thousands separators (',' or '.') and an optional
# decimal part, optionally followed by a 'k'/'m' magnitude suffix.
_AMOUNT_RE = re.compile(
    r"""
    (?P<num>
        \d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})? |   # grouped: 5,000 / 5.000,50 / 1.234.567
        \d+(?:[.,]\d+)?                            # plain:   200000 / 5000.50 / 2,5
    )
    \s*
    (?P<mag>[kKmM])?                              # 5k / 2m
    """,
    re.VERBOSE,
)


def _normalize_amount(num: str) -> Optional[float]:
    """Turn a localized number string into a float of currency UNITS.

    Handles both 1,234.56 (EN) and 1.234,56 (ES/PT) groupings, plus plain
    1234.5 / 1234,5.
    """
    s = num.strip()
    if not s:
        return None
    has_comma = "," in s
    has_dot = "." in s
    try:
        if has_comma and has_dot:
            # The last-occurring separator is the decimal point.
            if s.rfind(",") > s.rfind("."):
                s = s.replace(".", "").replace(",", ".")  # 1.234,56 -> 1234.56
            else:
                s = s.replace(",", "")                      # 1,234.56 -> 1234.56
        elif has_comma:
            # Ambiguous: "5,000" (thousands) vs "5,5" (decimal). More than one
            # comma => grouping. A single comma with exactly 3 trailing digits
            # => grouping; otherwise treat as a decimal point.
            parts = s.split(",")
            if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
                s = s.replace(",", "")                       # 1,234,567 / 5,000 -> plain
            else:
                s = s.replace(",", ".")                       # 5,5 -> 5.5
        elif has_dot:
            parts = s.split(".")
            if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
                s = s.replace(".", "")                       # 1.234.567 / 5.000 -> plain
            # else: already a normal decimal like 5000.50
        return float(s)
    except ValueError:
        return None


def _detect_currency(text: str, match_start: int, match_end: int) -> Optional[str]:
    """Find a currency symbol/code adjacent to the matched amount."""
    window_before = text[max(0, match_start - 8):match_start]
    window_after = text[match_end:match_end + 8]
    window = window_before + " " + window_after

    upper = window.upper()
    for code in _CURRENCY_CODES:
        if re.search(rf"\b{code}\b", upper):
            return code
    for sym, code in _CURRENCY_SYMBOLS:
        if sym in window:
            return code
    return None


def parse_budget(text: str) -> Tuple[Optional[int], Optional[str]]:
    """Return (budgetCents, budgetCurrency) parsed from the request text.

    Looks for a currency-anchored amount first; if none carries a currency
    marker, takes the largest plausible monetary amount and leaves currency None.
    """
    candidates: List[Tuple[int, Optional[str], int]] = []  # (cents, currency, priority)

    for m in _AMOUNT_RE.finditer(text):
        value = _normalize_amount(m.group("num"))
        if value is None:
            continue
        mag = (m.group("mag") or "").lower()
        if mag == "k":
            value *= 1_000
        elif mag == "m":
            value *= 1_000_000

        currency = _detect_currency(text, m.start(), m.end())

        # Skip obviously non-monetary small integers with no currency and no
        # magnitude (e.g. "3 pages", "6 weeks") so they don't masquerade as budget.
        if currency is None and not mag and value < 100:
            continue

        cents = int(round(value * 100))
        # Currency-anchored amounts win; among those, prefer larger amounts.
        priority = (2 if currency else 1)
        candidates.append((cents, currency, priority))

    if not candidates:
        return None, None

    # Highest priority, then largest amount.
    candidates.sort(key=lambda c: (c[2], c[0]), reverse=True)
    cents, currency, _ = candidates[0]
    return cents, currency


# ---------------------------------------------------------------------------
# Timeline parsing.
# ---------------------------------------------------------------------------

_TIMELINE_PATTERNS = [
    # "6 weeks", "in 3 months", "2-3 weeks", "within 10 days"
    re.compile(
        r"\b(\d+\s*(?:-|to|a|até|hasta)\s*\d+|\d+)\s*"
        r"(weeks?|wks?|months?|days?|years?|"          # EN
        r"semanas?|meses|mes|d[ií]as?|a[nñ]os?|"        # ES
        r"semanas?|meses|m[eê]s|dias?|anos?)\b",        # PT
        re.IGNORECASE,
    ),
    # explicit launch/deadline date "by March 15", "by 2026-09-01"
    re.compile(
        r"\b(?:by|before|launch(?:\s+(?:by|on))?|deadline|due|para|antes|até)\s+"
        r"([A-Za-zÀ-ÿ]+\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}(?:/\d{2,4})?)",
        re.IGNORECASE,
    ),
]


def parse_timeline(text: str) -> Optional[str]:
    """Return a short timeline phrase like "6 weeks" or "by 2026-09-01"."""
    for pat in _TIMELINE_PATTERNS:
        m = pat.search(text)
        if m:
            phrase = m.group(0).strip()
            # Collapse internal whitespace.
            return re.sub(r"\s+", " ", phrase)
    return None


# ---------------------------------------------------------------------------
# Keyword extraction.
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9+#-]*")


def extract_keywords(text: str) -> List[str]:
    """Lowercase tokenize, drop stopwords + pure numbers, keep meaningful terms.

    Preserves order of first appearance and de-duplicates.
    """
    seen: List[str] = []
    seen_set = set()
    for raw in _TOKEN_RE.findall(text.lower()):
        tok = raw.strip("-+#")
        if len(tok) < 2:
            continue
        if tok in _STOPWORDS:
            continue
        if tok.isdigit():
            continue
        if tok in seen_set:
            continue
        seen_set.add(tok)
        seen.append(tok)
    return seen


def parse_constraints(text: str) -> Dict[str, Any]:
    """Parse budget, timeline and keywords out of a free-text request."""
    text = text or ""
    budget_cents, budget_currency = parse_budget(text)
    return {
        "budgetCents": budget_cents,
        "budgetCurrency": budget_currency,
        "timelineText": parse_timeline(text),
        "keywords": extract_keywords(text),
    }


# ---------------------------------------------------------------------------
# Ranking.
# ---------------------------------------------------------------------------

# Field weights — a hit in the name matters more than one in the description.
_FIELD_WEIGHTS = {
    "name": 3.0,
    "tags": 2.5,
    "category": 1.5,
    "description": 1.0,
}

# Quantity-hint phrases that suggest "N <unit>" e.g. "3 pages", "3-page",
# "5 paginas". Allows whitespace and/or a hyphen between the count and word.
_QTY_HINT_RE = re.compile(
    r"\b(\d+)[\s-]*([A-Za-zÀ-ÿ]+)\b",
    re.IGNORECASE,
)

# Map common plural/locale unit words back to a canonical singular unit token
# so a hint like "3 pages" lines up with a catalog item whose unit is "page".
_UNIT_SYNONYMS = {
    "pages": "page", "page": "page", "paginas": "page", "página": "page",
    "páginas": "page", "pagina": "page",
    "hours": "hour", "hour": "hour", "hrs": "hour", "horas": "hour",
    "hora": "hour",
    "months": "month", "month": "month", "meses": "month", "mes": "month",
    "items": "item", "item": "item", "itens": "item",
    "projects": "project", "project": "project", "proyectos": "project",
    "projetos": "project",
    "posts": "post", "post": "post", "articles": "article",
    "article": "article", "artigos": "article", "blogs": "blog", "blog": "blog",
}


def _tokenize_field(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        text = " ".join(str(v) for v in value)
    else:
        text = str(value)
    return [t for t in (tok.strip("-+#") for tok in _TOKEN_RE.findall(text.lower())) if len(t) >= 2]


def _suggested_qty(
    item: Dict[str, Any],
    keywords: List[str],
    qty_hints: List[Tuple[int, str]],
) -> int:
    """Heuristic quantity: defaultQty, bumped if a quantity hint matches the unit."""
    default_qty = int(item.get("defaultQty") or 1)
    unit = str(item.get("unit") or "").strip().lower()
    canon_unit = _UNIT_SYNONYMS.get(unit, unit)

    name_tokens = set(_tokenize_field(item.get("name")))
    tag_tokens = set(_tokenize_field(item.get("tags")))
    item_tokens = name_tokens | tag_tokens

    for qty, hint_word in qty_hints:
        canon_hint = _UNIT_SYNONYMS.get(hint_word, hint_word)
        # The hint applies if it names this item's unit, or a word in the
        # item's name/tags (e.g. "3 pages" -> a "Landing Page" page item).
        if canon_unit and canon_hint == canon_unit:
            return max(qty, 1)
        if canon_hint in item_tokens or hint_word in item_tokens:
            return max(qty, 1)
    return max(default_qty, 1)


def rank_items(
    text: str,
    keywords: List[str],
    catalog: List[Dict[str, Any]],
    top_n: int = 12,
) -> List[Dict[str, Any]]:
    """Score catalog items by keyword/tag/category overlap (TF-style) and rank.

    Score is normalized to 0..1 across the returned set. Returns up to top_n
    items sorted by score descending.
    """
    if not keywords or not catalog:
        return []

    kw_set = set(keywords)

    # Quantity hints from the original text, e.g. ("3", "page").
    qty_hints: List[Tuple[int, str]] = []
    for m in _QTY_HINT_RE.finditer((text or "").lower()):
        try:
            qty_hints.append((int(m.group(1)), m.group(2)))
        except ValueError:
            continue

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for item in catalog:
        raw_score = 0.0
        for field, weight in _FIELD_WEIGHTS.items():
            tokens = _tokenize_field(item.get(field))
            if not tokens:
                continue
            counts = Counter(tokens)
            # TF-style: matched-keyword frequency, dampened by sqrt so a single
            # field can't dominate, then weighted by field importance.
            field_hits = sum(counts[k] for k in kw_set if k in counts)
            if field_hits:
                raw_score += weight * (1.0 + (field_hits - 1) * 0.5)

        if raw_score <= 0:
            continue

        scored.append((raw_score, item))

    if not scored:
        return []

    max_score = max(s for s, _ in scored) or 1.0
    scored.sort(key=lambda pair: pair[0], reverse=True)

    results: List[Dict[str, Any]] = []
    for raw_score, item in scored[:top_n]:
        results.append(
            {
                "catalogItemId": item.get("id"),
                "name": item.get("name"),
                "category": item.get("category"),
                "unit": item.get("unit"),
                # base USD price; FX conversion is applied by the handler.
                "unitPriceCents": int(item.get("unitPriceCents") or 0),
                "score": round(raw_score / max_score, 4),
                "suggestedQty": _suggested_qty(item, keywords, qty_hints),
            }
        )
    return results
