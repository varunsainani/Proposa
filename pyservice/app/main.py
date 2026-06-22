"""Proposa FastAPI service — the data-gathering / matching layer.

Endpoints (per SPEC §5):
  GET  /health  -> {"ok": true}                 (no auth)
  POST /match   -> constraints + rankedItems + fx
                   Requires header X-Internal-Secret == env PY_SHARED_SECRET
                   (constant-time compare); 401 otherwise.

The browser never reaches this service; only the Node backend calls it
server-to-server with the shared secret.
"""

from __future__ import annotations

import hmac
import os
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .fx import convert_cents, get_fx
from .matching import parse_constraints, rank_items

app = FastAPI(title="Proposa pyservice", version="1.0.0")


# ---------------------------------------------------------------------------
# Request / response models (shapes MUST match SPEC §5 exactly).
# ---------------------------------------------------------------------------


class MatchRequestInfo(BaseModel):
    text: str
    language: Optional[str] = "en"
    currency: Optional[str] = "USD"


class CatalogItemIn(BaseModel):
    id: str
    category: str = ""
    name: str = ""
    description: str = ""
    unit: str = ""
    unitPriceCents: int = 0
    currency: str = "USD"
    tags: List[str] = Field(default_factory=list)
    defaultQty: int = 1


class MatchBody(BaseModel):
    request: MatchRequestInfo
    catalog: List[CatalogItemIn] = Field(default_factory=list)


class Constraints(BaseModel):
    budgetCents: Optional[int] = None
    budgetCurrency: Optional[str] = None
    timelineText: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)


class RankedItem(BaseModel):
    catalogItemId: str
    name: str
    category: str
    unit: str
    unitPriceCents: int
    score: float
    suggestedQty: int


class FxBlock(BaseModel):
    base: str
    target: str
    rate: float
    asOf: Optional[str] = None


class MatchResponse(BaseModel):
    constraints: Constraints
    rankedItems: List[RankedItem]
    fx: FxBlock


# ---------------------------------------------------------------------------
# Auth helper.
# ---------------------------------------------------------------------------


def _require_secret(provided: Optional[str]) -> None:
    expected = os.environ.get("PY_SHARED_SECRET", "")
    # Constant-time compare. If no secret is configured, always reject.
    if not expected or not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


# ---------------------------------------------------------------------------
# Routes.
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/match", response_model=MatchResponse)
def match(
    body: MatchBody,
    x_internal_secret: Optional[str] = Header(default=None, alias="X-Internal-Secret"),
) -> MatchResponse:
    _require_secret(x_internal_secret)

    text = body.request.text or ""
    target_currency = (body.request.currency or "USD").upper()

    # 1. Parse constraints (budget / timeline / keywords).
    constraints = parse_constraints(text)

    # 2. Rank catalog items by relevance.
    catalog = [item.model_dump() for item in body.catalog]
    ranked = rank_items(text, constraints["keywords"], catalog, top_n=12)

    # 3. Enrich with live FX and convert each unit price from USD -> target.
    fx = get_fx(target_currency)
    for item in ranked:
        item["unitPriceCents"] = convert_cents(item["unitPriceCents"], fx)

    return MatchResponse(
        constraints=Constraints(**constraints),
        rankedItems=[RankedItem(**item) for item in ranked],
        fx=FxBlock(**fx),
    )
