import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/async";
import {
  deleteQuote,
  getQuote,
  listQuotes,
  patchQuote,
} from "../controllers/quotes";
// Built concurrently by another agent; imported here per SPEC.
import {
  generateQuote,
  refineQuote,
  quotePdf,
} from "../controllers/quotes-gen";

const router = Router();

// All quote routes require authentication.
router.use(requireAuth);

// Collection-level + generation. `/generate` MUST be registered before `/:id`
// so it is not captured by the param route.
router.get("/", asyncHandler(listQuotes));
router.post("/generate", asyncHandler(generateQuote));

// Item-level.
router.get("/:id", asyncHandler(getQuote));
router.patch("/:id", asyncHandler(patchQuote));
router.delete("/:id", asyncHandler(deleteQuote));
router.post("/:id/refine", asyncHandler(refineQuote));
router.get("/:id/pdf", asyncHandler(quotePdf));

export default router;
