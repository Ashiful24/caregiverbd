/**
 * Get JWT expiry time in milliseconds (UTC).
 * Decodes the payload without verification (client-side only; used for session timeout).
 * Returns null if token is missing, invalid, or has no exp claim.
 */
export function getJwtExpiryMs(token: string | null): number | null {
  if (!token?.trim()) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp = payload.exp;
    if (typeof exp !== "number") return null;
    return exp * 1000;
  } catch {
    return null;
  }
}

/** Buffer in ms before expiry to trigger logout (e.g. 60 seconds). */
export const SESSION_EXPIRY_BUFFER_MS = 60 * 1000;

/** Refresh access token this many ms before it expires (e.g. 2 minutes). */
export const PROACTIVE_REFRESH_BUFFER_MS = 2 * 60 * 1000;
