import { env } from "cloudflare:workers";

const COOKIE_NAME = "sq_session";

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies
    .split(";")
    .map((cookie) => cookie.trim().split("="))
    .find(([key]) => key === name);
  return match ? decodeURIComponent(match.slice(1).join("=")) : null;
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function configuredPassword() {
  return env.SITE_PASSWORD?.trim() ?? "";
}

export async function createSessionToken() {
  const password = configuredPassword();
  const secret = env.SESSION_SECRET?.trim() ?? "";
  if (!password || !secret) throw new Error("Site authentication is not configured");
  return digest(`side-quest-ledger:v1:${password}:${secret}`);
}

export async function isAuthorized(request: Request) {
  const received = readCookie(request, COOKIE_NAME);
  if (!received) return false;
  return received === (await createSessionToken());
}

export function sessionCookie(token: string) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`;
}

export function clearedSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
