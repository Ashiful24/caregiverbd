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
 * - Paths under `/files/...` are served by the file upload microservice (`VITE_FILE_UPLOAD_URL`).
 * - Other relative paths prepend `VITE_DOCUMENT_BASE_URL` (no double slashes).
 *
 * @param accessUrl - Path or endpoint from API (e.g. "/uploads/doc.pdf" or "profile/123.jpg")
 * @returns Full URL string, or "" if accessUrl is falsy
 */
export function getAssetUrl(accessUrl: string | null | undefined): string {
  if (accessUrl == null || typeof accessUrl !== "string") return "";
  let trimmed = accessUrl.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as { accessUrl?: string; path?: string };
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.accessUrl === "string" && parsed.accessUrl.trim()) {
        trimmed = parsed.accessUrl.trim();
      } else if (typeof parsed.path === "string" && parsed.path.trim()) {
        trimmed = parsed.path.trim();
      }
    }
  } catch {
    /* plain path */
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/files/") || trimmed.startsWith("files/")) {
    const base = FILE_UPLOAD_PUBLIC_BASE;
    if (base) {
      const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      return `${base}${path}`;
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  if (!DOCUMENT_BASE_URL) return trimmed;

  const base = DOCUMENT_BASE_URL.replace(/\/+$/, "");
  const path = trimmed.replace(/^\/+/, "");
  return path ? `${base}/${path}` : base;
}

/** Same host as multipart upload (`VITE_FILE_UPLOAD_URL`); used for `/files/...` paths from the file service. */
const FILE_UPLOAD_PUBLIC_BASE =
  (import.meta.env.VITE_FILE_UPLOAD_URL as string | undefined)?.replace(/\/$/, "") || "";

/**
 * Builds a browser-usable URL for a consultation type `imageUrl` from the API.
 * Supports: absolute http(s) URL; relative path; or JSON string from file upload (`accessUrl`).
 */
export function resolveConsultationTypeImageUrl(stored: string | null | undefined): string {
  if (stored == null || typeof stored !== "string") return "";
  const raw = stored.trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

  let path = raw;
  try {
    const parsed = JSON.parse(raw) as { accessUrl?: string };
    if (parsed && typeof parsed.accessUrl === "string" && parsed.accessUrl.trim()) {
      path = parsed.accessUrl.trim();
    }
  } catch {
    /* treat as plain path or opaque string */
  }

  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const base = FILE_UPLOAD_PUBLIC_BASE;
  if (!base) return path.startsWith("/") ? path : `/${path}`;

  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
