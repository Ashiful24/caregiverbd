/**
 * File microservice (`file_uploader`): multipart upload + serving stored files.
 *
 * Env (hopeweb `.env`, baked at Vite build time for Docker):
 * - `VITE_FILE_SERVICE_URL` — base URL, no trailing slash (e.g. http://host:3085)
 * - `VITE_FILE_SERVICE_API_KEY` — sent as `x-api-key` on POST /files/upload
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
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
  let trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as { accessUrl?: string; path?: string };
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.accessUrl === "string" && parsed.accessUrl.trim()) {
        return parsed.accessUrl.trim();
      }
      if (typeof parsed.path === "string" && parsed.path.trim()) {
        return parsed.path.trim();
      }
    }
  } catch {
    /* plain path */
  }

  return trimmed;
}

/**
 * Turn an API-stored path or URL into a browser-ready URL.
 * Absolute http(s) URLs are returned unchanged; relative paths prepend `VITE_FILE_SERVICE_URL`.
 */
export function resolveFileServiceUrl(
  pathOrUrl: string | null | undefined
): string {
  if (pathOrUrl == null || typeof pathOrUrl !== "string") return "";

  const trimmed = unwrapStoredPath(pathOrUrl);
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const base = getFileServiceBaseUrl();
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return base ? `${base}${path}` : path;
}
