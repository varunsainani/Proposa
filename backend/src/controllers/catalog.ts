import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * GET /catalog?category= -> active CatalogItem[] (requires auth).
 * Returns the public CatalogItem shape from frontend types.ts.
 */
export async function listCatalog(req: Request, res: Response): Promise<void> {
  const category =
    typeof req.query.category === "string" && req.query.category.trim()
      ? req.query.category.trim()
      : undefined;

  const items = await prisma.catalogItem.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const result = items.map((i) => ({
    id: i.id,
    category: i.category,
    name: i.name,
    description: i.description,
    unit: i.unit,
    unitPriceCents: i.unitPriceCents,
    currency: i.currency,
    tags: i.tags,
    defaultQty: i.defaultQty,
    active: i.active,
  }));

  res.json(result);
}
