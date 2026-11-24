// CORS e risposte JSON comuni alle funzioni pubbliche del sito.

const DEFAULT_ORIGINS = ["http://localhost:5173", "https://daniele-morello.github.io"];

export function allowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ORIGINS;
  return configured.split(",").map((o) => o.trim()).filter(Boolean);
}

export function corsHeaders(request: Request, methods: string): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    Vary: "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

export function json(request: Request, methods: string, status: number, body: Record<string, unknown>) {
  const headers = corsHeaders(request, methods);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export const MAX_BODY_BYTES = 20_000;

// Legge il corpo JSON con un limite di dimensione. null se troppo grande o non valido.
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) return null;
  const text = await request.text().catch(() => null);
  if (text === null || text.length > MAX_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
