import type { Locale } from "../lib/i18n";

declare global {
  namespace Express {
    interface Request {
      locale: Locale;
      user?: {
        id: string;
        role: "USER" | "ADMIN";
        email: string;
      };
    }
  }
}

export {};
