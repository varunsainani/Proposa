/**
 * Database seed (SPEC §9). Run:  npm run seed
 *
 * Creates:
 *   - users: demo@proposa.app / admin@proposa.app / second@proposa.app (pwd demo1234)
 *   - ~40 realistic CatalogItems across categories (USD base prices)
 *   - ~5 saved Quotes for the demo user across languages (en/es/pt) and
 *     currencies (USD/BRL/ARS), each with a REAL QuoteData built DETERMINISTICALLY
 *     (FX-rate fixtures, no network / Python required). One quote has refine
 *     QuoteMessages.
 *
 * Idempotent: wipes the three seed users (cascades their quotes/messages) and the
 * catalog, then recreates everything. Ends with a pristine, ready-to-demo DB.
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  assembleQuoteData,
  type QuoteData,
} from "../src/lib/quote-assemble";
import type { MatchResult, RankedItem } from "../src/lib/pyclient";
import type { LLMQuoteDraft, Language } from "../src/llm/types";

const PASSWORD = "demo1234";
const BCRYPT_ROUNDS = 10;

const SEED_EMAILS = [
  "demo@proposa.app",
  "admin@proposa.app",
  "second@proposa.app",
];

// FX fixtures (vs USD) so seed never needs the live FX API.
const FX_RATES: Record<string, number> = {
  USD: 1.0,
  BRL: 5.42,
  ARS: 980.0,
};

// --- Catalog (USD base prices, integer cents) ---

interface SeedCatalogItem {
  category: string;
  name: string;
  description: string;
  unit: string;
  unitPriceCents: number;
  tags: string[];
  defaultQty: number;
}

const CATALOG: SeedCatalogItem[] = [
  // Web Development
  { category: "Web Development", name: "Landing Page", description: "A single high-conversion landing page, responsive and fast.", unit: "page", unitPriceCents: 90000, tags: ["website", "landing", "frontend"], defaultQty: 1 },
  { category: "Web Development", name: "Marketing Website (up to 8 pages)", description: "A polished multi-page marketing website with CMS.", unit: "project", unitPriceCents: 480000, tags: ["website", "cms", "frontend"], defaultQty: 1 },
  { category: "Web Development", name: "E-commerce Storefront", description: "Online store with cart, checkout, and payment integration.", unit: "project", unitPriceCents: 950000, tags: ["ecommerce", "store", "payments"], defaultQty: 1 },
  { category: "Web Development", name: "Web App MVP", description: "A minimum viable web application with auth and core flows.", unit: "project", unitPriceCents: 1800000, tags: ["app", "mvp", "saas"], defaultQty: 1 },
  { category: "Web Development", name: "CMS Integration", description: "Connect a headless CMS so content is editable by the team.", unit: "project", unitPriceCents: 180000, tags: ["cms", "content", "headless"], defaultQty: 1 },
  { category: "Web Development", name: "API Development", description: "Custom REST API endpoint design and implementation.", unit: "endpoint", unitPriceCents: 60000, tags: ["api", "backend", "integration"], defaultQty: 5 },
  { category: "Web Development", name: "Third-party Integration", description: "Integrate an external service (CRM, payments, analytics).", unit: "integration", unitPriceCents: 120000, tags: ["integration", "api", "automation"], defaultQty: 1 },
  { category: "Web Development", name: "Performance Optimization", description: "Audit and tune load times, Core Web Vitals, and caching.", unit: "project", unitPriceCents: 150000, tags: ["performance", "optimization", "seo"], defaultQty: 1 },
  { category: "Web Development", name: "Accessibility Audit", description: "WCAG 2.1 AA accessibility review with a remediation plan.", unit: "project", unitPriceCents: 130000, tags: ["accessibility", "wcag", "audit"], defaultQty: 1 },

  // Design
  { category: "Design", name: "Brand Identity Package", description: "Logo, color palette, typography, and usage guidelines.", unit: "project", unitPriceCents: 350000, tags: ["branding", "logo", "identity"], defaultQty: 1 },
  { category: "Design", name: "Logo Design", description: "A distinctive logo with primary and secondary marks.", unit: "project", unitPriceCents: 120000, tags: ["logo", "branding", "design"], defaultQty: 1 },
  { category: "Design", name: "Landing Page Design", description: "High-fidelity design for a conversion-focused landing page.", unit: "page", unitPriceCents: 110000, tags: ["design", "landing", "ui"], defaultQty: 1 },
  { category: "Design", name: "UI/UX Design (per screen)", description: "Wireframes and high-fidelity UI for a single screen.", unit: "screen", unitPriceCents: 45000, tags: ["ui", "ux", "design"], defaultQty: 6 },
  { category: "Design", name: "Design System", description: "A reusable component library and design tokens.", unit: "project", unitPriceCents: 600000, tags: ["design system", "components", "tokens"], defaultQty: 1 },
  { category: "Design", name: "Social Media Templates", description: "A set of on-brand templates for social posts.", unit: "set", unitPriceCents: 80000, tags: ["social", "templates", "design"], defaultQty: 1 },
  { category: "Design", name: "Pitch Deck Design", description: "A persuasive, well-structured investor or sales deck.", unit: "deck", unitPriceCents: 200000, tags: ["deck", "presentation", "design"], defaultQty: 1 },
  { category: "Design", name: "Illustration Set", description: "Custom illustrations in a cohesive style.", unit: "illustration", unitPriceCents: 35000, tags: ["illustration", "art", "design"], defaultQty: 4 },

  // Marketing
  { category: "Marketing", name: "SEO Setup", description: "Technical SEO, on-page optimization, and sitemap.", unit: "project", unitPriceCents: 90000, tags: ["seo", "search", "marketing"], defaultQty: 1 },
  { category: "Marketing", name: "SEO Monthly Retainer", description: "Ongoing SEO work: content, links, and monitoring.", unit: "month", unitPriceCents: 120000, tags: ["seo", "retainer", "marketing"], defaultQty: 3 },
  { category: "Marketing", name: "Google Ads Campaign", description: "Setup and management of a paid search campaign.", unit: "month", unitPriceCents: 100000, tags: ["ads", "ppc", "google"], defaultQty: 3 },
  { category: "Marketing", name: "Social Media Management", description: "Content calendar, posting, and community engagement.", unit: "month", unitPriceCents: 140000, tags: ["social", "smm", "marketing"], defaultQty: 3 },
  { category: "Marketing", name: "Email Marketing Setup", description: "Email platform setup, templates, and first automation.", unit: "project", unitPriceCents: 95000, tags: ["email", "automation", "marketing"], defaultQty: 1 },
  { category: "Marketing", name: "Marketing Strategy Workshop", description: "A facilitated session to define goals and channels.", unit: "session", unitPriceCents: 160000, tags: ["strategy", "workshop", "marketing"], defaultQty: 1 },
  { category: "Marketing", name: "Analytics & Reporting Setup", description: "Install analytics, define KPIs, and build a dashboard.", unit: "project", unitPriceCents: 110000, tags: ["analytics", "reporting", "data"], defaultQty: 1 },
  { category: "Marketing", name: "Conversion Rate Optimization", description: "Experiment design and A/B testing to lift conversions.", unit: "month", unitPriceCents: 130000, tags: ["cro", "testing", "marketing"], defaultQty: 2 },

  // Content
  { category: "Content", name: "Blog Article", description: "A researched, SEO-friendly blog article (~1000 words).", unit: "article", unitPriceCents: 25000, tags: ["content", "blog", "writing"], defaultQty: 4 },
  { category: "Content", name: "Website Copywriting", description: "Persuasive copy for a page of your website.", unit: "page", unitPriceCents: 30000, tags: ["copywriting", "content", "writing"], defaultQty: 5 },
  { category: "Content", name: "Product Descriptions", description: "Compelling descriptions for catalog or store items.", unit: "item", unitPriceCents: 4000, tags: ["copywriting", "ecommerce", "content"], defaultQty: 20 },
  { category: "Content", name: "Case Study", description: "An in-depth case study with metrics and quotes.", unit: "case study", unitPriceCents: 60000, tags: ["content", "case study", "writing"], defaultQty: 1 },
  { category: "Content", name: "Video Script", description: "A script for an explainer or promo video.", unit: "script", unitPriceCents: 35000, tags: ["video", "script", "content"], defaultQty: 1 },
  { category: "Content", name: "Whitepaper", description: "A long-form, authoritative whitepaper with design.", unit: "whitepaper", unitPriceCents: 180000, tags: ["content", "whitepaper", "writing"], defaultQty: 1 },
  { category: "Content", name: "Newsletter (per issue)", description: "A curated, on-brand email newsletter issue.", unit: "issue", unitPriceCents: 18000, tags: ["newsletter", "email", "content"], defaultQty: 3 },
  { category: "Content", name: "Content Strategy Plan", description: "A documented content plan with topics and calendar.", unit: "project", unitPriceCents: 120000, tags: ["content", "strategy", "planning"], defaultQty: 1 },

  // Support / Hosting
  { category: "Support & Hosting", name: "Managed Hosting", description: "Reliable hosting with backups and monitoring.", unit: "month", unitPriceCents: 9000, tags: ["hosting", "infrastructure", "support"], defaultQty: 12 },
  { category: "Support & Hosting", name: "Maintenance Plan", description: "Updates, patches, and minor fixes each month.", unit: "month", unitPriceCents: 45000, tags: ["maintenance", "support", "updates"], defaultQty: 6 },
  { category: "Support & Hosting", name: "Priority Support", description: "Fast-response support with a guaranteed SLA.", unit: "month", unitPriceCents: 70000, tags: ["support", "sla", "priority"], defaultQty: 6 },
  { category: "Support & Hosting", name: "Security Hardening", description: "Harden the site against common threats and audit access.", unit: "project", unitPriceCents: 140000, tags: ["security", "hardening", "audit"], defaultQty: 1 },
  { category: "Support & Hosting", name: "Backup & Recovery Setup", description: "Automated backups and a tested recovery procedure.", unit: "project", unitPriceCents: 60000, tags: ["backup", "recovery", "infrastructure"], defaultQty: 1 },
  { category: "Support & Hosting", name: "Domain & SSL Setup", description: "Configure domain, DNS, and SSL certificates.", unit: "project", unitPriceCents: 15000, tags: ["domain", "ssl", "dns"], defaultQty: 1 },
  { category: "Support & Hosting", name: "Staff Training Session", description: "A hands-on session to train your team on the new tools.", unit: "session", unitPriceCents: 50000, tags: ["training", "support", "onboarding"], defaultQty: 1 },
];

// --- Helpers for building deterministic QuoteData ---

function fxRate(currency: string): number {
  return FX_RATES[currency] ?? 1.0;
}

/** Convert a base-USD cents price into the target currency cents at fixture rate. */
function convert(baseCents: number, currency: string): number {
  return Math.round(baseCents * fxRate(currency));
}

interface ChosenItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  baseUnitPriceCents: number;
  quantity: number;
  description: string;
}

/**
 * Build a MatchResult fixture (the "before" proof) from chosen catalog rows,
 * with FX-converted prices — exactly the shape Python would have returned.
 */
function buildMatched(
  chosen: ChosenItem[],
  currency: string,
  constraints: { budgetCents: number | null; timelineText: string | null; keywords: string[] }
): MatchResult {
  const rate = fxRate(currency);
  const rankedItems: RankedItem[] = chosen.map((c, i) => ({
    catalogItemId: c.id,
    name: c.name,
    category: c.category,
    unit: c.unit,
    unitPriceCents: convert(c.baseUnitPriceCents, currency),
    score: Number((0.9 - i * 0.07).toFixed(2)),
    suggestedQty: c.quantity,
  }));
  return {
    constraints: {
      budgetCents: constraints.budgetCents,
      timelineText: constraints.timelineText,
      keywords: constraints.keywords,
    },
    rankedItems,
    fx: { base: "USD", target: currency, rate, asOf: "2026-06-22" },
  };
}

/** Build an LLM-style draft directly from chosen items (deterministic). */
function buildDraft(
  chosen: ChosenItem[],
  currency: string,
  copy: {
    summary: string;
    coverNote: string;
    timeline: { phase: string; duration: string }[];
    assumptions: string[];
    terms: string[];
  }
): LLMQuoteDraft {
  return {
    summary: copy.summary,
    coverNote: copy.coverNote,
    lineItems: chosen.map((c) => ({
      name: c.name,
      description: c.description,
      quantity: c.quantity,
      unit: c.unit,
      unitPriceCents: convert(c.baseUnitPriceCents, currency),
      catalogItemId: c.id,
    })),
    timeline: copy.timeline,
    assumptions: copy.assumptions,
    terms: copy.terms,
  };
}

/** Look up a seeded catalog item by name from the created rows. */
function makeChooser(byName: Map<string, { id: string; category: string; unit: string; unitPriceCents: number; description: string }>) {
  return (name: string, quantity: number): ChosenItem => {
    const row = byName.get(name);
    if (!row) throw new Error(`seed: catalog item not found: ${name}`);
    return {
      id: row.id,
      name,
      category: row.category,
      unit: row.unit,
      baseUnitPriceCents: row.unitPriceCents,
      quantity,
      description: row.description,
    };
  };
}

interface SeedQuoteSpec {
  title: string;
  requestText: string;
  language: Language;
  currency: string;
  status: "DRAFT" | "FINAL";
  chosen: ChosenItem[];
  constraints: { budgetCents: number | null; timelineText: string | null; keywords: string[] };
  copy: Parameters<typeof buildDraft>[2];
  messages?: { role: "user" | "assistant"; content: string }[];
  daysAgo: number;
}

async function main(): Promise<void> {
  console.log("Seeding Proposa...");

  // 1) Idempotent wipe: delete seed users (cascades quotes + messages) + catalog.
  await prisma.user.deleteMany({ where: { email: { in: SEED_EMAILS } } });
  await prisma.catalogItem.deleteMany({});
  console.log("  cleared seed users + catalog");

  // 2) Users.
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const demoUser = await prisma.user.create({
    data: { email: "demo@proposa.app", name: "Demo User", passwordHash, role: "USER", locale: "en" },
  });
  await prisma.user.create({
    data: { email: "admin@proposa.app", name: "Admin User", passwordHash, role: "ADMIN", locale: "en" },
  });
  const secondUser = await prisma.user.create({
    data: { email: "second@proposa.app", name: "Sofia Marin", passwordHash, role: "USER", locale: "es" },
  });
  console.log("  created users: demo@ / admin@ / second@proposa.app (pwd demo1234)");

  // 3) Catalog.
  await prisma.catalogItem.createMany({ data: CATALOG });
  const catalogRows = await prisma.catalogItem.findMany({
    select: { id: true, name: true, category: true, unit: true, unitPriceCents: true, description: true },
  });
  const byName = new Map(catalogRows.map((r) => [r.name, r]));
  const pick = makeChooser(byName);
  console.log(`  created ${catalogRows.length} catalog items`);

  // 4) Demo user quotes (deterministic QuoteData, FX fixtures, no network).
  const specs: SeedQuoteSpec[] = [
    {
      title: "Marketing Website for a Coffee Roaster",
      requestText:
        "We're a boutique coffee roaster and need a modern marketing website with a few landing pages, basic SEO, and a blog. Budget around $5,000, timeline about 6 weeks.",
      language: "en",
      currency: "USD",
      status: "FINAL",
      daysAgo: 18,
      constraints: { budgetCents: 500000, timelineText: "6 weeks", keywords: ["website", "seo", "blog", "marketing"] },
      chosen: [
        pick("Marketing Website (up to 8 pages)", 1),
        pick("SEO Setup", 1),
        pick("Blog Article", 4),
        pick("Managed Hosting", 12),
      ],
      copy: {
        summary:
          "A modern marketing website for a boutique coffee roaster, including SEO setup and an initial set of blog articles.",
        coverNote:
          "Thank you for considering us for your new website. We have put together a focused scope that gives your coffee brand a polished online presence, helps customers find you through search, and gives you a content engine to keep your audience engaged.\n\nEverything below is itemized with clear pricing and a realistic six-week timeline. We would be delighted to adjust the scope to fit your priorities.",
        timeline: [
          { phase: "Discovery & content planning", duration: "1 week" },
          { phase: "Design", duration: "1.5 weeks" },
          { phase: "Build & SEO setup", duration: "2.5 weeks" },
          { phase: "Review, content & launch", duration: "1 week" },
        ],
        assumptions: [
          "Brand assets (logo, photography) are provided by the client.",
          "Content for up to 8 pages is supplied or lightly edited by us.",
          "Hosting is on our managed platform for the first year.",
        ],
        terms: [
          "50% deposit to begin, balance on launch.",
          "Quote valid for 30 days.",
          "Two rounds of revisions included per page.",
        ],
      },
    },
    {
      title: "Tienda Online para Marca de Moda",
      requestText:
        "Somos una marca de moda y queremos una tienda online con catálogo, carrito y pagos, además del diseño de marca. Presupuesto aproximado R$80.000, plazo 10 semanas.",
      language: "es",
      currency: "BRL",
      status: "DRAFT",
      daysAgo: 11,
      constraints: { budgetCents: 8000000, timelineText: "10 semanas", keywords: ["tienda", "ecommerce", "marca", "pagos"] },
      chosen: [
        pick("E-commerce Storefront", 1),
        pick("Brand Identity Package", 1),
        pick("Product Descriptions", 30),
        pick("Maintenance Plan", 6),
      ],
      copy: {
        summary:
          "Una tienda online completa para una marca de moda, con identidad de marca, descripciones de producto y mantenimiento.",
        coverNote:
          "Gracias por la oportunidad de acompañar el lanzamiento de su tienda online. Hemos diseñado un alcance que cubre tanto la plataforma de comercio electrónico como la identidad visual que hará destacar su marca.\n\nA continuación encontrará el detalle con precios claros y un cronograma de diez semanas. Será un placer ajustar cualquier elemento a sus prioridades.",
        timeline: [
          { phase: "Descubrimiento e identidad de marca", duration: "2 semanas" },
          { phase: "Diseño de la tienda", duration: "2 semanas" },
          { phase: "Desarrollo y pagos", duration: "4 semanas" },
          { phase: "Carga de catálogo y lanzamiento", duration: "2 semanas" },
        ],
        assumptions: [
          "Las fotografías de producto son proporcionadas por el cliente.",
          "Se integra una pasarela de pago compatible con la región.",
          "El catálogo inicial no supera los 100 productos.",
        ],
        terms: [
          "40% de anticipo, 30% a mitad del proyecto y 30% al lanzamiento.",
          "Presupuesto válido por 30 días.",
          "Dos rondas de revisiones por entregable.",
        ],
      },
    },
    {
      title: "Identidade Visual e Site para Estúdio de Yoga",
      requestText:
        "Estamos abrindo um estúdio de yoga e precisamos de identidade visual, um site simples e presença nas redes sociais. Orçamento em torno de R$30.000, prazo 8 semanas.",
      language: "pt",
      currency: "BRL",
      status: "FINAL",
      daysAgo: 7,
      constraints: { budgetCents: 3000000, timelineText: "8 semanas", keywords: ["identidade", "site", "redes sociais", "yoga"] },
      chosen: [
        pick("Brand Identity Package", 1),
        pick("Marketing Website (up to 8 pages)", 1),
        pick("Social Media Templates", 1),
        pick("Social Media Management", 3),
      ],
      copy: {
        summary:
          "Identidade visual, site institucional e gestão de redes sociais para o lançamento de um estúdio de yoga.",
        coverNote:
          "Obrigado pela oportunidade de ajudar no lançamento do seu estúdio. Preparamos um escopo que cria uma identidade serena e coerente, um site acolhedor e uma presença consistente nas redes sociais para atrair seus primeiros alunos.\n\nAbaixo está o detalhamento com preços claros e um cronograma de oito semanas. Teremos prazer em ajustar o que for necessário.",
        timeline: [
          { phase: "Descoberta e identidade visual", duration: "2 semanas" },
          { phase: "Design do site", duration: "1.5 semana" },
          { phase: "Desenvolvimento", duration: "2.5 semanas" },
          { phase: "Conteúdo, redes e lançamento", duration: "2 semanas" },
        ],
        assumptions: [
          "Fotos do espaço e das aulas são fornecidas pelo cliente.",
          "A gestão de redes cobre dois canais durante três meses.",
          "O site tem até 8 páginas com conteúdo fornecido.",
        ],
        terms: [
          "50% de entrada, saldo na entrega.",
          "Orçamento válido por 30 dias.",
          "Duas rodadas de revisões por entregável.",
        ],
      },
    },
    {
      title: "Landing y Marca para Lanzamiento de SaaS",
      requestText:
        "Estamos lanzando un SaaS B2B y necesitamos una landing para captar interesados, identidad de marca y analítica para medir el lanzamiento. Plazo 5 semanas.",
      language: "es",
      currency: "ARS",
      status: "DRAFT",
      daysAgo: 4,
      constraints: { budgetCents: null, timelineText: "5 semanas", keywords: ["saas", "landing", "marca", "analitica"] },
      chosen: [
        pick("Landing Page", 1),
        pick("Brand Identity Package", 1),
        pick("Analytics & Reporting Setup", 1),
      ],
      copy: {
        summary:
          "Una landing de captación, identidad de marca y analítica para el lanzamiento de un SaaS B2B.",
        coverNote:
          "Gracias por confiarnos el lanzamiento de su producto. Hemos definido un alcance ágil enfocado en llegar al mercado rápido: una landing optimizada para captar early adopters, una marca clara y la analítica necesaria para medir resultados.\n\nEl detalle se presenta a continuación con un cronograma de cinco semanas. Podemos ampliar el alcance hacia un MVP completo en una fase posterior.",
        timeline: [
          { phase: "Descubrimiento y marca", duration: "2 semanas" },
          { phase: "Diseño de la landing", duration: "1.5 semanas" },
          { phase: "Desarrollo, analítica y lanzamiento", duration: "1.5 semanas" },
        ],
        assumptions: [
          "El contenido de la landing es proporcionado por el cliente.",
          "La analítica usa proveedores estándar (GA4 u equivalente).",
          "Una fase posterior cubrirá el desarrollo del MVP.",
        ],
        terms: [
          "50% de anticipo, saldo al lanzamiento.",
          "Presupuesto válido por 30 días.",
          "Dos rondas de revisiones por entregable de diseño.",
        ],
      },
    },
    {
      title: "Quarterly Content & SEO Retainer",
      requestText:
        "We need an ongoing content and SEO retainer for our B2B blog: monthly articles, SEO work, and a newsletter. Roughly $4,000/quarter.",
      language: "en",
      currency: "USD",
      status: "DRAFT",
      daysAgo: 1,
      constraints: { budgetCents: 400000, timelineText: "3 months", keywords: ["content", "seo", "blog", "newsletter", "retainer"] },
      chosen: [
        pick("Blog Article", 6),
        pick("SEO Monthly Retainer", 3),
        pick("Newsletter (per issue)", 3),
        pick("Analytics & Reporting Setup", 1),
      ],
      copy: {
        summary:
          "A quarterly content and SEO retainer: monthly articles, ongoing SEO, a newsletter, and reporting.",
        coverNote:
          "Thank you for the opportunity to support your content marketing. This retainer keeps your blog fresh, steadily improves your search rankings, and keeps your audience engaged through a regular newsletter.\n\nThe scope below covers a full quarter with transparent pricing. We can scale the article volume up or down each month as needed.",
        timeline: [
          { phase: "Onboarding & content plan", duration: "1 week" },
          { phase: "Month 1 production", duration: "4 weeks" },
          { phase: "Month 2 production", duration: "4 weeks" },
          { phase: "Month 3 production & report", duration: "4 weeks" },
        ],
        assumptions: [
          "Topics are agreed at the start of each month.",
          "The client provides subject-matter review within 3 business days.",
          "SEO work targets the existing site without a redesign.",
        ],
        terms: [
          "Billed monthly in advance.",
          "30-day notice to pause or cancel.",
          "One revision round per article included.",
        ],
      },
      messages: [
        { role: "user", content: "Can you add a newsletter to this? We want to email our list monthly." },
        { role: "assistant", content: "Updated the proposal: added 1 line item; total increased to 4,140.00 USD." },
        { role: "user", content: "Great. Also bump the blog articles from 4 to 6 per quarter." },
        { role: "assistant", content: "Updated the proposal: total increased to 4,640.00 USD." },
      ],
    },
  ];

  let n = 0;
  for (const spec of specs) {
    const matched = buildMatched(spec.chosen, spec.currency, spec.constraints);
    const draft = buildDraft(spec.chosen, spec.currency, spec.copy);
    const data: QuoteData = assembleQuoteData({
      draft,
      matched,
      currency: spec.currency,
    });

    const createdAt = new Date(Date.now() - spec.daysAgo * 24 * 60 * 60 * 1000);

    await prisma.quote.create({
      data: {
        userId: demoUser.id,
        title: spec.title,
        requestText: spec.requestText,
        language: spec.language,
        currency: spec.currency,
        status: spec.status,
        data: data as unknown as Prisma.InputJsonValue,
        totalCents: BigInt(Math.round(data.totalCents)),
        model: "seed-deterministic",
        createdAt,
        updatedAt: createdAt,
        ...(spec.messages && spec.messages.length
          ? {
              messages: {
                create: spec.messages.map((m, i) => ({
                  role: m.role,
                  content: m.content,
                  createdAt: new Date(createdAt.getTime() + (i + 1) * 60_000),
                })),
              },
            }
          : {}),
      },
    });
    n += 1;
  }
  console.log(`  created ${n} quotes for the demo user (one with refine messages)`);

  // 5) A small quote for the second user so admin views show multiple owners.
  {
    const chosen = [pick("Logo Design", 1), pick("Pitch Deck Design", 1)];
    const constraints = { budgetCents: null, timelineText: "3 weeks", keywords: ["logo", "deck", "branding"] };
    const matched = buildMatched(chosen, "USD", constraints);
    const draft = buildDraft(chosen, "USD", {
      summary: "A logo and an investor pitch deck for an early-stage startup.",
      coverNote:
        "Thanks for reaching out! Here is a compact package to give your startup a memorable mark and a sharp pitch deck for your fundraising conversations.",
      timeline: [
        { phase: "Logo concepts", duration: "1 week" },
        { phase: "Deck design", duration: "2 weeks" },
      ],
      assumptions: ["Deck content/outline is provided by the founder."],
      terms: ["50% deposit to begin.", "Quote valid for 30 days."],
    });
    const data = assembleQuoteData({ draft, matched, currency: "USD" });
    const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.quote.create({
      data: {
        userId: secondUser.id,
        title: "Logo & Pitch Deck for a Startup",
        requestText:
          "We need a logo and an investor pitch deck for our seed round. Timeline ~3 weeks.",
        language: "en",
        currency: "USD",
        status: "FINAL",
        data: data as unknown as Prisma.InputJsonValue,
        totalCents: BigInt(Math.round(data.totalCents)),
        model: "seed-deterministic",
        createdAt,
        updatedAt: createdAt,
      },
    });
  }
  console.log("  created 1 quote for the second user");

  // 6) Summary.
  const [users, items, quotes, messages] = await Promise.all([
    prisma.user.count(),
    prisma.catalogItem.count(),
    prisma.quote.count(),
    prisma.quoteMessage.count(),
  ]);
  console.log(
    `\nDone. users=${users} catalogItems=${items} quotes=${quotes} quoteMessages=${messages}`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("SEED FAILED", err);
    await prisma.$disconnect();
    process.exit(1);
  });
