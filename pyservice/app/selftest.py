"""Runnable self-test for the matching layer — no pytest, no HTTP.

Run:  .venv/bin/python app/selftest.py   (from pyservice/)
   or  python -m app.selftest

Calls the matching functions DIRECTLY and asserts the SPEC §5 behavior:
budget/timeline/keyword parsing, ranking order, suggestedQty hints, and FX
conversion (real if reachable, otherwise the safe USD fallback).
"""

from __future__ import annotations

import sys

# Allow running both as `python app/selftest.py` and `python -m app.selftest`.
if __package__ in (None, ""):
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.fx import convert_cents, get_fx
    from app.matching import parse_constraints, rank_items
else:
    from .fx import convert_cents, get_fx
    from .matching import parse_constraints, rank_items


_passed = 0
_failed = 0


def check(label: str, cond: bool, detail: str = "") -> None:
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  PASS  {label}")
    else:
        _failed += 1
        print(f"  FAIL  {label}" + (f"  -> {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# Fixtures.
# ---------------------------------------------------------------------------

CATALOG = [
    {
        "id": "web-multipage",
        "category": "Web Development",
        "name": "Multi-page Marketing Website",
        "description": "Custom multi-page marketing website with responsive design.",
        "unit": "page",
        "unitPriceCents": 120000,
        "currency": "USD",
        "tags": ["website", "marketing", "responsive", "page"],
        "defaultQty": 1,
    },
    {
        "id": "seo-setup",
        "category": "Marketing",
        "name": "SEO Setup & Optimization",
        "description": "On-page SEO, metadata, sitemap and search console setup.",
        "unit": "project",
        "unitPriceCents": 80000,
        "currency": "USD",
        "tags": ["seo", "search", "optimization", "marketing"],
        "defaultQty": 1,
    },
    {
        "id": "blog-setup",
        "category": "Content",
        "name": "Blog Module & Content System",
        "description": "Blog with CMS, categories and an initial set of posts.",
        "unit": "project",
        "unitPriceCents": 60000,
        "currency": "USD",
        "tags": ["blog", "content", "cms", "posts"],
        "defaultQty": 1,
    },
    {
        "id": "logo-design",
        "category": "Design",
        "name": "Logo & Brand Identity",
        "description": "Logo design, color palette and brand guidelines.",
        "unit": "project",
        "unitPriceCents": 90000,
        "currency": "USD",
        "tags": ["logo", "branding", "design", "identity"],
        "defaultQty": 1,
    },
    {
        "id": "hosting-monthly",
        "category": "Support/Hosting",
        "name": "Managed Hosting",
        "description": "Managed cloud hosting with backups and monitoring.",
        "unit": "month",
        "unitPriceCents": 5000,
        "currency": "USD",
        "tags": ["hosting", "support", "maintenance"],
        "defaultQty": 12,
    },
]

REQUEST_TEXT = (
    "I need a 3-page marketing website with SEO and a blog, "
    "budget $5,000, launch in 6 weeks"
)


def main() -> int:
    print("Proposa pyservice self-test")
    print("=" * 48)

    # --- Constraints ------------------------------------------------------
    print("\n[constraints]")
    c = parse_constraints(REQUEST_TEXT)
    print(f"  parsed: {c}")
    check("budget parsed to 500000 cents", c["budgetCents"] == 500000,
          f"got {c['budgetCents']}")
    check("budget currency USD", c["budgetCurrency"] == "USD",
          f"got {c['budgetCurrency']}")
    check("timeline ~ '6 weeks'",
          c["timelineText"] is not None and "6 weeks" in c["timelineText"].lower(),
          f"got {c['timelineText']}")
    for term in ("website", "seo", "blog"):
        check(f"keywords include '{term}'", term in c["keywords"],
              f"keywords={c['keywords']}")

    # --- Ranking ----------------------------------------------------------
    print("\n[ranking]")
    ranked = rank_items(REQUEST_TEXT, c["keywords"], CATALOG, top_n=12)
    print(f"  ranked {len(ranked)} items:")
    for r in ranked:
        print(f"    {r['score']:.3f}  qty={r['suggestedQty']:>2}  {r['name']}")
    check("ranked items non-empty", len(ranked) > 0, f"got {len(ranked)}")
    scores = [r["score"] for r in ranked]
    check("ranked sorted by score desc", scores == sorted(scores, reverse=True),
          f"scores={scores}")
    check("scores normalized to <=1.0", all(s <= 1.0 for s in scores),
          f"scores={scores}")
    ids = {r["catalogItemId"] for r in ranked}
    for expected in ("web-multipage", "seo-setup", "blog-setup"):
        check(f"ranked includes '{expected}'", expected in ids, f"ids={ids}")
    # Quantity hint "3-page" should bump the page-unit website item to qty 3.
    website = next((r for r in ranked if r["catalogItemId"] == "web-multipage"), None)
    check("website suggestedQty bumped to 3 by '3-page' hint",
          website is not None and website["suggestedQty"] == 3,
          f"got {website['suggestedQty'] if website else None}")
    # Irrelevant item should be filtered out (logo not mentioned).
    check("irrelevant 'logo-design' excluded", "logo-design" not in ids)

    # --- FX ---------------------------------------------------------------
    print("\n[fx]")
    fx = get_fx("BRL")
    print(f"  fx: {fx}")
    check("fx base is USD", fx["base"] == "USD", f"got {fx['base']}")
    check("fx has positive rate", isinstance(fx["rate"], float) and fx["rate"] > 0,
          f"got {fx['rate']}")
    if fx["target"] == "BRL":
        print("  (live FX reachable: real BRL rate used)")
        check("BRL rate is realistic (1.5..15)", 1.5 < fx["rate"] < 15.0,
              f"got {fx['rate']}")
    else:
        print("  (live FX unreachable: safe USD fallback used)")
        check("fallback target USD with rate 1.0",
              fx["target"] == "USD" and fx["rate"] == 1.0, f"got {fx}")
    converted = convert_cents(120000, fx)
    print(f"  convert 120000 USD cents -> {converted} {fx['target']} cents")
    check("conversion is int and >0", isinstance(converted, int) and converted > 0,
          f"got {converted}")

    # --- USD passthrough --------------------------------------------------
    fx_usd = get_fx("USD")
    check("USD->USD rate is 1.0", fx_usd["rate"] == 1.0, f"got {fx_usd['rate']}")
    check("USD passthrough keeps cents",
          convert_cents(120000, fx_usd) == 120000)

    # --- Summary ----------------------------------------------------------
    print("\n" + "=" * 48)
    print(f"RESULT: {_passed} passed, {_failed} failed")
    return 0 if _failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
