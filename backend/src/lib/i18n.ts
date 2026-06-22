/**
 * Backend i18n catalog for error + validation messages.
 * Trilingual EN/ES/PT with FULL key parity (SPEC §8).
 *
 * i18n RULE: do NOT put a literal "." inside a key segment. Keys are flat single
 * words or nested objects. Lookups use dot-path traversal over the nested object.
 */

export type Locale = "en" | "es" | "pt";

export const LOCALES: Locale[] = ["en", "es", "pt"];

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "es" || v === "pt";
}

type Catalog = {
  [key: string]: string | Catalog;
};

const en: Catalog = {
  error: {
    validation: "The submitted data is invalid.",
    unauthorized: "You must be signed in to do that.",
    forbidden: "You do not have permission to do that.",
    notFound: "The requested resource was not found.",
    conflict: "That resource already exists.",
    rateLimited: "Too many requests. Please try again later.",
    llm: "The proposal generator is temporarily unavailable.",
    internal: "Something went wrong on our end.",
    invalidJson: "The request body is not valid JSON.",
  },
  auth: {
    invalidCredentials: "Incorrect email or password.",
    emailTaken: "An account with that email already exists.",
    invalidToken: "Your session is invalid. Please sign in again.",
    expiredToken: "Your session has expired. Please sign in again.",
    missingToken: "Authentication is required.",
    refreshInvalid: "Your session could not be refreshed. Please sign in again.",
    demoUnavailable: "The demo account is not available.",
    adminRequired: "Administrator access is required.",
  },
  quote: {
    notFound: "Quote not found.",
    dailyCapReached:
      "You have reached the daily limit of {cap} generated quotes. Please try again tomorrow.",
    generationFailed:
      "We could not generate your proposal. Please try again.",
  },
  catalog: {
    empty: "No catalog items were found.",
  },
  validation: {
    required: "{field} is required.",
    invalidEmail: "Please enter a valid email address.",
    passwordTooShort: "Password must be at least {min} characters.",
    stringTooShort: "{field} must be at least {min} characters.",
    stringTooLong: "{field} must be at most {max} characters.",
    invalidEnum: "{field} must be one of: {options}.",
    invalidLocale: "Locale must be one of: en, es, pt.",
    invalidCurrency: "Please provide a valid 3-letter currency code.",
    invalidLanguage: "Language must be one of: en, es, pt.",
    invalidStatus: "Status must be one of: DRAFT, FINAL.",
    invalidRole: "Role must be one of: user, admin.",
    invalidType: "{field} has an invalid value.",
    tooSmall: "{field} is too small.",
    tooBig: "{field} is too large.",
  },
  field: {
    email: "Email",
    password: "Password",
    name: "Name",
    title: "Title",
    requestText: "Request",
    message: "Message",
    language: "Language",
    currency: "Currency",
    status: "Status",
    role: "Role",
    locale: "Locale",
    category: "Category",
    limit: "Limit",
  },
};

const es: Catalog = {
  error: {
    validation: "Los datos enviados no son válidos.",
    unauthorized: "Debes iniciar sesión para hacer eso.",
    forbidden: "No tienes permiso para hacer eso.",
    notFound: "No se encontró el recurso solicitado.",
    conflict: "Ese recurso ya existe.",
    rateLimited: "Demasiadas solicitudes. Inténtalo de nuevo más tarde.",
    llm: "El generador de propuestas no está disponible temporalmente.",
    internal: "Algo salió mal de nuestro lado.",
    invalidJson: "El cuerpo de la solicitud no es un JSON válido.",
  },
  auth: {
    invalidCredentials: "Correo electrónico o contraseña incorrectos.",
    emailTaken: "Ya existe una cuenta con ese correo electrónico.",
    invalidToken: "Tu sesión no es válida. Vuelve a iniciar sesión.",
    expiredToken: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    missingToken: "Se requiere autenticación.",
    refreshInvalid:
      "No se pudo renovar tu sesión. Vuelve a iniciar sesión.",
    demoUnavailable: "La cuenta de demostración no está disponible.",
    adminRequired: "Se requiere acceso de administrador.",
  },
  quote: {
    notFound: "Presupuesto no encontrado.",
    dailyCapReached:
      "Has alcanzado el límite diario de {cap} presupuestos generados. Inténtalo de nuevo mañana.",
    generationFailed:
      "No pudimos generar tu propuesta. Inténtalo de nuevo.",
  },
  catalog: {
    empty: "No se encontraron elementos del catálogo.",
  },
  validation: {
    required: "{field} es obligatorio.",
    invalidEmail: "Introduce una dirección de correo electrónico válida.",
    passwordTooShort:
      "La contraseña debe tener al menos {min} caracteres.",
    stringTooShort: "{field} debe tener al menos {min} caracteres.",
    stringTooLong: "{field} debe tener como máximo {max} caracteres.",
    invalidEnum: "{field} debe ser uno de: {options}.",
    invalidLocale: "El idioma debe ser uno de: en, es, pt.",
    invalidCurrency:
      "Proporciona un código de moneda válido de 3 letras.",
    invalidLanguage: "El idioma debe ser uno de: en, es, pt.",
    invalidStatus: "El estado debe ser uno de: DRAFT, FINAL.",
    invalidRole: "El rol debe ser uno de: user, admin.",
    invalidType: "{field} tiene un valor no válido.",
    tooSmall: "{field} es demasiado pequeño.",
    tooBig: "{field} es demasiado grande.",
  },
  field: {
    email: "Correo electrónico",
    password: "Contraseña",
    name: "Nombre",
    title: "Título",
    requestText: "Solicitud",
    message: "Mensaje",
    language: "Idioma",
    currency: "Moneda",
    status: "Estado",
    role: "Rol",
    locale: "Idioma",
    category: "Categoría",
    limit: "Límite",
  },
};

const pt: Catalog = {
  error: {
    validation: "Os dados enviados são inválidos.",
    unauthorized: "Você precisa estar conectado para fazer isso.",
    forbidden: "Você não tem permissão para fazer isso.",
    notFound: "O recurso solicitado não foi encontrado.",
    conflict: "Esse recurso já existe.",
    rateLimited: "Muitas solicitações. Tente novamente mais tarde.",
    llm: "O gerador de propostas está temporariamente indisponível.",
    internal: "Algo deu errado do nosso lado.",
    invalidJson: "O corpo da solicitação não é um JSON válido.",
  },
  auth: {
    invalidCredentials: "E-mail ou senha incorretos.",
    emailTaken: "Já existe uma conta com esse e-mail.",
    invalidToken: "Sua sessão é inválida. Entre novamente.",
    expiredToken: "Sua sessão expirou. Entre novamente.",
    missingToken: "Autenticação é obrigatória.",
    refreshInvalid:
      "Não foi possível renovar sua sessão. Entre novamente.",
    demoUnavailable: "A conta de demonstração não está disponível.",
    adminRequired: "É necessário acesso de administrador.",
  },
  quote: {
    notFound: "Orçamento não encontrado.",
    dailyCapReached:
      "Você atingiu o limite diário de {cap} orçamentos gerados. Tente novamente amanhã.",
    generationFailed:
      "Não foi possível gerar sua proposta. Tente novamente.",
  },
  catalog: {
    empty: "Nenhum item do catálogo foi encontrado.",
  },
  validation: {
    required: "{field} é obrigatório.",
    invalidEmail: "Informe um endereço de e-mail válido.",
    passwordTooShort: "A senha deve ter pelo menos {min} caracteres.",
    stringTooShort: "{field} deve ter pelo menos {min} caracteres.",
    stringTooLong: "{field} deve ter no máximo {max} caracteres.",
    invalidEnum: "{field} deve ser um de: {options}.",
    invalidLocale: "O idioma deve ser um de: en, es, pt.",
    invalidCurrency: "Informe um código de moeda válido de 3 letras.",
    invalidLanguage: "O idioma deve ser um de: en, es, pt.",
    invalidStatus: "O status deve ser um de: DRAFT, FINAL.",
    invalidRole: "A função deve ser uma de: user, admin.",
    invalidType: "{field} tem um valor inválido.",
    tooSmall: "{field} é muito pequeno.",
    tooBig: "{field} é muito grande.",
  },
  field: {
    email: "E-mail",
    password: "Senha",
    name: "Nome",
    title: "Título",
    requestText: "Solicitação",
    message: "Mensagem",
    language: "Idioma",
    currency: "Moeda",
    status: "Status",
    role: "Função",
    locale: "Idioma",
    category: "Categoria",
    limit: "Limite",
  },
};

const catalogs: Record<Locale, Catalog> = { en, es, pt };

function lookup(cat: Catalog, key: string): string | undefined {
  const segments = key.split(".");
  let node: string | Catalog = cat;
  for (const seg of segments) {
    if (typeof node !== "object" || node === null) return undefined;
    const next: string | Catalog | undefined = (node as Catalog)[seg];
    if (next === undefined) return undefined;
    node = next;
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name];
    return v === undefined ? match : String(v);
  });
}

/**
 * Translate a dot-path key for the given locale, interpolating {vars}.
 * Falls back to English, then to the raw key if nothing matches.
 */
export function t(
  locale: Locale | string | undefined,
  key: string,
  vars?: Record<string, string | number>
): string {
  const loc: Locale = isLocale(locale) ? locale : "en";
  const template =
    lookup(catalogs[loc], key) ?? lookup(catalogs.en, key) ?? key;
  return interpolate(template, vars);
}
