import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./lib/env";
import { locale } from "./middleware/locale";
import { errorHandler, notFoundHandler } from "./middleware/error";
import authRouter from "./routes/auth";
import catalogRouter from "./routes/catalog";
import quotesRouter from "./routes/quotes";
import adminRouter from "./routes/admin";

/**
 * Builds the Express app (SPEC §4 ordering).
 * cookieParser -> cors(credentials) -> locale -> express.json -> routers ->
 * /health -> 404 -> error handler.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(cookieParser());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Locale resolution must run BEFORE body parsing so malformed-JSON errors
  // can still be localized.
  app.use(locale);

  app.use(express.json({ limit: "1mb" }));

  app.use("/auth", authRouter);
  app.use("/catalog", catalogRouter);
  app.use("/quotes", quotesRouter);
  app.use("/admin", adminRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
