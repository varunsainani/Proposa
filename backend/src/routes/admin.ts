import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/async";
import { listAllQuotes, listUsers, overview } from "../controllers/admin";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/overview", asyncHandler(overview));
router.get("/users", asyncHandler(listUsers));
router.get("/quotes", asyncHandler(listAllQuotes));

export default router;
