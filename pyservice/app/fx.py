"""Live FX rates from a free, keyless endpoint, cached in-process.

The /match handler converts catalog `unitPriceCents` (base USD) into the
request currency using `get_fx(target)`. On any failure we fall back to a
USD rate of 1.0 and NEVER raise, so a flaky external API can't take the
service down.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, Optional

import httpx

# Default free, keyless endpoint. Overridable via env for tests / mirrors.
DEFAULT_FX_URL = "https://open.er-api.com/v6/latest/USD"

# Cache the whole USD-base rate table in-process. open.er-api.com publishes
# one document with every target, so one fetch serves all currencies.
_CACHE_TTL_SECONDS = 60 * 60  # 1 hour; FX moves slowly enough for quotes.

_cache: Dict[str, Any] = {
    "rates": None,      # dict[str, float] of USD->X rates
    "as_of": None,      # ISO-ish timestamp string from the provider
    "fetched_at": 0.0,  # monotonic-ish epoch seconds of last successful fetch
}

# Fallback used whenever we cannot produce a real rate for the target.
_FALLBACK = {"base": "USD", "target": "USD", "rate": 1.0, "asOf": None}


def _fx_url() -> str:
    return os.environ.get("FX_URL") or DEFAULT_FX_URL


def _cache_is_fresh() -> bool:
    return (
        _cache["rates"] is not None
        and (time.time() - float(_cache["fetched_at"])) < _CACHE_TTL_SECONDS
    )


def _refresh_rates() -> bool:
    """Fetch the USD-base rate table and populate the cache. Returns success."""
    try:
        resp = httpx.get(_fx_url(), timeout=8.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return False

    # Support both open.er-api.com ({"rates": {...}, "time_last_update_utc": ...})
    # and exchangerate-style ({"rates": {...}, "date": ...}) shapes.
    rates = data.get("rates")
    if not isinstance(rates, dict) or not rates:
        return False

    as_of = (
        data.get("time_last_update_utc")
        or data.get("time_last_update_unix")
        or data.get("date")
        or data.get("asOf")
    )

    _cache["rates"] = {str(k).upper(): v for k, v in rates.items()}
    _cache["as_of"] = str(as_of) if as_of is not None else None
    _cache["fetched_at"] = time.time()
    return True


def get_fx(target: Optional[str]) -> Dict[str, Any]:
    """Return {base:"USD", target, rate, asOf} for converting USD -> target.

    Never raises. Falls back to USD/1.0 on any failure or unknown currency.
    """
    tgt = (target or "USD").strip().upper()
    if not tgt:
        tgt = "USD"

    if tgt == "USD":
        # No conversion needed; still surface a real asOf if we have it cached.
        return {
            "base": "USD",
            "target": "USD",
            "rate": 1.0,
            "asOf": _cache["as_of"] if _cache["rates"] is not None else None,
        }

    if not _cache_is_fresh():
        _refresh_rates()  # best-effort; failure leaves any stale cache in place

    rates = _cache["rates"]
    if isinstance(rates, dict):
        rate = rates.get(tgt)
        if isinstance(rate, (int, float)) and rate > 0:
            return {
                "base": "USD",
                "target": tgt,
                "rate": float(rate),
                "asOf": _cache["as_of"],
            }

    # Unknown currency or no rates available: safe fallback (no crash).
    return dict(_FALLBACK)


def convert_cents(unit_price_cents: int, fx: Dict[str, Any]) -> int:
    """Convert an integer-cent USD amount into the target currency cents."""
    try:
        rate = float(fx.get("rate", 1.0))
    except (TypeError, ValueError):
        rate = 1.0
    return int(round(int(unit_price_cents) * rate))
