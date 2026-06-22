# Proposa — Plan

**Proposa** is an AI Quote Generator: you describe a request in plain language and
it produces a polished, itemized, professional proposal in seconds. The point of
the demo is the before/after: raw structured data in, a tailored natural-language
proposal out, clearly "the AI did real work, not a chatbot wrapper."

This is **Project 4** of the brief (AI-assisted quoting/research, near-exact match
to the flight-quoting job post). Framed generically as an **AI Quote Generator** so
it shows the pattern without being locked to one fragile use case.

## The LLM decision (free to run, Claude-capable)

Claude API cost is a blocker, so the live demo runs on a **free** model, behind a
provider interface:

- **`LLMProvider` interface** with two implementations:
  - **Gemini** (ACTIVE, default) — Google Gemini Flash on the **free** Google AI
    Studio tier (free API key, no billing). Comfortably covers a demo.
  - **Claude / Anthropic** (IMPLEMENTED, switchable via `LLM_PROVIDER=anthropic`)
    so the portfolio still demonstrates real Anthropic API integration in the code.
- Prompts are written model-agnostic and request **structured JSON output**, so
  quality holds on Gemini and the provider is a one-line swap.
- Optional third provider stub (Groq / OpenRouter, also free) is trivial to add
  against the same interface.

## Architecture (Python + Node + React)

Three pieces, three Vercel deploys, one Neon database:

```
frontend/   Next.js (App Router) + React + Tailwind         -> proxies /api to node
backend/    Node + Express + TS + Prisma (auth, DB, LLM orchestration, PDF)
pyservice/  Python + FastAPI (the data-gathering / matching layer)  <- the Python the job post wants
```

Flow of a generation:
1. Front end posts the request (text + language + currency) to the Node backend.
2. Node loads the **service catalog** from Postgres (Prisma) and posts
   `{ request, catalog }` to the **Python** service.
3. **Python** does the real data work: parses constraints (budget, timeline,
   quantities) from the request, scores/ranks the catalog items against it
   (keyword + lightweight relevance), and **enriches with a real external API**
   (live FX rates from a free, keyless endpoint) to convert prices into the
   requested currency. Returns a structured "quote input" (ranked line items +
   constraints + FX).
4. Node feeds request + structured quote-input into the **LLM** (Gemini) and gets
   back a structured proposal: scope summary, line items (qty, unit, price),
   subtotal/total, timeline, assumptions, terms, and a natural-language cover note.
5. Node persists the Quote and returns it. The front end renders it as a document
   and offers **PDF export** and **chat refinement**.

This keeps the proven Node/Prisma/Neon/i18n core, while a genuine Python service
does the data-gathering/matching the job post explicitly asked for, and calls a
real external API.

## Tech stack

| Layer      | Technology                                                         |
| ---------- | ------------------------------------------------------------------ |
| Frontend   | Next.js (App Router), React, TypeScript, Tailwind, next-intl, next-themes |
| Node API   | Node, Express, TypeScript, Prisma, the `LLMProvider` (Gemini + Claude) |
| Python API | Python, FastAPI, httpx (FX API), a small ranking/scoring module     |
| Database   | PostgreSQL (Neon)                                                   |
| Hosting    | Vercel: 3 projects (frontend, node api, python api) + Neon          |

Single public URL: the front end proxies `/api/*` to the Node backend; the Node
backend calls the Python service server-to-server (`PY_SERVICE_URL`).

## Data model (Prisma)

- **User** — id, email, passwordHash, name, role (`USER`|`ADMIN`), locale.
- **RefreshToken** — JWT refresh rotation.
- **CatalogItem** — the controlled structured dataset (so nothing scrapes/breaks):
  id, category, name, description, unit, unitPriceCents, currency (base USD),
  tags[], defaultQty, active. Seeded with ~40 realistic service line items across
  a few categories (web, design, marketing, content, support).
- **Quote** — id, userId, title, requestText, language, currency, status
  (`DRAFT`|`FINAL`), data JSON (the generated proposal: lineItems, subtotal, total,
  timeline, assumptions, terms, coverNote, matchedInputs), totalCents, model
  (which LLM produced it), createdAt, updatedAt.
- **QuoteMessage** — chat refinement log: id, quoteId, role (`user`|`assistant`),
  content, createdAt.

## Key endpoints

Node backend (`/api/*` from the browser):
- Auth: `register`, `login`, `demo` (one-click), `refresh`, `logout`, `me`.
- `GET /catalog` — browse the service catalog (the data source).
- `POST /quotes/generate` `{ requestText, language, currency }` — orchestrates
  Python match + LLM generate, persists, returns the full Quote.
- `GET /quotes` / `GET /quotes/:id` / `DELETE /quotes/:id`.
- `POST /quotes/:id/refine` `{ message }` — re-runs the LLM with the existing quote
  + chat history + instruction; updates the quote; appends QuoteMessage.
- `GET /quotes/:id/pdf` — server-rendered PDF download of the proposal.
- `PATCH /quotes/:id` — title/status/currency tweaks.
- Admin: overview (quotes, users, totals), users, all quotes.

Python service (called by Node, not the browser):
- `POST /match` `{ request, catalog }` → `{ items[], constraints, fx }`.
- `GET /health`.

## Pages (frontend)

- **Landing** — editorial hero showing the before/after (raw data block morphing
  into a polished proposal), feature highlights, demo CTA.
- **Login** — one-click demo (user + admin) + real credentials.
- **Studio** (the core) — left: the request form (rich textarea, language,
  currency, optional hints); right: the generated **proposal document** (scope,
  itemized priced table, totals, timeline, assumptions, cover note); a collapsible
  "what the data layer matched" panel (the before/after proof); a **chat** to
  refine; buttons: regenerate, save, **Download PDF**.
- **Quotes** — saved quotes list (title, total, language, date, status), open/delete.
- **Quote view** — a clean, printable proposal document.
- **Catalog** — browse the seeded service catalog (shows the structured source).
- **Settings** (profile, language, theme) and **Admin** (overview + users + quotes).

## Distinct design (editorial / document)

Must not look like the other projects (Fluxo dark node-canvas, Reservo booking,
etc.). Identity = **refined editorial / proposal document**:
- Light-first, paper-like surfaces (warm ivory/stone), generous whitespace.
- A **serif display** face for headings (proposal/letterhead feel) + a clean sans
  for body; tabular figures for the priced tables.
- One sophisticated accent (deep ink/indigo or forest), restrained.
- The generated proposal renders like a real document: title block, sectioned
  layout, a professional line-item table, totals, signature/terms area.
- Tasteful "AI is working" streaming states. Dark mode supported, light is the brand.

## Cross-cutting (house non-negotiables)

- **i18n EN/ES/PT**, full parity, UI **and** backend messages (`X-Locale` header +
  `Accept-Language` fallback), auto-detect + visible toggle, locale-aware
  number/currency/date. Plus a standout feature: the **generated proposal itself**
  can be produced in EN, ES or PT (the LLM writes in the chosen language).
- **Genuinely full-stack**: every page fetches live data; one-click demo = real
  session; quotes persist; chat refine persists; no dead buttons.
- Light/dark + responsive. JWT auth + refresh + roles.
- Rich seed: demo user with several saved quotes (varied languages/currencies),
  the full catalog, chat history on one quote. Reseed prod pristine after tests.

## Security / cost notes

- The LLM key lives only in the Node backend env (never shipped to the browser,
  never committed). Free Gemini tier; a light per-user/day generation cap so the
  demo can't be abused to burn quota. Structured-output validation on the LLM
  response (zod) with a graceful fallback if the model returns malformed JSON.
- The Python service is reachable only by the Node backend (shared secret header),
  not publicly. FX API is keyless and cached.

## Build sequence (on "start")

1. Scaffold the 3 packages + Prisma schema + SPEC contract + design tokens.
2. Fan out scoped agents: (a) Node auth + DB + quote/catalog CRUD; (b) the
   `LLMProvider` (Gemini active + Claude coded) + generate/refine orchestration +
   PDF; (c) Python FastAPI match/rank/FX service; (d) frontend design system +
   i18n + shell + pages; (e) the Studio (form + document render + chat + PDF).
3. Reconcile contracts; in-process tests (mock the LLM for determinism, plus one
   real live call).
4. Deploy all-Vercel (3 projects) + Neon; wire `PY_SERVICE_URL` + the LLM key; fix
   aliases; verify a real end-to-end generation live.
5. Multi-perspective audit (security incl. prompt-injection + key leakage + LLM
   output validation, i18n, functional/no-dead-buttons, adversarial) + a live
   browser pass; fix; re-verify.
6. EN screenshots + Workana copy.

## What I need from you to start

1. An **empty GitHub repo**: `git@github.com:varunsainani/proposa.git` (or another name).
2. A **fresh Neon** pooled connection string for Proposa's DB.
3. The **Vercel token**.
4. A **free Gemini API key** from https://aistudio.google.com/apikey (Google account
   only, no billing). Optional: a Claude key only if you ever want to flip the
   provider on; not needed for the live demo.

Say **start** and I'll build it.
