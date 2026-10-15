/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ApiError, ApiResponse } from "../services/httpService";
import { DEMO_LATENCY_MS } from "./config";
import { MockHttpError, resolveRoute } from "./handlers";
import "./mobileHandlers";
import { scheduleSaveDemoData } from "./persist";

export { DEMO_MODE, DEMO_ACCOUNTS } from "./config";
export { DEMO_DATA_EVENT, resetDemoData } from "./persist";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Strip scheme/host and the `/v1` prefix so "http://x/v1/admin/users?a=1" → "/admin/users". */
function splitEndpoint(endpoint: string): { path: string; query: Record<string, string> } {
  let path = endpoint;
  try {
    if (/^https?:\/\//.test(endpoint)) path = new URL(endpoint).pathname + new URL(endpoint).search;
  } catch {
    /* keep as-is */
  }
  const [rawPath, rawQuery] = path.split("?");
  const query: Record<string, string> = {};
  if (rawQuery) new URLSearchParams(rawQuery).forEach((v, k) => (query[k] = v));
  return { path: rawPath.replace(/^\/(api\/)?v1(?=\/)/, "") || "/", query };
}

/** Answer one API call from the in-memory demo data. Mirrors HttpService's response/error shapes. */
export async function mockRequest<T = any>(
  method: string,
  endpoint: string,
  options: { params?: Record<string, unknown>; body?: unknown } = {}
): Promise<ApiResponse<T>> {
  await delay(DEMO_LATENCY_MS);
  const { path, query } = splitEndpoint(endpoint);
  const route = resolveRoute(method.toUpperCase(), path);
  if (!route) {
    console.warn(`[demo] No mock for ${method} ${path} — returning empty response`);
    return { data: (method === "GET" ? [] : { message: "OK" }) as T, status: 200, statusText: "OK", headers: new Headers() };
  }
  // Clone so the UI can't mutate the store by accident, and the store can't leak references.
  const body = options.body == null ? options.body : JSON.parse(JSON.stringify(options.body));
  try {
    const data = route.handler({ params: route.params, query: { ...query, ...(options.params ?? {}) }, body });
    // GETs may also write (lazy seeding, auto-expiry); saves are batched and skipped when nothing changed.
    scheduleSaveDemoData();
    return {
      data: (data === undefined ? null : JSON.parse(JSON.stringify(data))) as T,
      status: data == null ? 204 : 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
    };
  } catch (err) {
    if (err instanceof MockHttpError) {
      throw { message: err.message, status: err.status, data: { message: err.message } } as ApiError;
    }
    throw err;
  }
}

/** Demo stand-in for the file microservice upload: keeps the file in the browser as an object URL. */
export async function mockUploadFile(file: File): Promise<unknown> {
  await delay(DEMO_LATENCY_MS);
  const accessUrl = URL.createObjectURL(file);
  return { path: accessUrl, accessUrl, url: accessUrl, originalName: file.name, size: file.size, mimeType: file.type };
}
