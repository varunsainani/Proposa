/**
 * Proposal PDF renderer (pure-JS, serverless-safe) using pdf-lib.
 *
 * renderQuotePdf(quote) -> Uint8Array. Produces a tidy editorial proposal:
 * letterhead/title, summary, a line-item table (name, qty, unit price, amount),
 * subtotal/discount/tax/total, timeline, assumptions, terms, and the cover note.
 * Multi-page aware: a new page is started whenever content runs past the margin.
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { QuoteData } from "./quote-assemble";

/** Minimal Quote shape this renderer needs (mirrors persisted Quote + data). */
export interface QuoteForPdf {
  id: string;
  title: string;
  language: string;
  currency: string;
  createdAt: Date | string;
  data: QuoteData;
}

const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const INK = rgb(0.13, 0.14, 0.17);
const MUTED = rgb(0.42, 0.44, 0.49);
const ACCENT = rgb(0.16, 0.2, 0.42); // deep indigo
const HAIRLINE = rgb(0.82, 0.82, 0.85);
const ZEBRA = rgb(0.96, 0.96, 0.97);

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function formatMoney(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  // Group thousands with commas; keep it locale-neutral + ASCII for core fonts.
  const [int, frac] = amount.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency} ${grouped}.${frac}`;
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Sanitize to WinAnsi-safe text (StandardFonts cannot encode arbitrary glyphs). */
function safe(text: string): string {
  return (text ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    // Drop anything outside the Latin-1 range pdf-lib's WinAnsi can encode.
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE.width, PAGE.height]);
  ctx.y = PAGE.height - MARGIN;
}

/** Ensure there is room for `needed` points; add a page if not. */
function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGIN) newPage(ctx);
}

/** Wrap text to a width, returning the lines. */
function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      // Hard-break very long single words.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        line = word;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Draw a paragraph (wrapped), advancing y. */
function paragraph(
  ctx: Ctx,
  text: string,
  opts: { size?: number; font?: PDFFont; color?: any; lineGap?: number } = {}
): void {
  const size = opts.size ?? 10;
  const font = opts.font ?? ctx.font;
  const color = opts.color ?? INK;
  const lineHeight = size * 1.45 + (opts.lineGap ?? 0);
  for (const line of wrap(text, font, size, CONTENT_WIDTH)) {
    ensure(ctx, lineHeight);
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.y - size,
      size,
      font,
      color,
    });
    ctx.y -= lineHeight;
  }
}

function sectionHeading(ctx: Ctx, label: string): void {
  ensure(ctx, 34);
  ctx.y -= 12;
  ctx.page.drawText(safe(label).toUpperCase(), {
    x: MARGIN,
    y: ctx.y - 11,
    size: 11,
    font: ctx.bold,
    color: ACCENT,
  });
  ctx.y -= 16;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: HAIRLINE,
  });
  ctx.y -= 10;
}

function bulletList(ctx: Ctx, items: string[]): void {
  const size = 10;
  const indent = 14;
  for (const item of items) {
    const lines = wrap(item, ctx.font, size, CONTENT_WIDTH - indent);
    lines.forEach((line, i) => {
      const lh = size * 1.4;
      ensure(ctx, lh);
      if (i === 0) {
        ctx.page.drawText("-", {
          x: MARGIN,
          y: ctx.y - size,
          size,
          font: ctx.bold,
          color: ACCENT,
        });
      }
      ctx.page.drawText(line, {
        x: MARGIN + indent,
        y: ctx.y - size,
        size,
        font: ctx.font,
        color: INK,
      });
      ctx.y -= lh;
    });
    ctx.y -= 2;
  }
}

/** Column layout for the line-item table. */
function lineItemTable(ctx: Ctx, data: QuoteData): void {
  const size = 9.5;
  const rowPadV = 6;
  // Columns: name(flex) | qty | unitPrice | amount
  const colQty = 60;
  const colUnit = 95;
  const colAmt = 95;
  const colName = CONTENT_WIDTH - colQty - colUnit - colAmt;
  const xName = MARGIN;
  const xQty = xName + colName;
  const xUnit = xQty + colQty;
  const xAmt = xUnit + colUnit;

  const drawHeader = (): void => {
    ensure(ctx, 22);
    const hy = ctx.y - size;
    ctx.page.drawText("Item", { x: xName, y: hy, size, font: ctx.bold, color: MUTED });
    drawRight(ctx, "Qty", xQty, colQty, hy, size, ctx.bold, MUTED);
    drawRight(ctx, "Unit", xUnit, colUnit, hy, size, ctx.bold, MUTED);
    drawRight(ctx, "Amount", xAmt, colAmt, hy, size, ctx.bold, MUTED);
    ctx.y -= 18;
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y },
      end: { x: PAGE.width - MARGIN, y: ctx.y },
      thickness: 0.75,
      color: HAIRLINE,
    });
    ctx.y -= 4;
  };

  drawHeader();

  let zebra = false;
  for (const li of data.lineItems) {
    const nameLines = wrap(li.name, ctx.bold, size, colName - 6);
    const descLines = li.description
      ? wrap(li.description, ctx.font, size - 1, colName - 6)
      : [];
    const rowTextHeight =
      nameLines.length * (size * 1.3) +
      descLines.length * ((size - 1) * 1.3);
    const rowHeight = rowTextHeight + rowPadV * 2;

    if (ctx.y - rowHeight < MARGIN) {
      newPage(ctx);
      drawHeader();
    }

    const rowTop = ctx.y;
    if (zebra) {
      ctx.page.drawRectangle({
        x: MARGIN - 4,
        y: rowTop - rowHeight,
        width: CONTENT_WIDTH + 8,
        height: rowHeight,
        color: ZEBRA,
      });
    }
    zebra = !zebra;

    let ty = rowTop - rowPadV - size;
    // Name (bold) + description (muted) in the name column.
    for (const ln of nameLines) {
      ctx.page.drawText(ln, { x: xName, y: ty, size, font: ctx.bold, color: INK });
      ty -= size * 1.3;
    }
    for (const ln of descLines) {
      ctx.page.drawText(ln, {
        x: xName,
        y: ty,
        size: size - 1,
        font: ctx.font,
        color: MUTED,
      });
      ty -= (size - 1) * 1.3;
    }

    // Right-aligned numeric columns, vertically centered on the first line.
    const numY = rowTop - rowPadV - size;
    drawRight(ctx, `${li.quantity} ${li.unit}`, xQty, colQty, numY, size, ctx.font, INK);
    drawRight(
      ctx,
      formatMoney(li.unitPriceCents, data.currency),
      xUnit,
      colUnit,
      numY,
      size,
      ctx.font,
      INK
    );
    drawRight(
      ctx,
      formatMoney(li.amountCents, data.currency),
      xAmt,
      colAmt,
      numY,
      size,
      ctx.bold,
      INK
    );

    ctx.y = rowTop - rowHeight;
  }

  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: HAIRLINE,
  });
  ctx.y -= 8;

  // Totals block, right-aligned.
  const totalsLabelX = xUnit;
  const totalsValX = xAmt;
  const totalRow = (label: string, value: string, bold = false): void => {
    ensure(ctx, 16);
    const ty = ctx.y - size;
    const f = bold ? ctx.bold : ctx.font;
    drawRight(ctx, label, totalsLabelX - 4, colUnit, ty, size, f, bold ? INK : MUTED);
    drawRight(ctx, value, totalsValX, colAmt, ty, size, f, INK);
    ctx.y -= 16;
  };

  totalRow("Subtotal", formatMoney(data.subtotalCents, data.currency));
  if (data.discountCents) {
    totalRow("Discount", `- ${formatMoney(data.discountCents, data.currency)}`);
  }
  if (data.taxCents) {
    totalRow("Tax", formatMoney(data.taxCents, data.currency));
  }
  ctx.y -= 2;
  ctx.page.drawLine({
    start: { x: totalsLabelX - 4, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 0.75,
    color: HAIRLINE,
  });
  ctx.y -= 8;
  totalRow("Total", formatMoney(data.totalCents, data.currency), true);
}

function drawRight(
  ctx: Ctx,
  text: string,
  colX: number,
  colWidth: number,
  y: number,
  size: number,
  font: PDFFont,
  color: any
): void {
  const t = safe(text);
  const w = font.widthOfTextAtSize(t, size);
  ctx.page.drawText(t, {
    x: colX + colWidth - w,
    y,
    size,
    font,
    color,
  });
}

export async function renderQuotePdf(quote: QuoteForPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(quote.title || "Proposal"));
  doc.setProducer("Proposa");
  doc.setCreator("Proposa");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE.width, PAGE.height]),
    y: PAGE.height - MARGIN,
    font,
    bold,
  };
  const data = quote.data;

  // Letterhead.
  ctx.page.drawText("PROPOSAL", {
    x: MARGIN,
    y: ctx.y - 12,
    size: 12,
    font: bold,
    color: ACCENT,
  });
  const dateStr = formatDate(quote.createdAt);
  if (dateStr) {
    const w = font.widthOfTextAtSize(dateStr, 10);
    ctx.page.drawText(dateStr, {
      x: PAGE.width - MARGIN - w,
      y: ctx.y - 11,
      size: 10,
      font,
      color: MUTED,
    });
  }
  ctx.y -= 26;

  // Title.
  for (const line of wrap(quote.title || "Proposal", bold, 22, CONTENT_WIDTH)) {
    ensure(ctx, 28);
    ctx.page.drawText(line, { x: MARGIN, y: ctx.y - 22, size: 22, font: bold, color: INK });
    ctx.y -= 28;
  }
  ctx.y -= 2;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE.width - MARGIN, y: ctx.y },
    thickness: 1.2,
    color: ACCENT,
  });
  ctx.y -= 6;

  // Summary.
  if (data.summary) {
    sectionHeading(ctx, "Summary");
    paragraph(ctx, data.summary, { size: 11 });
  }

  // Line items + totals.
  sectionHeading(ctx, "Scope & Pricing");
  lineItemTable(ctx, data);

  // Timeline.
  if (data.timeline.length) {
    sectionHeading(ctx, "Timeline");
    bulletList(
      ctx,
      data.timeline.map((p) => `${p.phase}: ${p.duration}`)
    );
  }

  // Assumptions.
  if (data.assumptions.length) {
    sectionHeading(ctx, "Assumptions");
    bulletList(ctx, data.assumptions);
  }

  // Terms.
  if (data.terms.length) {
    sectionHeading(ctx, "Terms");
    bulletList(ctx, data.terms);
  }

  // Cover note.
  if (data.coverNote) {
    sectionHeading(ctx, "Cover Note");
    for (const para of data.coverNote.split(/\n{2,}/)) {
      paragraph(ctx, para, { size: 10.5 });
      ctx.y -= 4;
    }
  }

  return doc.save();
}
