/** Small helpers shared by the demo data generator and route handlers. */

/** Deterministic PRNG so the demo data is the same on every reload. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date `n` days from today (negative = past) at the given hour/minute, local time. */
export function dayOffset(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Date(d.getTime() + n * DAY_MS);
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Parse `YYYY-MM-DD` (or ISO) as a local date; null if invalid. */
export function parseDay(s: unknown): Date | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Inclusive list of `YYYY-MM-DD` strings from start to end. */
export function eachDay(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last && out.length < 400) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Fixed two-decimal money string, as the backend returns. */
export function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function paginate<T>(rows: T[], page: unknown, limit: unknown, defaultLimit = 10) {
  const l = Math.max(1, num(limit, defaultLimit));
  const p = Math.max(1, num(page, 1));
  const start = (p - 1) * l;
  return {
    items: rows.slice(start, start + l),
    page: p,
    limit: l,
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / l)),
    hasMore: start + l < rows.length,
  };
}

/** Cursor pagination: the cursor is simply the next offset. */
export function cursorPage<T>(rows: T[], cursor: unknown, limit: unknown, defaultLimit = 10) {
  const l = Math.max(1, num(limit, defaultLimit));
  const offset = Math.max(0, num(cursor, 0));
  const items = rows.slice(offset, offset + l);
  const hasMore = offset + l < rows.length;
  return { items, limit: l, hasMore, nextCursor: hasMore ? String(offset + l) : null };
}

export function matchesSearch(search: unknown, ...fields: unknown[]): boolean {
  const q = typeof search === "string" ? search.trim().toLowerCase() : "";
  if (!q) return true;
  return fields.some((f) => f != null && String(f).toLowerCase().includes(q));
}

/** Unsigned JWT with a far-future `exp`, enough for the client-side expiry checks. */
export function fakeJwt(sub: number, role: string, days = 30): string {
  const b64 = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const exp = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub, role, exp })}.demo`;
}

export const FIRST_NAMES_M = [
  "Rahim", "Karim", "Tanvir", "Arif", "Imran", "Sakib", "Mahmud", "Nayeem", "Fahim", "Rafiq",
  "Hasan", "Jahid", "Shafiq", "Rezaul", "Mizanur", "Kamrul", "Sohel", "Rubel", "Masud", "Anwar",
];
export const FIRST_NAMES_F = [
  "Nusrat", "Farhana", "Sumaiya", "Tasnim", "Rumana", "Sharmin", "Nasrin", "Shirin", "Laila", "Ayesha",
  "Fatema", "Jannatul", "Sadia", "Mitu", "Rokeya", "Salma", "Taslima", "Moushumi", "Shapla", "Bithi",
];
export const LAST_NAMES = [
  "Rahman", "Hossain", "Islam", "Ahmed", "Chowdhury", "Khan", "Akter", "Begum", "Uddin", "Sarker",
  "Haque", "Mia", "Talukder", "Siddique", "Karim", "Alam", "Biswas", "Das", "Roy", "Mollah",
];
export const AREAS = [
  "Dhanmondi, Dhaka", "Gulshan 2, Dhaka", "Mirpur 10, Dhaka", "Uttara Sector 7, Dhaka", "Banani, Dhaka",
  "Mohammadpur, Dhaka", "Bashundhara R/A, Dhaka", "Motijheel, Dhaka", "Lalmatia, Dhaka", "Badda, Dhaka",
  "Khilgaon, Dhaka", "Old DOHS, Dhaka",
];
