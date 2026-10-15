/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client for the patient / provider mobile views. Always answered by the demo store
 * (`src/mock/mobileHandlers.ts`), which mirrors the backend business flow doc.
 */
import { mockRequest } from "../mock";

export type Role = "PATIENT" | "PROVIDER";

export type MobileSession = {
  role: Role;
  profileId: number;
  accessToken: string;
  user: { id: number; firstName: string; lastName: string; email: string | null; username: string; role: Role };
  providerCategory: "DOCTOR" | "CAREGIVER" | null;
  providerType: string | null;
  employmentType: "SALARIED" | "INDEPENDENT" | null;
};

/** Same-tab signal that data changed, so every mounted screen reloads. */
export const MOBILE_REFRESH_EVENT = "mobile-data-refresh";

const sessionKey = (role: Role) => `cgbd_mobile_session_${role.toLowerCase()}`;

export function getSession(role: Role): MobileSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(role));
    return raw ? (JSON.parse(raw) as MobileSession) : null;
  } catch {
    return null;
  }
}

export function setSession(role: Role, session: MobileSession | null) {
  try {
    if (session) localStorage.setItem(sessionKey(role), JSON.stringify(session));
    else localStorage.removeItem(sessionKey(role));
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function call<T = any>(
  role: Role,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  params: Record<string, unknown> = {}
): Promise<T> {
  const s = getSession(role);
  try {
    const res = await mockRequest<T>(method, `/m${path}`, {
      body,
      params: { ...params, ...(s ? { __as: `${role}:${s.profileId}` } : {}) },
    });
    if (method !== "GET") window.dispatchEvent(new Event(MOBILE_REFRESH_EVENT));
    return res.data;
  } catch (e: any) {
    throw new ApiError(e?.message ?? "Something went wrong", e?.status ?? 500);
  }
}

/** Bound helpers for one role, e.g. `const api = client("PATIENT"); api.get("/patients/me")`. */
export function client(role: Role) {
  return {
    get: <T = any>(path: string, params?: Record<string, unknown>) => call<T>(role, "GET", path, undefined, params),
    post: <T = any>(path: string, body?: unknown) => call<T>(role, "POST", path, body),
    put: <T = any>(path: string, body?: unknown) => call<T>(role, "PUT", path, body),
    patch: <T = any>(path: string, body?: unknown) => call<T>(role, "PATCH", path, body),
    del: <T = any>(path: string, params?: Record<string, unknown>) => call<T>(role, "DELETE", path, undefined, params),
  };
}

export const patientApi = client("PATIENT");
export const providerApi = client("PROVIDER");
