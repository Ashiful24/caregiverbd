import { resolveFileServiceUrl } from "../config/fileService";

/**
 * Full URL for a document, profile picture, or other file path from the Hope API.
 * @see resolveFileServiceUrl — uses `VITE_FILE_SERVICE_URL`
 */
export function getAssetUrl(accessUrl: string | null | undefined): string {
  return resolveFileServiceUrl(accessUrl);
}

/**
 * Browser URL for consultation type `imageUrl` (plain path or JSON from file upload).
 */
export function resolveConsultationTypeImageUrl(
  stored: string | null | undefined
): string {
  return resolveFileServiceUrl(stored);
}
