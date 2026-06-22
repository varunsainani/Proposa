# Proposa

An **AI Quote Generator**: describe a project in plain language and Proposa
returns a polished, itemized, professional proposal in seconds. The point is the
before/after, raw structured data in, a tailored natural-language proposal out,
so it is clearly real AI work and not a chatbot wrapper.

**Live demo:** https://proposa-woad.vercel.app — on the login page use a one-click
demo button (user or admin); no signup needed.

## How it works (Python + Node + React)

A request flows through three services:

1. The **Next.js** front end posts your request (text, language, currency).
2. A **Python (FastAPI)** data-gathering service parses the constraints (budget,
   timeline, keywords), ranks a structured service catalog against the request,
   and enriches it with **live exchange rates** from a real public API so prices
   can be quoted in any currency.
3. The **Node (Express)** backend feeds the request plus that structured data into
   an **LLM**, which writes a proposal: scope summary, itemized line items,
   totals, timeline, assumptions, terms and a natural-language cover note. The
   backend recomputes all money server-side (the model is never trusted for
   arithmetic), persists the quote, and serves a **PDF export**.

You can then **refine the quote conversationally** ("make it cheaper", "add
hosting", "rewrite it in Spanish") and the proposal regenerates live.

## Free to run, Claude-capable

The LLM sits behind an `LLMProvider` interface. The live demo runs on **Google
Gemini** (free tier), and a full **Anthropic / Claude** provider is implemented
and selectable with one environment variable (`LLM_PROVIDER`). Prompts are
model-agnostic and request structured JSON output, validated server-side with a
retry and a deterministic fallback so a bad model response never breaks a request.

## Features

- 📝 **Plain-language to proposal** — a request becomes a structured, itemized,
  signable document.
- 🐍 **Real Python data layer** — FastAPI parses constraints, ranks the catalog,
  and calls a live FX API; the matched data is shown as the "before" proof.
- 💱 **Any currency** — prices converted at live rates (USD / BRL / ARS / EUR / MXN).
- 🌍 **Proposals in EN / ES / PT** — the document is written in the language you pick.
- 💬 **Conversational refinement** — chat to adjust scope, price, timeline or language.
- 📄 **PDF export** — download a clean proposal document.
- 🛡️ **Hardened** — JWT auth with refresh rotation and roles, every quote scoped to
  its owner, a per-user daily generation cap, the LLM key kept server-side only,
  and money computed server-side.
- 🌗 **Light / dark**, responsive, with a distinct editorial / document design.

## Tech stack

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Frontend   | Next.js (App Router), React, TypeScript, Tailwind, next-intl     |
| Node API   | Node, Express, TypeScript, Prisma, an `LLMProvider` (Gemini + Claude), pdf-lib |
| Python API | Python, FastAPI, httpx (live FX), a ranking/matching module      |
| Database   | PostgreSQL (Neon)                                                |
| Hosting    | Vercel (frontend + Node serverless + Python serverless) + Neon   |

The front end proxies `/api/*` to the Node backend, which calls the Python service
server-to-server, so the whole product lives behind a single URL.

## Project structure

```
frontend/   Next.js + Tailwind app (the Studio, quote view, dashboards), i18n
backend/    Express API, Prisma schema, the LLM layer, PDF export
pyservice/  FastAPI data-gathering / matching service (constraints, ranking, FX)
```

## Running locally

### 1. Python service
```bash
cd pyservice
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt uvicorn
PY_SHARED_SECRET=dev-secret .venv/bin/uvicorn api.index:app --port 8000
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # set DATABASE_URL (Neon), JWT secrets, GEMINI_API_KEY,
                       # PY_SHARED_SECRET (match the Python service), PY_SERVICE_URL
npm run prisma:push
npm run seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # set API_PROXY_TARGET to the backend URL
npm run dev
```

Open http://localhost:3000.

## The LLM layer

Providers live in `backend/src/llm`. The demo uses Gemini
(`LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`); set
`LLM_PROVIDER=anthropic` plus `ANTHROPIC_API_KEY` to switch to Claude. The model
returns a structured draft; the backend validates it, recomputes every amount,
and attaches the matched data, so the persisted quote is always internally
consistent.
