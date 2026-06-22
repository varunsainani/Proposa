import "dotenv/config";
import type { Server } from "http";
import { createApp } from "../src/app";

const PORT = 4077;
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const fails: string[] = [];
function ok(cond: boolean, label: string) {
  if (cond) pass++;
  else { fail++; fails.push(label); console.log("  x " + label); }
}

async function req(method: string, path: string, opts: { token?: string; body?: unknown; locale?: string; raw?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts.locale) headers["X-Locale"] = opts.locale;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  if (opts.raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), ctype: res.headers.get("content-type") };
  let data: any = null; const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { status: res.status, data };
}

async function main() {
  const app = createApp();
  const server: Server = await new Promise((r) => { const s = app.listen(PORT, () => r(s)); });
  try {
    let r = await req("GET", "/health");
    ok(r.status === 200 && r.data?.ok === true, "GET /health");

    r = await req("GET", "/quotes");
    ok(r.status === 401, "GET /quotes without token -> 401");

    r = await req("POST", "/auth/demo", { body: { role: "user" } });
    ok(r.status === 200 && !!r.data?.accessToken && r.data?.user?.email === "demo@proposa.app", `demo login (${r.status})`);
    const token = r.data.accessToken;

    r = await req("GET", "/catalog", { token });
    ok(r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `GET /catalog (${r.data?.length} items)`);

    // FULL PIPELINE: Node -> Python(:8000) -> Gemini -> assemble -> persist
    console.log("  ... generating (Python match + live Gemini) ...");
    r = await req("POST", "/quotes/generate", { token, body: { requestText: "I need a 3-page marketing website with SEO and a contact form, launch in about 6 weeks, budget around $5,000", language: "en", currency: "BRL" } });
    ok(r.status === 201 && !!r.data?.id, `POST /quotes/generate (${r.status})`);
    const q = r.data;
    ok(Array.isArray(q?.data?.lineItems) && q.data.lineItems.length > 0, `quote has line items (${q?.data?.lineItems?.length})`);
    ok(typeof q?.data?.totalCents === "number" && q.data.totalCents > 0, `quote has total (${q?.data?.totalCents})`);
    ok(q?.currency === "BRL" && q?.data?.currency === "BRL", "currency BRL");
    ok(q?.data?.matchedInputs?.fx?.target === "BRL" && q.data.matchedInputs.fx.rate > 1, `matchedInputs FX (rate ${q?.data?.matchedInputs?.fx?.rate})`);
    ok(typeof q?.data?.coverNote === "string" && q.data.coverNote.length > 20, "cover note present");
    ok(typeof q?.totalCents === "number", "totalCents serialized as number (BigInt boundary)");
    const qid = q.id;

    r = await req("GET", `/quotes/${qid}`, { token });
    ok(r.status === 200 && r.data?.id === qid, "GET /quotes/:id");
    r = await req("GET", "/quotes", { token });
    ok(r.status === 200 && r.data.some((x: any) => x.id === qid), "GET /quotes includes it");

    console.log("  ... refining (live Gemini) ...");
    r = await req("POST", `/quotes/${qid}/refine`, { token, body: { message: "Please make it about 20% cheaper" } });
    ok(r.status === 200 && r.data?.id === qid, `refine (${r.status})`);
    ok(Array.isArray(r.data?.messages) && r.data.messages.length >= 2, `refine appended messages (${r.data?.messages?.length})`);

    r = await req("GET", `/quotes/${qid}/pdf`, { token, raw: true });
    ok(r.status === 200 && r.ctype?.includes("application/pdf") && r.buf!.slice(0, 4).toString() === "%PDF", `PDF export (${r.status}, ${r.buf?.length} bytes)`);

    r = await req("PATCH", `/quotes/${qid}`, { token, body: { status: "FINAL" } });
    ok(r.status === 200 && r.data?.status === "FINAL", "PATCH status FINAL");

    // cap is high; just confirm a 2nd generate also works is skipped to save quota
    r = await req("DELETE", `/quotes/${qid}`, { token });
    ok(r.status === 200 && r.data?.ok === true, "DELETE quote (cleanup)");

    // i18n
    const en = await req("POST", "/auth/login", { locale: "en", body: { email: "demo@proposa.app", password: "wrong" } });
    const es = await req("POST", "/auth/login", { locale: "es", body: { email: "demo@proposa.app", password: "wrong" } });
    ok(en.status === 401 && es.status === 401 && en.data?.error?.message !== es.data?.error?.message, "error localized (en != es)");

    // admin
    r = await req("POST", "/auth/demo", { body: { role: "admin" } });
    ok(r.status === 200 && r.data?.user?.role === "ADMIN", "demo admin");
    const adminToken = r.data.accessToken;
    r = await req("GET", "/admin/overview", { token: adminToken });
    ok(r.status === 200 && !!r.data?.stats && typeof r.data.stats.totalValueCents === "number", "admin overview stats");
    r = await req("GET", "/admin/overview", { token });
    ok(r.status === 403, "admin overview as user -> 403");
  } finally {
    server.close();
  }
  console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
  if (fail > 0) { console.log("FAILURES:\n - " + fails.join("\n - ")); process.exit(1); }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
