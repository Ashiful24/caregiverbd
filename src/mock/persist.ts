/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Keeps the demo database in localStorage so the admin panel and the mobile app views
 * (often open in different tabs) share one set of data, and changes survive a reload.
 *
 * Every exported array / Map of the store modules is saved after each write request and
 * reloaded in place on startup and whenever another tab saves.
 */
import * as db from "./db";
import * as mobileDb from "./mobileDb";

const STORAGE_KEY = "caregiverbd_demo_db_v1";

/** Fired on `window` after another tab changed the demo data (this tab is already reloaded). */
export const DEMO_DATA_EVENT = "demo-data-changed";

const STORES: Array<Record<string, unknown>> = [db, mobileDb];

function collections(): Array<[string, unknown[] | Map<unknown, unknown>]> {
  const out: Array<[string, unknown[] | Map<unknown, unknown>]> = [];
  STORES.forEach((store, i) => {
    for (const [name, value] of Object.entries(store)) {
      if (Array.isArray(value) || value instanceof Map) out.push([`${i}.${name}`, value]);
    }
  });
  return out;
}

function snapshot(): string {
  const data: Record<string, unknown> = {};
  for (const [key, value] of collections()) {
    data[key] = value instanceof Map ? { __map: [...value.entries()] } : value;
  }
  return JSON.stringify(data);
}

function hydrate(raw: string | null): boolean {
  if (!raw) return false;
  let data: Record<string, any>;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  for (const [key, value] of collections()) {
    const saved = data[key];
    if (saved == null) continue;
    if (value instanceof Map && Array.isArray(saved.__map)) {
      value.clear();
      for (const [k, v] of saved.__map) value.set(k, v);
    } else if (Array.isArray(value) && Array.isArray(saved)) {
      value.splice(0, value.length, ...saved);
    }
  }
  return true;
}

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Last string written to / read from storage, so unchanged data is never written again. */
let lastSaved: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveDemoData() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const next = snapshot();
  if (next === lastSaved) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
    lastSaved = next;
  } catch {
    /* storage full or blocked: data still lives in memory for this tab */
  }
}

/**
 * Save once after a burst of requests instead of after each one: a screen fires several
 * calls at once, and every save serialises the whole store (uploads make it megabytes).
 */
export function scheduleSaveDemoData() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveDemoData, 120);
}

/** Forget every change and go back to the generated seed data (reloads the page). */
export function resetDemoData() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

const initial = read();
if (hydrate(initial)) lastSaved = initial;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    if (e.newValue == null) {
      window.location.reload();
      return;
    }
    if (hydrate(e.newValue)) {
      lastSaved = e.newValue;
      window.dispatchEvent(new Event(DEMO_DATA_EVENT));
    }
  });
  // Don't lose a pending save when the tab is closed or hidden.
  window.addEventListener("pagehide", saveDemoData);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveDemoData();
  });
}
