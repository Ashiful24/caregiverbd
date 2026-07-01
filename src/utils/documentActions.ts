/**
 * Admin document view / download / print helpers.
 * Files are served from the file microservice; backend stores path/URL only.
 */

import { getAssetUrl } from "./assetUrl";

/**
 * Build the full document URL from the path/URL returned by the API (`VITE_FILE_SERVICE_URL`).
 */
export function getDocumentUrl(documentPathOrUrl: string | null | undefined): string {
  return getAssetUrl(documentPathOrUrl ?? "");
}

/**
 * View document in a new tab (opens from document server).
 */
export function viewDocument(documentPathOrUrl: string | null | undefined): void {
  const url = getDocumentUrl(documentPathOrUrl);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Download document in a new tab (user can save from the browser).
 */
export function downloadDocument(
  documentPathOrUrl: string | null | undefined,
  _suggestedFilename?: string
): void {
  const url = getDocumentUrl(documentPathOrUrl);
  if (!url) return;
  // Same-origin relative /files/... — open in new tab (reliable for PDFs through nginx proxy).
  if (url.startsWith("/")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  if (_suggestedFilename) a.download = _suggestedFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Open document in a new tab so the user can print (Ctrl+P) for hard copy.
 */
export function printDocument(documentPathOrUrl: string | null | undefined): void {
  const url = getDocumentUrl(documentPathOrUrl);
  if (!url) return;
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (w) {
    w.addEventListener("load", () => {
      try {
        w.print();
      } catch {
        // Cross-origin or PDF viewer may not support print(); user can use Ctrl+P
      }
    });
  }
}
