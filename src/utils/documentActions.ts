/**
 * Admin document view / download / print helpers.
 * Files are served from the file microservice; backend stores path/URL only.
 * Demo-mode uploads are stored inline as `data:` URLs and are shown in a small viewer page instead.
 */

import { getAssetUrl } from "./assetUrl";

/**
 * Build the full document URL from the path/URL returned by the API (`VITE_FILE_SERVICE_URL`).
 */
export function getDocumentUrl(documentPathOrUrl: string | null | undefined): string {
  return getAssetUrl(documentPathOrUrl ?? "");
}

function dataUrlToBlobUrl(dataUrl: string): string {
  const [head, body] = dataUrl.split(",", 2);
  const mime = head.match(/^data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bytes = head.includes(";base64") ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body));
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/**
 * Browsers block opening `data:` URLs (and other tabs' blob URLs) as a page, so inline
 * uploads open in a blank tab we write ourselves: an <img> for photos, an <iframe> for PDFs.
 */
function openInlineDocument(dataUrl: string, print = false): void {
  const w = window.open("", "_blank");
  if (!w) return;
  const isImage = dataUrl.startsWith("data:image/");
  const src = isImage ? dataUrl : dataUrlToBlobUrl(dataUrl);
  const doc = w.document;
  doc.title = "Document";
  doc.body.style.cssText = "margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh";
  const el = doc.createElement(isImage ? "img" : "iframe");
  el.setAttribute("src", src);
  el.style.cssText = isImage ? "max-width:100%;max-height:100vh;object-fit:contain;background:#fff" : "border:0;width:100vw;height:100vh;background:#fff";
  if (print) el.addEventListener("load", () => w.print());
  doc.body.appendChild(el);
}

/**
 * View document in a new tab (opens from document server).
 */
export function viewDocument(documentPathOrUrl: string | null | undefined): void {
  const url = getDocumentUrl(documentPathOrUrl);
  if (!url) return;
  if (url.startsWith("data:")) return openInlineDocument(url);
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
  if (_suggestedFilename) {
    // Inline uploads carry their real type; fix the extension the caller guessed.
    const ext = url.match(/^data:image\/(\w+)/)?.[1];
    a.download = ext ? _suggestedFilename.replace(/\.\w+$/, `.${ext === "jpeg" ? "jpg" : ext}`) : _suggestedFilename;
  }
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
  if (url.startsWith("data:")) return openInlineDocument(url, true);
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
