/**
 * Demo uploads are kept inside the shared demo data (localStorage) as data URLs, so the admin
 * panel in another tab can open them. Photos are scaled down to keep the store small.
 */

const MAX_IMAGE_SIDE = 1280;
const MAX_PDF_BYTES = 1.5 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image could not be opened"));
    img.src = src;
  });
}

export async function fileToDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error("PDF is too large for the demo (max 1.5 MB). Upload a photo of the document instead.");
    return { dataUrl: await readAsDataUrl(file), mimeType: file.type };
  }
  if (!file.type.startsWith("image/")) throw new Error("Upload a photo (JPG, PNG) or a PDF");

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { dataUrl: original, mimeType: file.type };
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.8), mimeType: "image/jpeg" };
}
