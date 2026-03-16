/**
 * Document server base URL for building full document URLs.
 * The backend does not store or serve files; it only stores the document URL/path.
 * The document storage microservice is separate; set VITE_DOCUMENT_BASE_URL to that server (e.g. https://docs.example.com).
 * API returns relative path or full URL; if relative, this base is prepended.
 */
const DOCUMENT_BASE_URL = (import.meta.env.VITE_DOCUMENT_BASE_URL as string)?.trim() || "";

/**
 * Returns the full URL for a document or profile picture.
 * Use for any asset path returned by the API (documentUrl, profilePicture, etc.).
 *
 * - If accessUrl is empty, returns "".
 * - If accessUrl already starts with http:// or https://, returns it as-is.
 * - Otherwise prepends VITE_DOCUMENT_BASE_URL (no double slashes).
 *
 * @param accessUrl - Path or endpoint from API (e.g. "/uploads/doc.pdf" or "profile/123.jpg")
 * @returns Full URL string, or "" if accessUrl is falsy
 */
export function getAssetUrl(accessUrl: string | null | undefined): string {
  if (accessUrl == null || typeof accessUrl !== "string") return "";
  const trimmed = accessUrl.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (!DOCUMENT_BASE_URL) return trimmed;

  const base = DOCUMENT_BASE_URL.replace(/\/+$/, "");
  const path = trimmed.replace(/^\/+/, "");
  return path ? `${base}/${path}` : base;
}
