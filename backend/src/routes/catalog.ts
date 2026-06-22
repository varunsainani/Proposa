import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/async";
import { listCatalog } from "../controllers/catalog";

const router = Router();

router.get("/", requireAuth, asyncHandler(listCatalog));

export default router;
