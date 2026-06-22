import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/async";
import {
  demo,
  login,
  logout,
  me,
  patchMe,
  refresh,
  register,
} from "../controllers/auth";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/demo", asyncHandler(demo));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));
router.patch("/me", requireAuth, asyncHandler(patchMe));

export default router;
