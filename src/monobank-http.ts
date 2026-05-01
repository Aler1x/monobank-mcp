import { getMonobankTokenFromRequestContext } from "./request-context.js";

export const MONO_API_BASE = "https://api.monobank.ua";

function resolveMonobankToken(): string {
  const fromRequest = getMonobankTokenFromRequestContext()?.trim();
  if (fromRequest) return fromRequest;
  const fromEnv = process.env.MONOBANK_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  throw new Error(
    "[configuration] No Monobank API token: set Authorization Bearer or X-Monobank-Token on HTTP MCP requests, or MONOBANK_API_TOKEN for stdio."
  );
}

function formatHttpError(status: number, body: string): Error {
  const snippet = body.trim().slice(0, 500);

  if (status === 401 || status === 403) {
    return new Error(
      `[authentication] Monobank API rejected the request (HTTP ${status}). Check token (HTTP headers or MONOBANK_API_TOKEN) and permissions.${snippet ? ` Response: ${snippet}` : ""}`
    );
  }

  if (status === 429) {
    return new Error(
      `[upstream] Monobank API rate limited (HTTP 429).${snippet ? ` Response: ${snippet}` : ""}`
    );
  }

  return new Error(
    `[upstream] Monobank API returned HTTP ${status}.${snippet ? ` Response: ${snippet}` : ""}`
  );
}

export async function monobankPersonalJson<T>(path: string): Promise<T> {
  const token = resolveMonobankToken();

  const url = `${MONO_API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "X-Token": token },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[upstream] Network error while calling Monobank API: ${msg}`);
  }

  const bodyText = await response.text();

  if (!response.ok) {
    throw formatHttpError(response.status, bodyText);
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error("[upstream] Monobank API returned invalid JSON for a successful response.");
  }
}

export async function monobankPublicJson<T>(path: string): Promise<T> {
  const url = `${MONO_API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[upstream] Network error while calling Monobank API: ${msg}`);
  }

  const bodyText = await response.text();

  if (!response.ok) {
    throw formatHttpError(response.status, bodyText);
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error("[upstream] Monobank API returned invalid JSON for a successful response.");
  }
}
