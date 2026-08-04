/**
 * File microservice (`file_uploader`): multipart upload + serving stored files.
 *
 * Env:
 * - `VITE_FILE_SERVICE_URL` — file_uploader base URL (no trailing slash).
 *   Local `pnpm dev`: baked into the app.
 *   Docker: baked empty; container reads the same `.env` var at start for nginx `/files` proxy.
 * - `VITE_FILE_SERVICE_API_KEY` — `x-api-key` on POST /files/upload
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** True when the built app uses same-origin `/files/...` (Docker + nginx proxy). */
export function isFileServiceSameOrigin(): boolean {
  return getFileServiceBaseUrl() === "";
}

/** Public base URL for uploads and relative paths from the API (`/files/...`, profile pics, etc.). */
export function getFileServiceBaseUrl(): string {
  const raw = (import.meta.env.VITE_FILE_SERVICE_URL as string | undefined)?.trim();
  return raw ? stripTrailingSlash(raw) : "";
}

/** API key for POST /files/upload (401 if missing or wrong). */
export function getFileServiceApiKey(): string {
  return (
    (import.meta.env.VITE_FILE_SERVICE_API_KEY as string | undefined)?.trim() ||
    "hope-project-key-123"
  );
}

export function getFileServiceUploadUrl(): string {
  const base = getFileServiceBaseUrl();
  return base ? `${base}/files/upload` : "/files/upload";
}

function unwrapStoredPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as {
      accessUrl?: string;
      path?: string;
      url?: string;
    };
    if (parsed && typeof parsed === "object") {
      for (const key of ["accessUrl", "path", "url"] as const) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }
  } catch {
    /* plain path */
  }

  return trimmed;
}

/**
 * Turn a stored file path into a browser URL.
 * - Docker (empty VITE_FILE_SERVICE_URL): keep `/files/...` same-origin for nginx proxy.
 * - Local / absolute base set: prefix VITE_FILE_SERVICE_URL so images load off the Vite host.
 */
function normalizeFilesPath(trimmed: string): string {
  const withSlash = trimmed.startsWith("files/") ? `/${trimmed}` : trimmed;
  const base = getFileServiceBaseUrl();

  if (withSlash.startsWith("/files/")) {
    return base ? `${base}${withSlash}` : withSlash;
  }

  if (withSlash.startsWith("http://") || withSlash.startsWith("https://")) {
    try {
      const u = new URL(withSlash);
      if (u.pathname.startsWith("/files/") && isFileServiceSameOrigin()) {
        return u.pathname + u.search + u.hash;
      }
    } catch {
      return withSlash;
    }
    return withSlash;
  }

  const path = withSlash.startsWith("/") ? withSlash : `/${withSlash}`;
  return base ? `${base}${path}` : path;
}

/**
 * Turn an API-stored path or URL into a browser-ready URL.
 * Absolute http(s) URLs are returned unchanged unless same-origin `/files` rewrite applies.
 */
export function resolveFileServiceUrl(
  pathOrUrl: string | null | undefined
): string {
  if (pathOrUrl == null || typeof pathOrUrl !== "string") return "";

  const trimmed = unwrapStoredPath(pathOrUrl);
  if (!trimmed) return "";

  return normalizeFilesPath(trimmed);
}
