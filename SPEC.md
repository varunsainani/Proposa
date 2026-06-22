# Proposa — Build Contract (SPEC)

Single source of truth for every build agent. Do not invent shapes; follow this.
Proposa is an **AI Quote Generator**: plain-language request in, polished itemized
proposal out. Raw structured data (matched catalog + FX) goes IN to the LLM; a
tailored proposal comes OUT.

## 0. Repo layout (3 packages, 1 Neon DB)

```
proposa/
  frontend/   Next.js (App Router) + TS + Tailwind + React Flow? NO. + next-intl
  backend/    Node + Express + TS + Prisma (auth, DB, LLM orchestration, PDF)
  pyservice/  Python + FastAPI (data-gathering / matching layer)
```
Single public URL: frontend rewrites `/api/:path*` (+ `/health`) to the NODE backend.
The NODE backend calls the PYTHON service server-to-server at `PY_SERVICE_URL` with a
shared-secret header. The browser NEVER talks to Python directly. The LLM key lives
ONLY in the Node backend (never shipped to the browser, never committed).

## 1. Stack / tooling

- Frontend: Next.js (App Router), React, TypeScript, Tailwind (v4 `@theme`), next-intl,
  next-themes, lucide-react. (NO React Flow in this project.)
- Node: Express, TypeScript, Prisma, zod, bcryptjs, jsonwebtoken, cookie-parser, cors,
  dotenv, and a PDF lib (`pdf-lib`, pure-JS, serverless-safe). Native `fetch` for Gemini.
- Python: FastAPI, httpx (FX API), pydantic, uvicorn (local). Deploy via @vercel/python.
- Node 20+. Backend tsconfig: CommonJS, esModuleInterop, run with tsx.

## 2. Data model (backend/prisma/schema.prisma)

```prisma
enum Role { USER ADMIN }
enum QuoteStatus { DRAFT FINAL }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(USER)
  locale       String   @default("en")
  createdAt    DateTime @default(now())
  quotes       Quote[]
  refreshTokens RefreshToken[]
}
model RefreshToken {
  id String @id @default(cuid())
  userId String
  user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  tokenHash String @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])
}
model CatalogItem {
  id            String  @id @default(cuid())
  category      String
  name          String
  description   String
  unit          String          // "page", "hour", "project", "month", "item"
  unitPriceCents Int            // base currency USD
  currency      String  @default("USD")
  tags          String[]
  defaultQty    Int     @default(1)
  active        Boolean @default(true)
  createdAt     DateTime @default(now())
  @@index([category])
}
model Quote {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields:[userId], references:[id], onDelete: Cascade)
  title       String
  requestText String
  language    String      // en | es | pt  (language the proposal is written in)
  currency    String      // ISO code for the quote amounts
  status      QuoteStatus @default(DRAFT)
  data        Json        // QuoteData (see §6) - the full generated proposal + matchedInputs
  totalCents  Int
  model       String      // which LLM produced it, e.g. "gemini-flash-latest"
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  messages    QuoteMessage[]
  @@index([userId, createdAt])
}
model QuoteMessage {
  id        String   @id @default(cuid())
  quoteId   String
  quote     Quote    @relation(fields:[quoteId], references:[id], onDelete: Cascade)
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
  @@index([quoteId, createdAt])
}
```

## 3. Auth (same pattern as prior projects)

- JWT access (15m, `Authorization: Bearer`). Refresh: random 40-byte hex, sha256-hashed
  in DB, 30d, httpOnly cookie `proposa_refresh` (sameSite lax, secure in prod, path `/`),
  rotated on refresh. bcryptjs (10). `requireAuth` sets `req.user={id,role,email}`;
  `requireAdmin` checks role.
- `POST /auth/register|login`, `POST /auth/demo {role:"user"|"admin"}` (one-click into
  seeded demo@/admin@proposa.app), `POST /auth/refresh`, `POST /auth/logout`,
  `GET /auth/me`, `PATCH /auth/me {name?,locale?}`. `user` = {id,email,name,role,locale}.

## 4. Node REST endpoints (auth unless noted; scoped to req.user)

- `GET /catalog?category=` → `CatalogItem[]` (active only; public-ish, requires auth).
- `POST /quotes/generate` `{ requestText, language, currency }` → orchestrates (see §7),
  persists, returns full `Quote`. Enforce a per-user/day cap `GEN_DAILY_CAP` (default 40)
  → 429 `RATE_LIMITED` when exceeded.
- `GET /quotes?limit=` → `QuoteListItem[]` `{id,title,language,currency,totalCents,status,createdAt}`.
- `GET /quotes/:id` → full `Quote` incl. `messages`.
- `POST /quotes/:id/refine` `{ message }` → re-run LLM with current quote + history +
  instruction; update quote; append user+assistant `QuoteMessage`; return updated `Quote`.
- `PATCH /quotes/:id` `{ title?, status?, currency? }` → updated `Quote`.
- `DELETE /quotes/:id` → `{ ok:true }`.
- `GET /quotes/:id/pdf` → `application/pdf` (attachment) rendered from the quote.
- Admin (requireAdmin): `GET /admin/overview` → `{ stats:{users,quotes,totalValueCents,avgQuoteCents}, recentQuotes:(QuoteListItem & {user})[] }`; `GET /admin/users`; `GET /admin/quotes`.
- `GET /health` → `{ok:true}` (no auth).

Error shape: `{ error:{ code, message, details? } }`, localized by `X-Locale`. Codes:
`VALIDATION UNAUTHORIZED FORBIDDEN NOT_FOUND CONFLICT RATE_LIMITED LLM_ERROR INTERNAL`.
Locale middleware mounted BEFORE `express.json()`.

## 5. Python service (pyservice) — the data-gathering / matching layer

FastAPI app exposed for Vercel @vercel/python at `pyservice/api/index.py` (ASGI `app`).
Auth: every request must carry header `X-Internal-Secret: <PY_SHARED_SECRET>` (compare
constant-time) else 401. The browser cannot reach it (only Node calls it).

- `GET /health` → `{ "ok": true }`.
- `POST /match` request body:
  ```json
  { "request": { "text": "...", "language": "en", "currency": "BRL" },
    "catalog": [ { "id","category","name","description","unit","unitPriceCents","currency","tags":[],"defaultQty" } ] }
  ```
  Response:
  ```json
  { "constraints": { "budgetCents": 500000, "budgetCurrency":"BRL", "timelineText": "6 weeks", "keywords": ["website","seo","blog"] },
    "rankedItems": [ { "catalogItemId":"...", "name":"...", "category":"...", "unit":"...",
                      "unitPriceCents": 120000, "score": 0.82, "suggestedQty": 3 } ],
    "fx": { "base":"USD", "target":"BRL", "rate": 5.42, "asOf":"2026-..." } }
  ```
  Work Python MUST do (this is the point of the Python layer):
  1. Parse constraints from `request.text`: budget (currency-amount regex), timeline
     (weeks/months/dates), and keywords (tokenized, stopword-filtered).
  2. Score/rank catalog items by relevance to the request (keyword + tag + category
     overlap; simple TF-style weighting). Return the top ~12 with a `score` and a
     `suggestedQty` (heuristic from defaultQty + any quantity hints).
  3. Enrich with a REAL external API: fetch live FX from a free, keyless endpoint
     (`https://open.er-api.com/v6/latest/USD`), convert each `unitPriceCents` from base
     USD into `request.currency`. Cache the rates in-process; on failure fall back to
     rate 1.0 (USD) and note it. Return the `fx` block.

## 6. QuoteData JSON (the persisted `Quote.data`, and the frontend renderer contract)

```ts
type QuoteLineItem = { name:string; description:string; quantity:number; unit:string;
                       unitPriceCents:number; amountCents:number; catalogItemId:string|null };
type QuoteData = {
  summary: string;             // 1-2 sentence scope summary (in `language`)
  coverNote: string;           // natural-language cover letter (in `language`)
  lineItems: QuoteLineItem[];
  subtotalCents: number;
  discountCents: number;       // default 0
  taxCents: number;            // default 0
  totalCents: number;
  currency: string;
  timeline: { phase:string; duration:string }[];
  assumptions: string[];
  terms: string[];
  matchedInputs: {             // the "before" proof, from the Python layer
    constraints: { budgetCents:number|null; timelineText:string|null; keywords:string[] };
    rankedItems: { catalogItemId:string; name:string; score:number; unitPriceCents:number }[];
    fx: { base:string; target:string; rate:number };
  };
};
```
The **LLM** returns only: `{ summary, coverNote, lineItems:[{name,description,quantity,unit,unitPriceCents,catalogItemId?}], timeline, assumptions, terms }`. **Node** computes `amountCents = quantity*unitPriceCents`, `subtotalCents`, `totalCents` (= subtotal - discount + tax), sets `currency`, and attaches `matchedInputs` from the Python response. Never trust the LLM for arithmetic.

## 7. LLM layer (backend/src/llm) — free to run, Claude-capable

`interface LLMProvider { name:string;
  generateQuote(a:{ requestText, language, currency, matched }): Promise<LLMQuoteDraft>;
  refineQuote(a:{ current:QuoteData, history:{role,content}[], instruction, language, currency, matched }): Promise<LLMQuoteDraft>; }`
`LLMQuoteDraft` = the LLM-returned subset in §6.

- `gemini.ts` (ACTIVE default): POST
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  with header `X-goog-api-key: ${GEMINI_API_KEY}`, body `{ contents:[{parts:[{text:PROMPT}]}],
  generationConfig:{ responseMimeType:"application/json", temperature:0.4 } }`. Parse
  `candidates[0].content.parts[0].text` as JSON. `GEMINI_MODEL` default `gemini-flash-latest`.
- `anthropic.ts` (switchable, `LLM_PROVIDER=anthropic`): Messages API, `ANTHROPIC_MODEL`
  default `claude-sonnet-4-6`, ask for JSON-only. Implemented for portfolio value; only used
  if selected and `ANTHROPIC_API_KEY` set.
- `index.ts`: `getProvider()` from `LLM_PROVIDER` (default `gemini`).
- Prompt builder: model-agnostic; gives the request, the target language + currency, and the
  matched catalog items (with FX-converted unit prices) as the allowed price reference; asks
  for a professional proposal in `language`, line items chosen/quantified from the matched
  items where sensible (it may add reasonable items), a warm cover note, realistic timeline,
  assumptions and terms. STRICT: output ONLY the JSON object of the schema, prices in integer
  cents in `currency`. Validate with zod; on malformed output, retry once, then fall back to a
  deterministic quote built directly from the top matched items (never 500 the user).

## 8. Errors & i18n

- Trilingual EN/ES/PT, full parity: frontend UI (next-intl, cookie `NEXT_LOCALE`) AND backend
  messages (`backend/src/lib/i18n.ts`, `X-Locale` header + `Accept-Language` fallback).
- Locale-aware number/currency/date in the UI. The **generated proposal** is written in the
  user-chosen `language` (en|es|pt) by the LLM.

## 9. Seed (backend/scripts/seed.ts)

- Users: `demo@proposa.app`/`demo1234` (USER), `admin@proposa.app`/`demo1234` (ADMIN), plus
  a 2nd user for admin views.
- `CatalogItem`: ~40 realistic items across categories (Web Development, Design, Marketing,
  Content, Support/Hosting) with sensible USD unit prices, units, tags, defaultQty.
- For the demo user: ~5 saved `Quote`s across languages (en/es/pt) and currencies
  (USD/BRL/ARS), each with a real `QuoteData` (built by actually running the generate pipeline
  during seed if a Gemini key is present, else a deterministic fixture so seed never needs the
  network). One quote has a few `QuoteMessage` refine turns. Idempotent; ends pristine.

## 10. Env

Backend (`backend/.env` + `.env.example`): `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-flash-latest`,
`ANTHROPIC_API_KEY` (optional), `ANTHROPIC_MODEL` (optional), `PY_SERVICE_URL`, `PY_SHARED_SECRET`,
`APP_URL`, `CORS_ORIGIN`, `GEN_DAILY_CAP=40`, `NODE_ENV`, `PORT`. Prod fail-fast on missing JWT
secrets + GEMINI_API_KEY (when provider=gemini) + PY_SHARED_SECRET; CORS non-fatal fallback to APP_URL.

Python (`pyservice`): `PY_SHARED_SECRET` (required), optional `FX_URL` override. No DB.

Frontend (`frontend/.env.local` + `.env.example`): `API_PROXY_TARGET` (Node URL), `APP_URL`.

## 11. Frontend routes & behavior

Public: `/` (editorial landing showing the before/after raw-data->proposal), `/login`
(one-click demo user/admin + real form).
App (authed; redirect to /login; shell with sidebar + topbar with language + theme toggles +
user menu):
- `/studio` (the core) — request form (textarea + language select + currency select + optional
  hints) → Generate. On result: render the **proposal document** (title block, scope summary,
  itemized priced table with locale currency, subtotal/total, timeline, assumptions, terms,
  cover note); a collapsible **"Matched data"** panel showing constraints + ranked items +
  FX (the before/after proof); a **chat** to refine (sends `/refine`, shows updated quote);
  buttons: Regenerate, Save (PATCH status FINAL), **Download PDF** (`/quotes/:id/pdf`).
  Tasteful "AI is working" state during generate/refine.
- `/quotes` — saved quotes list (title, total in its currency, language flag, date, status);
  open/delete.
- `/quotes/[id]` — clean printable proposal view + Download PDF + open in Studio to refine.
- `/catalog` — browse the seeded service catalog (the structured source).
- `/settings` (profile name, language, theme), `/admin` (overview stats + users + quotes).

Non-negotiables: every page fetches live data; one-click demo = real session; quotes + chat
persist; NO dead buttons; EN/ES/PT parity; light/dark; responsive; locale-aware formatting.

## 12. Design (DISTINCT — editorial / proposal document)

Must not look like the other projects. Identity = refined editorial / document:
- Light-first, warm paper surfaces (ivory/stone), generous whitespace, hairline rules.
- A **serif display** face for headings (e.g. Fraunces / Source Serif via next/font) + clean
  sans (Inter) for body/UI; **tabular figures** for prices.
- One restrained accent (deep ink/indigo or forest green). Subtle, professional.
- The generated proposal renders like a real document: title/letterhead block, sectioned
  layout, a proper line-item table, totals, terms/signature area. PDF mirrors this.
- Light is the brand; dark mode fully supported. Provide tokens in `globals.css`.

## 13. Quality gates

- `tsc --noEmit` clean (frontend + backend); `next build` clean; Python imports clean
  (`python -c "import api.index"`). In-process Node tests in `backend/scripts/*.ts` (mock the
  LLM for determinism + ONE real live Gemini call); a small Python test for `/match`
  (constraints parse + ranking + FX). No port binding in sandbox (use dangerouslyDisableSandbox
  + in-process or direct function calls).
- No hardcoded user-facing strings; 3-catalog parity. No dead buttons. LLM output validated;
  never 500 on a bad model response (retry then deterministic fallback).
