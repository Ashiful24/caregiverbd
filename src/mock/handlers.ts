/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Demo route table: maps "METHOD /path/:param" to a handler returning the response body.
 * Shapes follow the DTOs in `src/services/api.ts`.
 */
import * as db from "./db";
import type { Row } from "./db";
import { ADMIN_USER } from "./db";
import { DEMO_ACCOUNTS } from "./config";
import {
  cursorPage,
  dayOffset,
  eachDay,
  fakeJwt,
  iso,
  matchesSearch,
  money,
  num,
  paginate,
  parseDay,
  ymd,
} from "./utils";

export type MockContext = {
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
};

export class MockHttpError {
  constructor(public status: number, public message: string) {}
}

type Handler = (ctx: MockContext) => unknown;

const routes: Array<{ method: string; pattern: RegExp; keys: string[]; handler: Handler }> = [];

function on(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$"
  );
  routes.push({ method, pattern, keys, handler });
}

export function resolveRoute(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.pattern);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    return { handler: r.handler, params };
  }
  return null;
}

const notFound = (what: string): never => {
  throw new MockHttpError(404, `${what} not found`);
};

const now = () => iso(new Date());

function currentUser(): Row {
  try {
    const raw = localStorage.getItem("auth_user") ?? sessionStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : ADMIN_USER;
  } catch {
    return ADMIN_USER;
  }
}

/** Supervisors only see their own team; admins see everything (or what they filter by). */
function scopedSupervisorId(query: Record<string, any>): number | null {
  const user = currentUser();
  if (String(user.role).toUpperCase() === "SUPERVISOR") return Number(user.id);
  const s = num(query.supervisorId, 0);
  return s > 0 ? s : null;
}

function inRange(dateLike: unknown, start: Date | null, end: Date | null): boolean {
  const d = parseDay(String(dateLike ?? ""));
  if (!d) return false;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

function rangeFromQuery(query: Record<string, any>, defaultDays = 30) {
  const end = parseDay(query.endDate) ?? dayOffset(0);
  const start = parseDay(query.startDate) ?? dayOffset(-defaultDays + 1);
  return { start, end };
}

function omit(row: Row, ...keys: string[]): Row {
  const out: Row = { ...row };
  for (const k of keys) delete out[k];
  return out;
}

function removeById(list: Row[], id: unknown) {
  const i = list.findIndex((x) => String(x.id) === String(id));
  if (i >= 0) list.splice(i, 1);
}

function byId(list: Row[], id: unknown, what: string): Row {
  return list.find((x) => String(x.id) === String(id)) ?? notFound(what);
}

function localized<T extends Row>(row: T, lang: unknown, fields: string[]): T {
  if (lang !== "bn") return row;
  const out: Row = { ...row };
  for (const f of fields) {
    const bn = row[`${f}Bn`];
    if (bn) out[f] = bn;
  }
  return out as T;
}

// =============================================================== auth

function loginResponse(user: Row) {
  return {
    accessToken: fakeJwt(user.id, user.role),
    refreshToken: fakeJwt(user.id, user.role, 60),
    user,
  };
}

on("POST", "/users/login", ({ body }) => {
  const identifier = String(body?.identifier ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const invalid = () => new MockHttpError(401, "Invalid email/phone or password");
  if (identifier === DEMO_ACCOUNTS.admin.identifier) {
    if (password !== DEMO_ACCOUNTS.admin.password) throw invalid();
    return loginResponse(ADMIN_USER);
  }
  // Every demo supervisor can sign in with their email or phone and the shared demo password.
  const s = db.supervisors.find((x) => x.email.toLowerCase() === identifier || x.username === identifier);
  if (!s || password !== DEMO_ACCOUNTS.supervisor.password) throw invalid();
  return loginResponse({
    id: s.id,
    email: s.email,
    username: s.username,
    firstName: s.firstName,
    lastName: s.lastName,
    role: "SUPERVISOR",
    isActive: true,
    createdAt: s.createdAt,
    updatedAt: s.createdAt,
  });
});
on("POST", "/users/logout", () => ({ message: "Logged out" }));
on("POST", "/auth/refresh", () => {
  const u = currentUser();
  return { accessToken: fakeJwt(u.id, u.role), refreshToken: fakeJwt(u.id, u.role, 60) };
});
on("PUT", "/users/profile/password", () => ({ message: "Password updated successfully" }));
on("POST", "/auth/otp/request", () => ({ message: "OTP sent (demo OTP: 123456)" }));
on("POST", "/auth/otp/verify", () => ({ verificationToken: "demo-verification-token" }));
on("POST", "/auth/register/provider", ({ body }) => ({ user: { id: 9999, ...body, role: "PROVIDER", isActive: true } }));
on("POST", "/auth/register/patient", ({ body }) => ({ user: { id: 9998, ...body, role: "PATIENT", isActive: true } }));
on("POST", "/auth/password-reset/request", () => ({ message: "OTP sent (demo OTP: 123456)" }));
on("POST", "/auth/password-reset/verify-otp", () => ({ verificationToken: "demo-reset-token" }));
on("POST", "/auth/password-reset/reset", () => ({ message: "Password has been reset" }));

on("POST", "/users/register", ({ body }) => {
  const id = Math.max(...db.supervisors.map((s) => s.id)) + 1;
  const sup: Row = {
    id,
    userId: id,
    firstName: body?.firstName ?? "New",
    lastName: body?.lastName ?? "Supervisor",
    email: body?.email ?? `supervisor${id}@hope.demo`,
    username: body?.username ?? `supervisor${id}`,
    phone: null,
    region: "Dhaka",
    teamSize: 0,
    status: "ACTIVE",
    isActive: true,
    joinedAt: ymd(new Date()),
    createdAt: now(),
  };
  db.supervisors.push(sup);
  return { ...sup, role: "SUPERVISOR", user: { ...sup, role: "SUPERVISOR" } };
});

// =============================================================== users

function allUsers(): Row[] {
  return [
    ADMIN_USER,
    ...db.supervisors.map((s) => ({
      id: s.id, email: s.email, username: s.username, firstName: s.firstName, lastName: s.lastName,
      role: "SUPERVISOR", isActive: s.isActive, createdAt: s.createdAt,
    })),
    ...db.providers.map((p) => ({
      id: p.userId, email: p.email, username: p.username, firstName: p.firstName, lastName: p.lastName,
      role: "PROVIDER", isActive: p.status !== "ARCHIVED", createdAt: p.createdAt, updatedAt: p.updatedAt,
      providerId: p.id, bmdcNumber: p.bmdcNumber, consultationTypeId: p.consultationTypeId,
      consultationTypeName: p.consultationTypeName, gender: p.gender,
    })),
    ...db.patients.map((p) => ({
      id: p.userId, email: p.email, username: p.username, firstName: p.firstName, lastName: p.lastName,
      role: "PATIENT", isActive: p.isActive, createdAt: p.createdAt, updatedAt: p.updatedAt, gender: p.gender,
    })),
  ];
}

function findUser(userId: unknown): Row {
  return allUsers().find((u) => String(u.id) === String(userId)) ?? notFound("User");
}

on("GET", "/admin/users", ({ query }) => {
  let rows = allUsers().filter((u) =>
    matchesSearch(query.search, u.firstName, u.lastName, u.email, u.username)
  );
  if (query.role) rows = rows.filter((u) => u.role === String(query.role).toUpperCase());
  if (query.status === "active") rows = rows.filter((u) => u.isActive);
  if (query.status === "inactive") rows = rows.filter((u) => !u.isActive);
  const pg = paginate(rows, query.page, query.limit);
  return { users: pg.items, total: pg.total, page: pg.page, limit: pg.limit };
});

function setUserActive(userId: unknown, isActive: boolean) {
  const p = db.providers.find((x) => x.userId === Number(userId));
  if (p) p.status = isActive ? "ACTIVE" : "ARCHIVED";
  const pt = db.patients.find((x) => x.userId === Number(userId));
  if (pt) pt.isActive = isActive;
  const s = db.supervisors.find((x) => x.id === Number(userId));
  if (s) s.isActive = isActive;
}

on("PATCH", "/admin/users/:userId/status", ({ params, body }) => {
  setUserActive(params.userId, Boolean(body?.isActive));
  return findUser(params.userId);
});
on("PATCH", "/admin/users/:userId/password", () => ({ message: "Password updated" }));
on("GET", "/admin/users/:userId/documents", ({ params }) => db.userDocuments.get(Number(params.userId)) ?? []);
on("GET", "/admin/users/:userId/verification-documents", ({ params, query }) => {
  const docs = db.userDocuments.get(Number(params.userId)) ?? [];
  const typeId = num(query.consultationTypeId);
  const requirements = db.verificationRequirements
    .filter((r) => r.consultationTypeId === typeId)
    .map((r) => ({ ...r, uploadedDocument: docs.find((d) => d.type === r.documentType) ?? null }));
  return {
    consultationTypeId: typeId || null,
    consultationTypeName: typeId ? db.consultationTypeName(typeId) : null,
    requirements,
    documents: docs,
  };
});
on("POST", "/admin/documents/:id/verify", ({ params, body }) => {
  for (const docs of db.userDocuments.values()) {
    const d = docs.find((x) => x.id === Number(params.id));
    if (d) {
      d.status = body?.status ?? d.status;
      d.adminComment = body?.adminComment ?? null;
      return d;
    }
  }
  return notFound("Document");
});

on("GET", "/users/:userId", ({ params }) => findUser(params.userId));
on("PUT", "/users/:userId", ({ params, body }) => {
  if (Number(params.userId) === ADMIN_USER.id) Object.assign(ADMIN_USER, body, { updatedAt: now() });
  const s = db.supervisors.find((x) => x.id === Number(params.userId));
  if (s) Object.assign(s, body);
  return { ...findUser(params.userId), ...body };
});
on("DELETE", "/users/:userId", ({ params }) => {
  removeById(db.supervisors, params.userId);
  return { message: "Deleted" };
});

// =============================================================== consultation types

function typeTree(rows: Row[], lang: unknown): Row[] {
  const loc = (t: Row) => localized(t, lang, ["name", "description"]);
  const build = (parentId: number | null): Row[] =>
    rows
      .filter((t) => (t.parentId ?? null) === parentId)
      .sort((a, b) => a.priority - b.priority)
      .map((t) => ({ ...loc(t), children: build(t.id) }));
  return build(null);
}

on("GET", "/consultation-types", ({ query }) => {
  const tree = typeTree(db.consultationTypes, query.lang);
  if (query.code) {
    const find = (nodes: Row[]): Row | null => {
      for (const n of nodes) {
        if (n.code === query.code) return n;
        const c = find(n.children);
        if (c) return c;
      }
      return null;
    };
    return find(tree) ?? notFound("Consultation type");
  }
  return tree;
});
on("POST", "/admin/consultation-types", ({ body }) => {
  const id = Math.max(...db.consultationTypes.map((t) => t.id)) + 1;
  const row = { id, priority: id, parentId: null, createdAt: now(), updatedAt: now(), ...body };
  db.consultationTypes.push(row);
  return row;
});
on("POST", "/admin/consultation-types/reorder", ({ body }) => {
  (body?.orderedIds ?? []).forEach((id: number, i: number) => {
    const t = db.consultationTypes.find((x) => x.id === id);
    if (t) t.priority = i;
  });
  return typeTree(db.consultationTypes, "en");
});
on("PATCH", "/admin/consultation-types/:id", ({ params, body }) => {
  const t = byId(db.consultationTypes, params.id, "Consultation type");
  Object.assign(t, body, { updatedAt: now() });
  return t;
});
on("DELETE", "/admin/consultation-types/:id", ({ params }) => {
  removeById(db.consultationTypes, params.id);
  return { message: "Deleted" };
});

on("GET", "/admin/consultation-types/:id/service-category-checklists", ({ params, query }) =>
  db.serviceChecklists
    .filter((c) => c.consultationTypeId === Number(params.id))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c) => localized(c, query.lang, ["name", "description"]))
);
on("POST", "/admin/consultation-types/:id/service-category-checklists", ({ params, body }) => {
  const row = {
    id: Math.max(0, ...db.serviceChecklists.map((c) => c.id)) + 1,
    consultationTypeId: Number(params.id),
    isActive: true,
    displayOrder: db.serviceChecklists.filter((c) => c.consultationTypeId === Number(params.id)).length + 1,
    type: "CHECKLIST",
    ...body,
  };
  db.serviceChecklists.push(row);
  return row;
});
on("PATCH", "/admin/service-category-checklists/:id", ({ params, body }) =>
  Object.assign(byId(db.serviceChecklists, params.id, "Checklist"), body)
);
on("DELETE", "/admin/service-category-checklists/:id", ({ params }) => {
  removeById(db.serviceChecklists, params.id);
  return { message: "Deleted" };
});

on("GET", "/admin/consultation-types/:id/verification-requirements", ({ params }) =>
  db.verificationRequirements.filter((r) => r.consultationTypeId === Number(params.id))
);
on("POST", "/admin/consultation-types/:id/verification-requirements", ({ params, body }) => {
  const row = {
    id: Math.max(0, ...db.verificationRequirements.map((r) => r.id)) + 1,
    consultationTypeId: Number(params.id),
    isRequired: true,
    displayOrder: 99,
    ...body,
  };
  db.verificationRequirements.push(row);
  return row;
});
on("PATCH", "/admin/consultation-types/:id/verification-requirements/:reqId", ({ params, body }) =>
  Object.assign(byId(db.verificationRequirements, params.reqId, "Requirement"), body)
);
on("DELETE", "/admin/consultation-types/:id/verification-requirements/:reqId", ({ params }) => {
  removeById(db.verificationRequirements, params.reqId);
  return { message: "Deleted" };
});

on("GET", "/admin/consultation-types/:id/certification-requirements", ({ params }) =>
  db.certificationRequirements.filter((r) => r.consultationTypeId === Number(params.id))
);
on("POST", "/admin/consultation-types/:id/certification-requirements", ({ params, body }) => {
  const row = {
    id: Math.max(0, ...db.certificationRequirements.map((r) => r.id)) + 1,
    consultationTypeId: Number(params.id),
    isRequired: true,
    ...body,
  };
  db.certificationRequirements.push(row);
  return row;
});
on("PATCH", "/admin/consultation-types/:id/certification-requirements/:reqId", ({ params, body }) =>
  Object.assign(byId(db.certificationRequirements, params.reqId, "Requirement"), body)
);
on("DELETE", "/admin/consultation-types/:id/certification-requirements/:reqId", ({ params }) => {
  removeById(db.certificationRequirements, params.reqId);
  return { message: "Deleted" };
});

on("GET", "/admin/consultation-types/:id/levels/:levelId/mapped-checklists", ({ params }) => {
  const key = `${params.id}:${params.levelId}`;
  const ids =
    db.levelChecklistMap.get(key) ??
    db.serviceChecklists.filter((c) => c.consultationTypeId === Number(params.id)).slice(0, 4).map((c) => c.id);
  return { checklistIds: ids };
});
function saveLevelMapping({ body }: MockContext) {
  db.levelChecklistMap.set(`${body?.consultationTypeId}:${body?.levelId}`, body?.checklistIds ?? []);
  return { id: 1, message: "Mapping saved" };
}
on("POST", "/admin/level-checklist-mappings", saveLevelMapping);
on("PATCH", "/admin/level-checklist-mappings", saveLevelMapping);

// =============================================================== settings

on("GET", "/admin/system-config", () => db.systemConfig);
on("PATCH", "/admin/system-config/:key", ({ params, body }) => {
  const row = db.systemConfig.find((c) => c.key === params.key) ?? notFound("Config");
  return Object.assign(row, body, { updatedAt: now() });
});
on("GET", "/admin/cancellation-policies", ({ query }) =>
  db.cancellationPolicies.filter(
    (p) =>
      (!query.serviceCategory || p.serviceCategory === query.serviceCategory) &&
      (!query.policyServiceType || p.policyServiceType === query.policyServiceType)
  )
);
on("PATCH", "/admin/cancellation-policies/:id", ({ params, body }) =>
  Object.assign(byId(db.cancellationPolicies, params.id, "Policy"), body, { updatedAt: now() })
);
on("GET", "/admin/scheduler/jobs", () => db.schedulerJobs);
on("PATCH", "/admin/scheduler/jobs/:id", ({ params, body }) =>
  Object.assign(byId(db.schedulerJobs, params.id, "Job"), body, { updatedAt: now() })
);

function simpleCrud(base: string, list: Row[], what: string, localizedFields: string[]) {
  on("GET", base, ({ query }) =>
    list
      .filter((r) => query.activeOnly !== "true" || r.isActive !== false)
      .map((r) => localized(r, query.lang, localizedFields))
  );
  on("GET", `${base}/:id`, ({ params, query }) => localized(byId(list, params.id, what), query.lang, localizedFields));
  on("POST", base, ({ body }) => {
    const row = { id: Math.max(0, ...list.map((r) => r.id)) + 1, isActive: true, createdAt: now(), updatedAt: now(), ...body };
    list.push(row);
    return row;
  });
  on("PATCH", `${base}/:id`, ({ params, body }) => {
    const row = byId(list, params.id, what);
    const patch: Row = { ...body };
    // consultation-type-levels sends snake_case on update
    for (const [snake, camel] of [["name_bn", "nameBn"], ["level_number", "levelNumber"], ["min_salary", "minSalary"], ["max_salary", "maxSalary"]]) {
      if (snake in patch) {
        patch[camel] = patch[snake];
        delete patch[snake];
      }
    }
    return Object.assign(row, patch, { updatedAt: now() });
  });
  on("PATCH", `${base}/:id/active`, ({ params, body }) =>
    Object.assign(byId(list, params.id, what), { isActive: Boolean(body?.isActive), updatedAt: now() })
  );
  on("DELETE", `${base}/:id`, ({ params }) => {
    removeById(list, params.id);
    return null;
  });
}

// Levels list is filtered by category; registered first so it wins over the generic list route.
on("GET", "/admin/consultation-type-levels", ({ query }) =>
  db.levels
    .filter((l) => !query.category || l.category === query.category)
    .sort((a, b) => a.levelNumber - b.levelNumber)
    .map((l) => localized(l, query.lang, ["name"]))
);
simpleCrud("/admin/service-checklist-groups", db.checklistGroups, "Checklist group", ["name", "description"]);
simpleCrud("/admin/verification-document-types", db.verificationDocTypes, "Document type", ["label"]);
simpleCrud("/admin/certification-types", db.certificationTypes, "Certification type", ["name", "description"]);
simpleCrud("/admin/consultation-type-levels", db.levels, "Level", ["name"]);

// =============================================================== providers

function providerRow(p: Row): Row {
  return { ...p, name: db.providerName(p) };
}

function filterProviders(query: Record<string, any>): Row[] {
  let rows = db.providers.filter((p) =>
    matchesSearch(query.search, p.firstName, p.lastName, p.email, p.username, p.bmdcNumber)
  );
  if (query.consultationTypeId) {
    const id = Number(query.consultationTypeId);
    rows = rows.filter((p) => p.consultationTypeId === id || db.consultationTypes.find((t) => t.id === p.consultationTypeId)?.parentId === id);
  }
  const status = String(query.status ?? "").toUpperCase();
  if (status === "AVAILABLE") rows = rows.filter((p) => p.status === "ACTIVE");
  else if (status === "DEACTIVATED") rows = rows.filter((p) => p.status === "ARCHIVED");
  else if (status) rows = rows.filter((p) => p.status === status);
  const sup = scopedSupervisorId(query);
  if (sup) rows = rows.filter((p) => p.supervisorId === sup);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

on("GET", "/admin/providers", ({ query }) => {
  const rows = filterProviders(query);
  const pg = paginate(rows, query.page, query.limit);
  const withWindow = String(query.status ?? "").toUpperCase() === "AVAILABLE";
  return {
    providers: pg.items.map((p) => ({
      ...providerRow(p),
      ...(withWindow ? { startDate: query.startDate ?? ymd(new Date()), endDate: query.endDate ?? ymd(dayOffset(7)) } : {}),
    })),
    total: pg.total,
    page: pg.page,
    limit: pg.limit,
  };
});

on("GET", "/providers/all", ({ query }) => {
  const code = String(query.consultationTypeCode ?? "");
  const root = db.consultationTypes.find((t) => t.code === code);
  let rows = db.providers.filter((p) => p.status === "ACTIVE");
  if (root) {
    rows = rows.filter((p) => {
      const t = db.consultationTypes.find((x) => x.id === p.consultationTypeId);
      return t?.id === root.id || t?.parentId === root.id || db.categoryOfType(p.consultationTypeId) === db.categoryOfType(root.id);
    });
  }
  rows = rows.filter((p) => matchesSearch(query.search, p.firstName, p.lastName, p.email));
  const pg = paginate(rows, query.page, query.limit);
  return { data: pg.items.map(providerRow), total: pg.total, page: pg.page, limit: pg.limit };
});

function srByStatus(list: Row[]) {
  const groups: Record<string, Row[]> = { PENDING: [], ACCEPTED: [], REJECTED: [], IN_PROGRESS: [], COMPLETED: [], CANCELLED: [] };
  for (const s of list) (groups[s.status] ??= []).push(s);
  return groups;
}

function groupByType(list: Row[], status?: unknown) {
  const filtered = status ? list.filter((s) => s.status === status) : list;
  const map = new Map<number, Row[]>();
  for (const s of filtered) {
    const arr = map.get(s.consultationTypeId) ?? [];
    arr.push({
      ...s,
      locationFrom: { latitude: s.latitude, longitude: s.longitude },
      locationTo: { latitude: s.latitude, longitude: s.longitude },
      distanceKm: Math.round((1 + (s.id % 9)) * 10) / 10,
    });
    map.set(s.consultationTypeId, arr);
  }
  return [...map.entries()].map(([consultationTypeId, requests]) => ({
    consultationTypeId,
    consultationTypeName: db.consultationTypeName(consultationTypeId),
    requests,
  }));
}

function providerOrThrow(id: unknown): Row {
  return db.findProvider(id) ?? notFound("Provider");
}

on("GET", "/admin/providers/:id/details", ({ params }) => {
  const p = providerOrThrow(params.id);
  const wallet = db.providerWallet(p.id);
  const checklist = ["Profile photo verified", "Documents verified", "Orientation completed", "Uniform issued", "Background check"];
  return {
    user: {
      id: p.userId, email: p.email, username: p.username, firstName: p.firstName, lastName: p.lastName,
      role: "PROVIDER", isActive: p.status !== "ARCHIVED", createdAt: p.createdAt, updatedAt: p.updatedAt,
      profilePicture: null, gender: p.gender,
    },
    provider: {
      id: p.id, userId: p.userId, bmdcNumber: p.bmdcNumber, experience: `${p.experience} years`, status: p.status,
      levelId: p.levelId, consultationTypeId: p.consultationTypeId, consultationTypeName: p.consultationTypeName,
      latitude: p.latitude, longitude: p.longitude, serviceRadiusKm: p.serviceRadiusKm,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    },
    profileCheacklists: checklist.map((label, i) => ({
      id: i + 1, key: label.toUpperCase().replace(/\W+/g, "_"), label, displayOrder: i + 1,
      checked: p.status === "ACTIVE" ? i < 4 : i < 1,
    })),
    consultationTypeServices: db.serviceChecklists
      .filter((c) => c.consultationTypeId === p.consultationTypeId)
      .map((c) => ({ id: c.id, label: c.name, displayOrder: c.displayOrder, offered: !(p.excludedServiceIds ?? []).includes(c.id) })),
    serviceRequestsByStatus: srByStatus(db.serviceRequests.filter((s) => s.providerId === p.id)),
    wallet: { id: p.id, balance: wallet.totalBalance, currency: "BDT", createdAt: p.createdAt },
    totalBalance: wallet.totalBalance,
    claimableBalance: wallet.claimableBalance,
    walletBalance: wallet.walletBalance,
    nonClaimableBalance: wallet.nonClaimableBalance,
    cashCommissionDue: wallet.cashCommissionDue,
    pendingWithdrawal: wallet.pendingWithdrawal,
    walletOverview: wallet.overview,
    walletHistory: wallet.history,
  };
});

on("GET", "/providers/:id/availability", ({ query }) => {
  const day = parseDay(query.date) ?? new Date();
  const seed = day.getDate();
  const slots = [
    { from: "08:00", to: "12:00" },
    { from: "14:00", to: "18:00" },
    { from: "20:00", to: "23:00" },
  ].filter((_, i) => (seed + i) % 4 !== 0);
  return { date: ymd(day), slots };
});

on("PATCH", "/admin/providers/:id/consultation-services", ({ params, body }) => {
  const p = providerOrThrow(params.id);
  p.excludedServiceIds = body?.excludedServiceIds ?? [];
  return db.serviceChecklists
    .filter((c) => c.consultationTypeId === p.consultationTypeId)
    .map((c) => ({ id: c.id, label: c.name, displayOrder: c.displayOrder, offered: !p.excludedServiceIds.includes(c.id) }));
});
on("PATCH", "/admin/providers/:id/cheaklist", ({ body }) =>
  (body?.checklistItemIds ?? []).map((id: number) => ({ id, key: String(id), label: `Item ${id}`, displayOrder: id, checked: true }))
);
on("GET", "/admin/providers/:id/service-requests", ({ params, query }) =>
  groupByType(db.serviceRequests.filter((s) => s.providerId === Number(params.id)), query.status)
);
on("PATCH", "/admin/providers/:id/verify", ({ params, body }) => {
  const p = providerOrThrow(params.id);
  p.status = body?.status === "DEACTIVATED" ? "ARCHIVED" : body?.status ?? p.status;
  if (body?.levelId) p.levelId = body.levelId;
  p.updatedAt = now();
  return p;
});
on("PATCH", "/admin/providers/:id/level", ({ params, body }) => {
  const p = providerOrThrow(params.id);
  p.levelId = body?.levelId ?? p.levelId;
  return p;
});
on("GET", "/admin/providers/:id/level", ({ params }) => ({ levelId: providerOrThrow(params.id).levelId }));

on("GET", "/certifications/provider/:id", ({ params }) => db.providerCertifications.get(Number(params.id)) ?? []);
on("PATCH", "/certifications/:id/verify", ({ params, body }) => {
  for (const certs of db.providerCertifications.values()) {
    const c = certs.find((x) => x.id === Number(params.id));
    if (c) {
      return Object.assign(c, {
        status: body?.status,
        adminComment: body?.adminComment ?? null,
        approvedAt: now(),
        approvedByName: `${ADMIN_USER.firstName} ${ADMIN_USER.lastName}`,
      });
    }
  }
  return notFound("Certification");
});
on("GET", "/certifications/provider/:id/scraping", ({ params }) => {
  const p = providerOrThrow(params.id);
  return {
    providerId: p.id,
    providerFullName: db.providerName(p),
    profilePicture: null,
    items: [
      {
        id: p.id,
        providerId: p.id,
        registrationNumber: p.bmdcNumber,
        programId: 1,
        programName: "Diploma in Nursing Science and Midwifery",
        name: `${p.firstName} ${p.lastName}`.toUpperCase(),
        nameMatched: 92,
        faceMatched: true,
        faceMatchedMeta: { score: 0.88, reason: null, matched: true, decision: "MATCH", threshold: 0.75, reviewThreshold: 0.6 },
        metadata: {
          found: true,
          regNumber: p.bmdcNumber,
          programName: "Diploma in Nursing Science and Midwifery",
          name: `${p.firstName} ${p.lastName}`.toUpperCase(),
          fatherName: "MD. ABDUL KARIM",
          motherName: "MST. SALEHA BEGUM",
          address: "Dhanmondi, Dhaka",
          workingPlace: "Dhaka Medical College Hospital",
          position: "Senior Staff Nurse",
          registrations: [
            {
              registrationNo: p.bmdcNumber,
              courseName: "Diploma in Nursing Science and Midwifery",
              institution: "Dhaka Nursing College",
              examPassingDate: "2016-12-20",
              dateOfRegistration: "2017-03-15",
              dateOfRenewOrIssue: "2024-03-15",
              renewUpto: "2029-03-14",
              status: "Active",
            },
          ],
        },
        createdAt: p.createdAt,
      },
    ],
  };
});

// salary / billing (single-rate and tiered APIs)
on("POST", "/admin/providers/:id/salary", ({ params, body }) => {
  const list = db.salaries.get(Number(params.id)) ?? [];
  list.forEach((s) => (s.validTo ??= now()));
  const row = { id: db.nextRateId(), providerId: Number(params.id), amount: money(num(body?.amount)), frequency: body?.frequency ?? "MONTHLY", validFrom: now(), validTo: null, createdAt: now() };
  list.unshift(row);
  db.salaries.set(Number(params.id), list);
  return row;
});
on("GET", "/admin/providers/:id/salary/history", ({ params }) => {
  const list = db.salaries.get(Number(params.id)) ?? [];
  return { currentSalary: list.find((s) => !s.validTo) ?? null, history: list };
});
on("POST", "/admin/providers/:id/billing-rate", ({ params, body }) => {
  const list = db.billingRates.get(Number(params.id)) ?? [];
  list.forEach((r) => (r.validTo ??= now()));
  const row = { id: db.nextRateId(), providerId: Number(params.id), amount: money(num(body?.amount)), type: body?.type, validFrom: now(), validTo: null, createdAt: now() };
  list.unshift(row);
  db.billingRates.set(Number(params.id), list);
  return row;
});
on("GET", "/admin/providers/:id/billing-rate/history", ({ params }) => {
  const list = db.billingRates.get(Number(params.id)) ?? [];
  return { currentRate: list.find((r) => !r.validTo) ?? null, history: list };
});
on("GET", "/admin/providers/:id/billing-rates", ({ params }) => ({
  rates: (db.billingRates.get(Number(params.id)) ?? []).filter((r) => !r.validTo),
}));
on("GET", "/admin/providers/:id/billing-rates/history", ({ params }) => ({
  history: (db.billingRates.get(Number(params.id)) ?? []).filter((r) => r.validTo),
}));
on("POST", "/admin/providers/:id/billing-rates", ({ params, body }) => {
  const list = db.billingRates.get(Number(params.id)) ?? [];
  const isConsult = body?.type === "CONSULTATION";
  list.forEach((r) => {
    if (!r.validTo && (r.type === body?.type || (r.type === "CONSULTATION") !== isConsult)) r.validTo = now();
  });
  const row = { id: db.nextRateId(), providerId: Number(params.id), amount: money(num(body?.amount)), type: body?.type, validFrom: now(), validTo: null, createdAt: now() };
  list.unshift(row);
  db.billingRates.set(Number(params.id), list);
  return row;
});
on("PUT", "/admin/providers/:id/billing-rates/:rateId", ({ params, body }) => {
  const row = (db.billingRates.get(Number(params.id)) ?? []).find((r) => r.id === Number(params.rateId)) ?? notFound("Rate");
  row.amount = money(num(body?.amount));
  return row;
});
on("DELETE", "/admin/providers/:id/billing-rates/:rateId", ({ params }) => {
  const row = (db.billingRates.get(Number(params.id)) ?? []).find((r) => r.id === Number(params.rateId));
  if (row) row.validTo = now();
  return null;
});

const fundingHistory = new Map<number, Row[]>();
on("POST", "/admin/providers/:id/wallet/manual-credit", ({ params, body }) => {
  const list = fundingHistory.get(Number(params.id)) ?? [];
  const transactionId = 99000 + list.length + Number(params.id) * 10;
  list.unshift({
    transactionId, purpose: "ADMIN_MANUAL_CREDIT", status: "COMPLETED", paymentMethod: "MANUAL",
    amount: money(num(body?.amount)), reason: body?.reason ?? null, reference: body?.reference ?? null,
    gatewayName: null, createdAt: now(), updatedAt: now(),
  });
  fundingHistory.set(Number(params.id), list);
  return { transactionId };
});
on("GET", "/admin/providers/:id/wallet/history", ({ params, query }) => {
  const id = Number(params.id);
  if (!fundingHistory.has(id)) {
    fundingHistory.set(id, [
      { transactionId: 98000 + id, purpose: "WALLET_RECHARGE", status: "COMPLETED", paymentMethod: "BKASH", amount: "2000.00", reason: null, reference: `BK${id}771`, gatewayName: "SSLCommerz", createdAt: iso(dayOffset(-20)), updatedAt: iso(dayOffset(-20)) },
    ]);
  }
  const pg = paginate(fundingHistory.get(id) ?? [], query.page, query.limit);
  return { data: pg.items, meta: { total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages } };
});

// provider self-service endpoints (not used by the admin panel, kept so nothing 404s)
on("POST", "/providers/search", ({ body }) => {
  const pg = paginate(db.providers.filter((p) => p.status === "ACTIVE"), body?.page, body?.limit);
  return {
    data: pg.items.map((p) => ({ ...p, providerName: db.providerName(p), isVerified: true, currentFee: num(p.rate), feeType: p.billingRateType === "CONSULTATION" ? "CONSULTATION" : "HOURLY", distance: 2.4 })),
    meta: { total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages },
  };
});
on("POST", "/providers/:id/search", ({ params }) => {
  const p = providerOrThrow(params.id);
  return { ...p, providerName: db.providerName(p), isVerified: true, currentFee: num(p.rate), availableSlots: [] };
});
for (const path of ["/providers/specialty", "/providers/location", "/providers/service-radius", "/providers/billing-rate"]) {
  on("PUT", path, () => ({ message: "Updated" }));
}
on("GET", "/providers/billing-rate/current", () => ({ id: 1, amount: 1000, type: "CONSULTATION", validFrom: iso(dayOffset(-30)) }));
on("GET", "/providers/billing-rate/history", () => ({ currentRate: { id: 1, amount: 1000, type: "CONSULTATION", validFrom: iso(dayOffset(-30)), validTo: null }, history: [] }));
on("PUT", "/providers/me/schedule", ({ body }) => body ?? []);
on("GET", "/providers/me/schedule", () => []);
on("DELETE", "/providers/me/schedule/slots", () => ({ message: "Deleted" }));

// =============================================================== patients

on("GET", "/admin/patients", ({ query }) => {
  const rows = db.patients
    .filter((p) => matchesSearch(query.search, p.firstName, p.lastName, p.email, p.username, p.nidNumber))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pg = paginate(rows, query.page, query.limit);
  return { patients: pg.items, total: pg.total, page: pg.page, limit: pg.limit };
});

function vitalsFor(seed: number): Row[] {
  return Array.from({ length: 6 }, (_, i) => ({
    id: seed * 100 + i,
    recordedAt: iso(dayOffset(-i * 3, 9)),
    bloodPressureSystolic: 118 + ((seed + i * 7) % 25),
    bloodPressureDiastolic: 76 + ((seed + i * 3) % 14),
    bloodSugar: Math.round((5.4 + ((seed + i) % 6) * 0.6) * 10) / 10,
    steps: 2000 + ((seed * 377 + i * 911) % 5000),
    waterIntake: 1.5 + ((seed + i) % 4) * 0.25,
    metadata: null,
  }));
}

function beneficiariesFor(p: Row): Row[] {
  if (p.id % 3 !== 0) return [];
  const other = db.patients[(p.id + 7) % db.patients.length];
  return [
    {
      id: p.id * 10 + 1,
      patientId: other.id,
      name: `${other.firstName} ${p.lastName}`,
      relation: p.id % 2 ? "Mother" : "Father",
      vitals: vitalsFor(other.id),
      serviceRequestsByStatus: srByStatus(db.serviceRequests.filter((s) => s.patientId === other.id)),
    },
  ];
}

on("GET", "/admin/patients/:id/details", ({ params }) => {
  const p = db.findPatient(params.id) ?? notFound("Patient");
  const paid = db.transactions.filter((t) => t.patientId === p.id && t.type === "CONSULTATION_PAYMENT");
  return {
    user: {
      id: p.userId, email: p.email ?? "", username: p.username, firstName: p.firstName, lastName: p.lastName,
      role: "PATIENT", isActive: p.isActive, createdAt: p.createdAt, profilePicture: null, gender: p.gender,
    },
    patient: { id: p.id, userId: p.userId, nidNumber: p.nidNumber, isFaceVerified: p.isFaceVerified, status: p.status, createdAt: p.createdAt },
    serviceRequestsByStatus: srByStatus(db.serviceRequests.filter((s) => s.patientId === p.id)),
    wallet: { id: p.id, balance: money(500 + (p.id % 5) * 250), currency: "BDT", createdAt: p.createdAt },
    totalBalance: money(500 + (p.id % 5) * 250),
    claimableBalance: "0.00",
    nonClaimableBalance: money(500 + (p.id % 5) * 250),
    cashCommissionDue: "0.00",
    pendingWithdrawal: "0.00",
    walletHistory: paid.slice(0, 10).map((t, i) => ({
      id: t.transactionId, transactionId: t.transactionId, amount: money(-t.totalFee),
      balanceAfter: money(500 + i * 120), description: `Payment — ${t.consultationTypeName}`, createdAt: t.date,
    })),
    beneficiaries: beneficiariesFor(p),
  };
});
on("PATCH", "/admin/patients/:id/status", ({ params, body }) => {
  const p = db.findPatient(params.id) ?? notFound("Patient");
  p.status = body?.status ?? p.status;
  p.isActive = !["DEACTIVATED", "ARCHIVED", "REJECTED"].includes(p.status);
  return p;
});
on("GET", "/admin/patients/:id/beneficiaries", ({ params }) => beneficiariesFor(db.findPatient(params.id) ?? notFound("Patient")));
on("GET", "/admin/patients/:id/service-requests", ({ params, query }) =>
  groupByType(db.serviceRequests.filter((s) => s.patientId === Number(params.id)), query.status)
);
on("POST", "/patients/me/liked-providers/:id", ({ params }) => ({ message: "Liked", providerId: Number(params.id) }));
on("DELETE", "/patients/me/liked-providers/:id", () => ({ message: "Removed" }));
on("GET", "/patients/me/liked-providers", () => ({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
on("POST", "/patient-vitals", ({ body }) => body);
on("GET", "/patient-vitals/:id", ({ params }) => vitalsFor(num(params.id, 1)));
on("GET", "/patient-vitals/:id/range", ({ params }) => vitalsFor(num(params.id, 1)));

// =============================================================== service requests

on("GET", "/admin/service-requests", ({ query }) => {
  let rows = db.serviceRequests;
  if (query.consultationTypeId) rows = rows.filter((s) => s.consultationTypeId === Number(query.consultationTypeId));
  rows = rows.filter((s) => matchesSearch(query.searchDoctor, s.providerName) && matchesSearch(query.searchPatient, s.patientName));
  const pg = cursorPage(rows, query.cursor, query.limit);
  return { data: pg.items, limit: pg.limit, nextCursor: pg.nextCursor, hasMore: pg.hasMore, total: rows.length };
});

on("GET", "/admin/service-requests/:id/available-nurses", () =>
  db.providers
    .filter((p) => p.status === "ACTIVE" && db.categoryOfType(p.consultationTypeId) === "CAREGIVER")
    .slice(0, 10)
    .map((p) => ({ id: String(p.id), name: db.providerName(p), unit: p.consultationTypeName }))
);

function timelineFor(srId: number | null, ltoId: number | null) {
  const lto = ltoId ? db.longTermOpportunities.find((l) => l.id === ltoId) : null;
  if (lto) {
    const order = ["REQUESTED", "SCHEDULE_PROPOSED", "PAYMENT_PENDING", "PAID", "IN_PROGRESS", "COMPLETED"];
    const terminal = ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(lto.status);
    const reached = order.indexOf(lto.status);
    const base = new Date(lto.createdAt).getTime();
    const steps = order.map((step, i) => ({
      id: i + 1,
      step,
      isDone: reached >= i || lto.status === "COMPLETED",
      actorRole: i === 0 ? "PATIENT" : i === 1 ? "SUPERVISOR" : i === 3 ? "PATIENT" : "SYSTEM",
      actorName: i === 0 ? lto.patientName : i === 1 ? lto.supervisorName : null,
      createdAt: reached >= i ? iso(new Date(base + i * 6 * 3600e3)) : null,
    }));
    if (!order.includes(lto.status)) {
      steps.push({ id: 99, step: lto.status, isDone: true, actorRole: "SYSTEM", actorName: null, createdAt: iso(new Date(base + 864e5)) });
    }
    return { serviceType: "LONG_TERM", isTerminal: terminal, terminalState: terminal ? lto.status : null, timeline: steps };
  }
  const sr = db.serviceRequests.find((s) => s.id === srId);
  const order = ["REQUEST_CREATED", "PROVIDER_ACCEPTED", "PAYMENT_COMPLETED", "SERVICE_STARTED", "SERVICE_COMPLETED"];
  const statusIndex: Record<string, number> = { PENDING: 0, ACCEPTED: 2, IN_PROGRESS: 3, COMPLETED: 4, REJECTED: 0, CANCELLED: 1 };
  const reached = sr ? statusIndex[sr.status] ?? 0 : 0;
  const created = sr ? new Date(sr.createdAt).getTime() : Date.now();
  const timeline: Row[] = order.map((step, i) => ({
    id: i + 1,
    step,
    isDone: i <= reached,
    actorRole: i === 0 || i === 2 ? "PATIENT" : i === 1 ? "PROVIDER" : "PROVIDER",
    actorName: i === 0 || i === 2 ? sr?.patientName : sr?.providerName,
    createdAt: i <= reached ? iso(new Date(created + i * 3 * 3600e3)) : null,
  }));
  const terminalState = sr && ["COMPLETED", "REJECTED", "CANCELLED"].includes(sr.status) ? sr.status : null;
  if (terminalState && terminalState !== "COMPLETED") {
    timeline.splice(reached + 1);
    timeline.push({ id: 99, step: `REQUEST_${terminalState}`, isDone: true, actorRole: "PROVIDER", actorName: sr?.providerName, createdAt: iso(new Date(created + 5 * 3600e3)) });
  }
  return { serviceType: "SHORT_TERM", isTerminal: Boolean(terminalState), terminalState, timeline };
}

on("GET", "/service-event-logs/timeline", ({ query }) =>
  timelineFor(query.serviceRequestId ? Number(query.serviceRequestId) : null, query.longTermOpportunityId ? Number(query.longTermOpportunityId) : null)
);

function srOrThrow(id: unknown): Row {
  return db.serviceRequests.find((s) => s.id === Number(id)) ?? notFound("Service request");
}
on("POST", "/service-requests", ({ body }) => {
  const sr = { id: 6000 + db.serviceRequests.length, status: "PENDING", createdAt: now(), updatedAt: now(), ...body };
  db.serviceRequests.unshift(sr);
  return sr;
});
on("GET", "/service-requests/nearby", () => db.serviceRequests.filter((s) => s.status === "PENDING"));
on("PATCH", "/service-requests/:id/accept", ({ params }) => Object.assign(srOrThrow(params.id), { status: "ACCEPTED" }));
on("PATCH", "/service-requests/:id/reject", ({ params }) => Object.assign(srOrThrow(params.id), { status: "REJECTED" }));
on("PATCH", "/service-requests/:id/status", ({ params, body }) => Object.assign(srOrThrow(params.id), { status: body?.status }));
on("POST", "/service-requests/:id/request-start-otp", () => ({ message: "OTP sent" }));
on("POST", "/service-requests/:id/verify-start-otp", ({ params }) => Object.assign(srOrThrow(params.id), { status: "IN_PROGRESS", startedAt: now() }));
on("POST", "/service-requests/:id/confirm-payment", ({ params }) => srOrThrow(params.id));
on("GET", "/service-requests/patient/my-requests", () => ({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
on("GET", "/service-requests/provider/my-requests", () => ({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
on("GET", "/service-requests/fee-estimate/short-term", ({ query }) => {
  const p = db.findProvider(query.providerId);
  const hours = num(query.shiftDuration, 8);
  const rate = num(p?.rate, 300);
  const subTotal = p?.billingRateType === "HOURLY" ? rate * hours : rate;
  const b = db.feeBreakdown(subTotal, 12, false);
  return {
    rateType: p?.billingRateType ?? "HOURLY",
    unitRate: money(rate),
    shiftDuration: hours,
    serviceFee: money(subTotal),
    vat: { amount: money(b.tax), percent: "5.00", inclusive: true },
    commission: { amount: money(b.commission), percent: "12.00", inclusive: true },
    ait: { amount: money(b.ait), percent: "2.00" },
    providerNet: money(b.providerFee),
    subTotal: money(subTotal),
    currency: "BDT",
  };
});

// =============================================================== long-term opportunities

function ltoOrThrow(id: unknown): Row {
  return db.longTermOpportunities.find((l) => l.id === Number(id)) ?? notFound("Long-term opportunity");
}

on("GET", "/admin/long-term-opportunities", ({ query }) => {
  let rows = db.longTermOpportunities;
  if (query.status) rows = rows.filter((l) => l.status === query.status);
  const sup = scopedSupervisorId(query);
  if (sup) rows = rows.filter((l) => l.supervisorId === sup);
  rows = rows.filter((l) => matchesSearch(query.search, l.requestNo, l.patientName, l.serviceAddressText, l.consultationTypeName));
  const pg = paginate(rows, query.page, query.limit);
  return { data: pg.items, total: pg.total, page: pg.page, limit: pg.limit };
});
on("GET", "/admin/long-term-opportunities/:id", ({ params }) => ltoOrThrow(params.id));
on("GET", "/long-term-opportunities/schedule-details/:id", ({ params }) => {
  const lto = ltoOrThrow(params.id);
  return { opportunity: lto, fee: lto.fee, schedule: db.ltoSchedules.get(lto.id) ?? [] };
});
on("POST", "/long-term-opportunities/:id/provider-schedule", ({ params, body }) => {
  const lto = ltoOrThrow(params.id);
  const list = db.ltoSchedules.get(lto.id) ?? [];
  for (const s of body?.slots ?? []) {
    const p = db.findProvider(s.providerId);
    const id = db.nextSlotId();
    list.push({
      providerSchedule: {
        id, providerId: s.providerId, providerName: db.providerName(p), date: s.date,
        startTime: s.startTime, endTime: s.endTime,
        start: `${s.date}T${s.startTime}:00`,
        end: `${s.endTime <= s.startTime ? ymd(new Date(new Date(s.date + "T00:00:00").getTime() + 864e5)) : s.date}T${s.endTime}:00`,
        status: "BOOKED",
      },
      serviceRequest: { id: 70000 + id, status: "ACCEPTED", fee: money(lto.perShiftFee), providerId: s.providerId, scheduleSlotId: id, longTermCalendarSlotId: id },
    });
    if (p && !lto.assignedNurses.some((n: Row) => n.id === p.id)) {
      lto.assignedNurses.push({ id: p.id, firstName: p.firstName, lastName: p.lastName });
    }
  }
  db.ltoSchedules.set(lto.id, list);
  if (lto.status === "REQUESTED" || lto.status === "CHANGE_REQUESTED") lto.status = "SCHEDULE_PROPOSED";
  return { message: "Schedule created", count: (body?.slots ?? []).length };
});
on("PATCH", "/long-term-opportunities/:id/schedule-reject/:slotId", ({ params }) => {
  const list = db.ltoSchedules.get(Number(params.id)) ?? [];
  const i = list.findIndex((s) => s.providerSchedule.id === Number(params.slotId));
  if (i >= 0) list.splice(i, 1);
  return { message: "Slot removed" };
});
on("PATCH", "/long-term-opportunities/:id", ({ params, body }) => Object.assign(ltoOrThrow(params.id), body));
on("PUT", "/admin/long-term-opportunities/:id/supervisor", ({ params, body }) => {
  const lto = ltoOrThrow(params.id);
  const s = db.supervisors.find((x) => x.id === Number(body?.supervisorId));
  lto.supervisorId = s?.id ?? null;
  lto.supervisorName = s ? `${s.firstName} ${s.lastName}` : null;
  return lto;
});

// =============================================================== supervisors

on("GET", "/admin/supervisors", ({ query }) => {
  const rows = db.supervisors
    .map((s): Row => ({ ...s, teamSize: db.providers.filter((p) => p.supervisorId === s.id).length }))
    .filter((s) => matchesSearch(query.search, s.firstName, s.lastName, s.email, s.region));
  const pg = paginate(rows, query.page, query.limit, 20);
  return { supervisors: pg.items, total: pg.total, page: pg.page, limit: pg.limit };
});
on("GET", "/admin/:supervisorId/providers", ({ params }) =>
  db.providers.filter((p) => p.supervisorId === Number(params.supervisorId)).map(providerRow)
);
on("POST", "/admin/assign-providers", ({ body }) => {
  for (const id of body?.providerIds ?? []) {
    const p = db.findProvider(id);
    if (p) p.supervisorId = Number(body.supervisorId);
  }
  return { message: "Providers assigned" };
});
on("PUT", "/admin/reassign-providers", ({ body }) => {
  const sup = Number(body?.supervisorId);
  const ids = new Set<number>((body?.providerIds ?? []).map(Number));
  for (const p of db.providers) {
    if (p.supervisorId === sup && !ids.has(p.id)) p.supervisorId = null;
    if (ids.has(p.id)) p.supervisorId = sup;
  }
  return { message: "Providers updated" };
});

// =============================================================== cancellations & refunds

function cancelSummary() {
  const today = ymd(new Date());
  const all = [...db.providerCancelRequests, ...db.providerCancelBatches];
  const todayCount = (s: string) => all.filter((r) => r.reviewStatus === s && String(r.reviewedAt ?? r.createdAt).startsWith(today)).length;
  return {
    pending: all.filter((r) => r.reviewStatus === "PENDING").length,
    approvedToday: todayCount("APPROVED"),
    rejectedToday: todayCount("REJECTED"),
    reassignedToday: todayCount("REASSIGNED"),
  };
}

on("GET", "/admin/provider-cancel-requests", ({ query }) => {
  let rows: Row[] = [...db.providerCancelRequests, ...db.providerCancelBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (query.status && query.status !== "ALL") rows = rows.filter((r) => r.reviewStatus === query.status);
  if (query.providerId) rows = rows.filter((r) => r.provider?.id === Number(query.providerId));
  if (query.patientId) rows = rows.filter((r) => r.patient?.id === Number(query.patientId));
  const pg = paginate(rows, query.page, query.limit);
  return {
    summary: cancelSummary(),
    data: pg.items.map((r) => omit(r, "shifts")),
    page: pg.page,
    limit: pg.limit,
    total: pg.total,
    hasNext: pg.hasMore,
  };
});
on("GET", "/admin/provider-cancel-requests/batch/:batchId", ({ params }) => {
  const b = db.providerCancelBatches.find((x) => x.batchId === params.batchId) ?? notFound("Batch");
  return { ...b, resolvedCount: b.shifts.filter((s: Row) => s.reviewStatus !== "PENDING").length };
});
on("POST", "/admin/provider-cancel-requests/batch/:batchId/process", ({ params, body }) => {
  const b = db.providerCancelBatches.find((x) => x.batchId === params.batchId) ?? notFound("Batch");
  const decisions: Record<string, string> = { approve: "APPROVED", reject: "REJECTED", reassign: "REASSIGNED" };
  for (const a of body?.actions ?? []) {
    const s = b.shifts.find((x: Row) => x.cancellationId === a.cancellationId);
    if (s) s.reviewStatus = decisions[a.decision] ?? s.reviewStatus;
  }
  if (b.shifts.every((s: Row) => s.reviewStatus !== "PENDING")) {
    b.reviewStatus = "APPROVED";
    b.reviewedAt = now();
  }
  return { batchId: b.batchId, processed: (body?.actions ?? []).length, results: [] };
});
on("GET", "/admin/provider-cancel-requests/:id", ({ params }) => {
  const r = db.providerCancelRequests.find((x) => x.id === Number(params.id)) ?? notFound("Cancel request");
  const fee = num(r.serviceRequest.fee);
  const replacements = db.providers
    .filter((p) => p.status === "ACTIVE" && p.consultationTypeId === r.serviceRequest.consultationTypeId && p.id !== r.provider?.id)
    .slice(0, 4);
  return {
    ...r,
    refundPreview: { feeAmount: "0.00", refundAmount: money(fee), refundMethod: "GATEWAY", note: "Provider-initiated cancellation: full refund to patient." },
    cancelHistory: db.providerCancelRequests
      .filter((x) => x.provider?.id === r.provider?.id && x.id !== r.id)
      .map((x) => ({ id: x.id, reviewStatus: x.reviewStatus, createdAt: x.createdAt, reasonCategory: x.reasonCategory })),
    suggestedReplacements: replacements.map((p, i) => ({ providerId: p.id, name: db.providerName(p), isAvailable: i !== 2 })),
    serviceTimeline: timelineFor(r.serviceRequest.id, null).timeline
      .filter((e) => e.isDone)
      .map((e) => ({ id: e.id, eventType: e.step, actorRole: e.actorRole, note: null, createdAt: e.createdAt })),
  };
});
function reviewCancel(id: unknown, reviewStatus: string, extra: Row = {}) {
  const r = db.providerCancelRequests.find((x) => x.id === Number(id)) ?? notFound("Cancel request");
  Object.assign(r, { reviewStatus, reviewedAt: now(), ...extra });
  if (reviewStatus === "APPROVED") r.serviceRequest.status = "CANCELLED";
  return r;
}
on("POST", "/admin/provider-cancel-requests/:id/approve", ({ params }) => reviewCancel(params.id, "APPROVED"));
on("POST", "/admin/provider-cancel-requests/:id/reject", ({ params }) => reviewCancel(params.id, "REJECTED"));
on("POST", "/admin/provider-cancel-requests/:id/reassign", ({ params, body }) => {
  const p = db.findProvider(body?.newProviderId);
  const r = reviewCancel(params.id, "REASSIGNED", p ? { provider: { id: p.id, userId: p.userId, name: db.providerName(p) } } : {});
  return { id: r.id, reviewStatus: "REASSIGNED", serviceRequestId: r.serviceRequest.id, newProviderId: Number(body?.newProviderId), reassignTransactionId: null };
});

on("GET", "/admin/refunds", ({ query }) => {
  const { start, end } = rangeFromQuery(query, 90);
  let rows = db.refunds.filter((r) => inRange(r.cancellation.cancelledAt, start, end));
  const counted = rows;
  if (query.status) rows = rows.filter((r) => r.refundTransaction.status === query.status);
  if (query.paymentMethod) rows = rows.filter((r) => r.refundTransaction.paymentMethod === query.paymentMethod);
  if (query.patientId) rows = rows.filter((r) => r.refundTransaction.patientId === Number(query.patientId));
  rows = [...rows].sort((a, b) => b.cancellation.cancelledAt.localeCompare(a.cancellation.cancelledAt));
  const count = (s: string) => counted.filter((r) => r.refundTransaction.status === s).length;
  const pg = query.page ? paginate(rows, query.page, query.limit) : null;
  const cp = cursorPage(rows, query.cursor, query.limit);
  return {
    summary: {
      window: { start: ymd(start), end: ymd(end) },
      counts: { total: counted.length, pending: count("PENDING"), completed: count("COMPLETED"), failed: count("FAILED"), cancelled: count("CANCELLED") },
    },
    data: pg ? pg.items : cp.items,
    pagination: pg
      ? { limit: pg.limit, hasMore: pg.hasMore, nextCursor: null, page: pg.page, total: pg.total }
      : { limit: cp.limit, hasMore: cp.hasMore, nextCursor: cp.nextCursor, total: rows.length },
  };
});
on("POST", "/admin/refunds/reconcile", () => {
  const pending = db.refunds.filter((r) => r.refundTransaction.status === "PENDING");
  pending.forEach((r) => {
    r.refundTransaction.status = "COMPLETED";
    r.refundTransaction.gatewayRefundStatus = "REFUNDED";
  });
  return { scanned: pending.length + 2, settled: pending.length, failed: 0, pending: 0, escalated: 0 };
});

// =============================================================== upgrade requests

on("GET", "/admin/upgrade-requests", ({ query }) =>
  db.upgradeRequests.filter((u) => !query.status || u.status === query.status)
);
on("GET", "/admin/upgrade-requests/:id", ({ params }) => byId(db.upgradeRequests, params.id, "Upgrade request"));
on("PATCH", "/admin/upgrade-requests/:id", ({ params, body }) => {
  const u = byId(db.upgradeRequests, params.id, "Upgrade request");
  Object.assign(u, { status: body?.status, adminComment: body?.adminComment ?? null, reviewedBy: 1, reviewedAt: now() });
  if (body?.status === "APPROVED") {
    const p = db.findProvider(u.providerId);
    if (p) {
      p.consultationTypeId = u.targetConsultationTypeId;
      p.consultationTypeName = u.targetConsultationTypeName;
    }
  }
  return { message: `Upgrade request ${String(body?.status).toLowerCase()}` };
});

// =============================================================== verification documents (provider self-service)

on("GET", "/verification-documents", () => ({ consultationTypeId: null, consultationTypeName: null, requirements: [], documents: [] }));
on("POST", "/verification-documents/upload", () => ({ id: db.nextDocId(), type: "OTHER", status: "PENDING", createdAt: now() }));
on("DELETE", "/verification-documents/:id", () => ({ message: "Deleted" }));

// =============================================================== notifications

on("GET", "/notifications", ({ query }) => {
  const status = query.status ?? "ACTIVE";
  const rows = db.notifications.filter((n) => n.status === status);
  const pg = paginate(rows, query.page, query.limit, 20);
  return {
    data: pg.items,
    meta: {
      total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages,
      unreadCount: db.notifications.filter((n) => n.status === "ACTIVE" && !n.readAt).length,
    },
  };
});
on("PATCH", "/notifications/:id/read", ({ params }) => Object.assign(byId(db.notifications, params.id, "Notification"), { readAt: now() }));
on("POST", "/notifications/mark-all-read", () => {
  const unread = db.notifications.filter((n) => !n.readAt);
  unread.forEach((n) => (n.readAt = now()));
  return { count: unread.length };
});
on("POST", "/notifications/device", () => ({ message: "Device registered" }));
on("POST", "/notifications/test-push", () => ({ sent: true, message: "Test push sent (demo)" }));

// =============================================================== provider finance (self-service) & withdrawals

on("GET", "/financial/wallet/me", () => {
  return omit(db.providerWallet(1), "history", "nonClaimableBalance", "cashCommissionDue");
});
on("GET", "/financial/claimable-balance", () => ({ total: num(db.providerWallet(1).claimableBalance), breakdown: [] }));
on("GET", "/financial/claimable-balance/history", () => []);
on("POST", "/financial/claimable-balance/claim", () => ({ message: "Claimed" }));
on("GET", "/financial/transactions", () => ({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
on("GET", "/financial/transactions/:id", ({ params }) => ({ id: Number(params.id) }));
on("GET", "/financial/ledger", () => ({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }));
on("POST", "/financial/recharge/initiate", () => ({ transactionId: 1, paymentGateway: "SSLCOMMERZ", gatewayUrl: "#" }));

on("GET", "/financial/withdrawal/admin/list", ({ query }) => {
  let rows = db.withdrawals;
  if (query.status) rows = rows.filter((w) => w.status === query.status);
  if (query.startDate || query.endDate) {
    const start = parseDay(query.startDate);
    const end = parseDay(query.endDate);
    rows = rows.filter((w) => inRange(w.createdAt, start, end));
  }
  const pg = paginate(rows, query.page, query.limit);
  return { data: pg.items, meta: { total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages } };
});
on("GET", "/financial/withdrawal/admin/:id", ({ params }) => {
  const w = byId(db.withdrawals, params.id, "Withdrawal");
  const wallet = db.providerWallet(w.providerId);
  return { ...w, walletId: w.providerId, claimableBalance: wallet.claimableBalance, availableToWithdraw: wallet.availableToWithdraw };
});
function reviewWithdrawal(id: unknown, status: string, body: Row) {
  const w = byId(db.withdrawals, id, "Withdrawal");
  Object.assign(w, {
    status,
    adminNote: body?.adminNote ?? w.adminNote,
    proofUrl: body?.proofUrl ?? w.proofUrl,
    updatedAt: now(),
    ...(status === "APPROVED" ? { approvedAt: now() } : {}),
    ...(status === "COMPLETED" ? { completedAt: now(), reference: w.reference ?? `TRX${Date.now() % 1e8}` } : {}),
  });
  return w;
}
on("PATCH", "/financial/withdrawal/admin/:id/approve", ({ params, body }) => reviewWithdrawal(params.id, "APPROVED", body));
on("PATCH", "/financial/withdrawal/admin/:id/reject", ({ params, body }) => reviewWithdrawal(params.id, "REJECTED", body));
on("PATCH", "/financial/withdrawal/admin/:id/complete", ({ params, body }) => reviewWithdrawal(params.id, "COMPLETED", body));

// =============================================================== admin financial reports

function filterTransactions(query: Record<string, any>) {
  const { start, end } = rangeFromQuery(query, 30);
  const sup = scopedSupervisorId(query);
  return db.transactions.filter(
    (t) =>
      inRange(t.date, start, end) &&
      (!query.providerId || t.providerId === Number(query.providerId)) &&
      (!query.patientId || t.patientId === Number(query.patientId)) &&
      (!sup || t.supervisorId === sup) &&
      (!query.type || t.type === query.type) &&
      (!query.paymentMethod || t.paymentMethod === query.paymentMethod) &&
      (!query.serviceType || t.serviceType === query.serviceType) &&
      (!query.status || t.status === query.status)
  );
}

function sum(rows: Row[], key: string, pred: (t: Row) => boolean = () => true) {
  return rows.filter(pred).reduce((s, t) => s + num(t[key]), 0);
}

on("GET", "/admin/financial/report", ({ query }) => {
  const { start, end } = rangeFromQuery(query, 30);
  const rows = filterTransactions(query);
  const pay = (t: Row) => t.type === "CONSULTATION_PAYMENT";
  const wd = (t: Row) => t.type === "WITHDRAWAL";
  const online = sum(rows, "totalFee", (t) => pay(t) && t.paymentMethod === "ONLINE");
  const cash = sum(rows, "totalFee", (t) => pay(t) && t.paymentMethod === "CASH");
  const commission = sum(rows, "commission", pay);
  const tax = sum(rows, "tax", pay);
  const ait = sum(rows, "ait", pay);
  const supervisorCommission = sum(rows, "supervisorCommission", pay);
  const byDay = eachDay(start, end)
    .reverse()
    .map((date) => {
      const d = rows.filter((t) => String(t.date).startsWith(date));
      const on = sum(d, "totalFee", (t) => pay(t) && t.paymentMethod === "ONLINE");
      const ca = sum(d, "totalFee", (t) => pay(t) && t.paymentMethod === "CASH");
      return {
        date,
        inflow: { onlinePayments: money(on), cashPayments: money(ca), total: money(on + ca) },
        distribution: {
          providerEarningsAllocated: money(sum(d, "providerFee", pay)),
          commission: money(sum(d, "commission", pay)),
          tax: money(sum(d, "tax", pay)),
          ait: money(sum(d, "ait", pay)),
        },
        outflow: { withdrawals: money(sum(d, "totalFee", wd)) },
        transactionCount: d.length,
      };
    })
    .filter((d) => d.transactionCount > 0);
  const pg = paginate(rows, query.page, query.limit, 20);
  const fmt = (t: Row) => ({
    transactionId: t.transactionId, date: t.date, type: t.type, status: t.status, paymentMethod: t.paymentMethod,
    serviceType: t.serviceType, longTermOpportunityId: t.longTermOpportunityId, consultationTypeName: t.consultationTypeName,
    scheduledDate: t.scheduledDate, providerId: t.providerId, providerName: t.providerName, patientId: t.patientId,
    patientName: t.patientName, totalFee: money(t.totalFee), providerFee: money(t.providerFee),
    commission: money(t.commission), tax: money(t.tax), ait: money(t.ait),
    supervisorCommission: money(t.supervisorCommission), isEscrow: t.isEscrow,
  });
  return {
    filters: {
      startDate: ymd(start), endDate: ymd(end),
      providerId: query.providerId ? Number(query.providerId) : null,
      patientId: query.patientId ? Number(query.patientId) : null,
      supervisorId: scopedSupervisorId(query),
      type: query.type ?? null, paymentMethod: query.paymentMethod ?? null,
      serviceType: query.serviceType ?? null, status: query.status ?? null,
    },
    summary: query.paginationOnly
      ? null
      : {
          totals: {
            onlinePayments: money(online),
            cashPayments: money(cash),
            totalInflow: money(online + cash),
            totalProviderEarningsAllocated: money(sum(rows, "providerFee", pay)),
            totalCommission: money(commission),
            totalTax: money(tax),
            totalVat: money(tax),
            totalSupervisorCommission: money(supervisorCommission),
            totalAit: money(ait),
            totalWithdrawals: money(sum(rows, "totalFee", wd)),
            netPlatformEarnings: money(commission),
            consultationCount: rows.filter(pay).length,
            withdrawalCount: rows.filter(wd).length,
          },
          byDay,
        },
    transactions: {
      data: pg.items.map(fmt),
      pagination: { page: pg.page, limit: pg.limit, hasMore: pg.hasMore, total: pg.total },
    },
  };
});

on("GET", "/admin/financial/transactions/:id", ({ params }) => {
  const t = db.transactions.find((x) => x.transactionId === Number(params.id)) ?? notFound("Transaction");
  const provider = db.findProvider(t.providerId);
  const patient = db.findPatient(t.patientId);
  const isPay = t.type === "CONSULTATION_PAYMENT";
  const part = (amount: number, percent: number, inclusive = true) => ({ amount: money(amount), percent: money(percent), inclusive });
  return {
    transactionId: t.transactionId,
    type: t.type,
    status: t.status,
    paymentMethod: t.paymentMethod,
    amount: money(t.totalFee),
    createdAt: t.date,
    serviceRequest: t.serviceRequestId
      ? {
          id: t.serviceRequestId, status: t.serviceRequestStatus ?? "COMPLETED", scheduledDate: t.scheduledDate,
          rateType: provider?.billingRateType ?? null, rate: provider?.rate ?? null, shiftDuration: t.serviceType === "LONG_TERM" ? 12 : null,
          referenceType: t.serviceType, longTermOpportunityId: t.longTermOpportunityId,
        }
      : null,
    consultationTypeName: t.consultationTypeName,
    patient: patient ? { id: patient.id, name: db.patientName(patient), email: patient.email ?? null } : null,
    provider: provider ? { id: provider.id, name: db.providerName(provider), email: provider.email } : null,
    breakdown: isPay
      ? {
          totalFee: money(t.totalFee),
          tax: part(t.tax, 5),
          supervisorCommission: { amount: money(t.supervisorCommission), percent: t.supervisorCommission ? "2.00" : "0.00" },
          commission: part(t.commission, t.commissionPercent ?? 15),
          ait: part(t.ait, 2, false),
          providerFee: money(t.providerFee),
        }
      : null,
    ledgerEntries: isPay
      ? [
          ["PATIENT_PAYMENT_GL", "SERVICE_HOLD_GL", t.totalFee, "Patient payment held in escrow"],
          ["SERVICE_HOLD_GL", "VAT_GL", t.tax, "VAT collected"],
          ["SERVICE_HOLD_GL", "COMMISSION_GL", t.commission, "Platform commission"],
          ["SERVICE_HOLD_GL", "AIT_GL", t.ait, "AIT withheld"],
          ["SERVICE_HOLD_GL", "PROVIDER_CLAIMABLE", t.providerFee, "Provider earnings released"],
        ].map(([debit, credit, amount, description], i) => ({
          ledgerId: t.transactionId * 10 + i,
          debitWalletType: debit, creditWalletType: credit, amount: money(Number(amount)),
          debitBalanceBefore: null, debitBalanceAfter: "0.00", creditBalanceBefore: null, creditBalanceAfter: money(Number(amount)),
          description,
        }))
      : [
          {
            ledgerId: t.transactionId * 10, debitWalletType: "PROVIDER_CLAIMABLE", creditWalletType: "PAYOUT_GL",
            amount: money(t.totalFee), debitBalanceBefore: null, debitBalanceAfter: "0.00", creditBalanceBefore: null,
            creditBalanceAfter: money(t.totalFee), description: "Provider withdrawal",
          },
        ],
  };
});

on("GET", "/admin/financial/providers/:id/transactions", ({ params, query }) => {
  const rows = db.transactions.filter((t) => t.providerId === Number(params.id));
  const pg = paginate(rows, query.page, query.limit);
  return {
    data: pg.items.map((t) => ({
      id: t.transactionId,
      amount: money(t.type === "WITHDRAWAL" ? -t.totalFee : t.providerFee),
      balanceBefore: null,
      balanceAfter: "0.00",
      type: t.type === "WITHDRAWAL" ? "DEBIT" : "CREDIT",
      description: t.type === "WITHDRAWAL" ? "Withdrawal" : `${t.consultationTypeName} — ${t.patientName}`,
      createdAt: t.date,
    })),
    total: pg.total,
    page: pg.page,
    limit: pg.limit,
  };
});

function glWallets(rows: Row[]) {
  const pay = rows.filter((t) => t.type === "CONSULTATION_PAYMENT");
  const escrow = sum(pay, "totalFee", (t) => t.isEscrow);
  const payouts = sum(rows, "totalFee", (t) => t.type === "WITHDRAWAL");
  const refundsStaged = db.refunds.filter((r) => r.refundTransaction.status === "PENDING").reduce((s, r) => s + num(r.refundTransaction.amount), 0);
  const cancelFees = db.refunds.reduce((s, r) => s + num(r.cancellation.feeAmount), 0);
  const def: Array<[string, number, number]> = [
    ["SERVICE_HOLD_GL", escrow, sum(pay, "totalFee")],
    ["COMMISSION_GL", sum(pay, "commission"), 0],
    ["VAT_GL", sum(pay, "tax"), 0],
    ["AIT_GL", sum(pay, "ait"), 0],
    ["PAYOUT_GL", payouts, 0],
    ["REFUND_GL", refundsStaged, 0],
    ["CANCELLATION_FEE_GL", cancelFees, 0],
  ];
  return def.map(([walletType, balance, extraDebit], i) => ({
    walletType,
    walletId: i + 1,
    balance: money(balance),
    currency: "BDT",
    totalCredit: money(balance + extraDebit),
    totalDebit: money(extraDebit),
    netChange: money(balance),
    drift: "0.00",
    isHealthy: true,
  }));
}

on("GET", "/admin/financial/gl-reconciliation", () => {
  const pay = db.transactions.filter((t) => t.type === "CONSULTATION_PAYMENT");
  const commission = sum(pay, "commission");
  const tax = sum(pay, "tax");
  const ait = sum(pay, "ait");
  const cancelFees = db.refunds.reduce((s, r) => s + num(r.cancellation.feeAmount), 0);
  return {
    wallets: glWallets(db.transactions),
    moneySummary: {
      inEscrow: money(sum(pay, "totalFee", (t) => t.isEscrow)),
      commissionEarned: money(commission),
      taxCollected: money(tax),
      aitWithheld: money(ait),
      totalPlatformRevenue: money(commission + tax + cancelFees),
      providerPayoutsProcessed: money(sum(db.transactions, "totalFee", (t) => t.type === "WITHDRAWAL")),
      stagedRefunds: money(db.refunds.filter((r) => r.refundTransaction.status === "PENDING").reduce((s, r) => s + num(r.refundTransaction.amount), 0)),
      cancellationFees: money(cancelFees),
      supervisorCommissionReleased: money(sum(pay, "supervisorCommission", (t) => !t.isEscrow)),
    },
    reconciliationHealth: {
      balanced: true,
      driftedRowCount: 0,
      imbalancedTransactionCount: 0,
      strictModeCutoverAt: iso(dayOffset(-90)),
      legacyDriftedRowCount: 3,
      legacyImbalancedTransactionCount: 1,
    },
  };
});

on("GET", "/admin/financial/gl-reconciliation/history", ({ query }) => {
  const { start, end } = rangeFromQuery(query, 14);
  const days = eachDay(start, end).map((date) => {
    const d = db.transactions.filter((t) => String(t.date).startsWith(date));
    const wallets = glWallets(d).map((w) => omit(w, "drift", "isHealthy"));
    const credit = wallets.reduce((s, w) => s + num(w.totalCredit), 0);
    const debit = wallets.reduce((s, w) => s + num(w.totalDebit), 0);
    return { date, totalCredit: money(credit), totalDebit: money(debit), netChange: money(credit - debit), wallets };
  });
  const tc = days.reduce((s, d) => s + num(d.totalCredit), 0);
  const td = days.reduce((s, d) => s + num(d.totalDebit), 0);
  return { startDate: ymd(start), endDate: ymd(end), days, total: { totalCredit: money(tc), totalDebit: money(td), netChange: money(tc - td) } };
});

// =============================================================== dashboard & reporting

on("GET", "/admin/dashboard/summary", ({ query }) => {
  const sup = scopedSupervisorId(query);
  const provs = sup ? db.providers.filter((p) => p.supervisorId === sup) : db.providers;
  const srs = sup ? db.serviceRequests.filter((s) => provs.some((p) => p.id === s.providerId)) : db.serviceRequests;
  const count = (s: string) => srs.filter((x) => x.status === s).length;
  return {
    patients: { total: db.patients.length, pending: db.patients.filter((p) => p.status === "PENDING").length },
    providers: {
      total: provs.length,
      pending: provs.filter((p) => p.status === "PENDING").length,
      active: provs.filter((p) => p.status === "ACTIVE").length,
      rejected: provs.filter((p) => p.status === "REJECTED").length,
    },
    serviceRequests: {
      PENDING: count("PENDING"), ACCEPTED: count("ACCEPTED"), IN_PROGRESS: count("IN_PROGRESS"),
      COMPLETED: count("COMPLETED"), CANCELLED: count("CANCELLED"), REJECTED: count("REJECTED"),
    },
    pendingCertifications: [...db.providerCertifications.values()].flat().filter((c) => c.status === "PENDING").length,
    recentServiceRequests: srs.slice(0, 8).map((s) => ({
      id: s.id, patientName: s.patientName, providerName: s.providerName, status: s.status,
      consultationTypeName: s.consultationTypeName, createdAt: s.createdAt,
    })),
  };
});

/** Unified "request" rows (short-term + long-term) used by the reporting endpoints. */
function reportingRows(query: Record<string, any>) {
  const sup = scopedSupervisorId(query);
  const short = db.serviceRequests.map((s) => ({
    date: s.createdAt, serviceType: "SHORT_TERM", status: s.status, providerId: s.providerId,
    category: db.categoryOfType(s.consultationTypeId), supervisorId: db.findProvider(s.providerId)?.supervisorId ?? null,
    fee: num(s.fee), id: s.id,
  }));
  const long = db.longTermOpportunities.map((l) => ({
    date: l.createdAt, serviceType: "LONG_TERM", status: l.status, providerId: l.assignedNurses[0]?.id ?? null,
    category: "CAREGIVER", supervisorId: l.supervisorId, fee: num(l.fee), id: l.id,
  }));
  return [...short, ...long].filter(
    (r) =>
      (!query.serviceType || r.serviceType === query.serviceType) &&
      (!query.providerCategory || r.category === (query.providerCategory === "NURSE" ? "CAREGIVER" : query.providerCategory)) &&
      (!query.providerId || r.providerId === Number(query.providerId)) &&
      (!sup || r.supervisorId === sup)
  );
}

function kpis(rows: Row[]) {
  const total = rows.length;
  const accepted = rows.filter((r) => !["PENDING", "REQUESTED", "REJECTED", "EXPIRED"].includes(r.status)).length;
  const confirmed = rows.filter((r) => ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "PAID"].includes(r.status)).length;
  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const expired = rows.filter((r) => r.status === "EXPIRED").length;
  const cancelled = rows.filter((r) => ["CANCELLED", "REJECTED"].includes(r.status)).length;
  const sent = rows.filter((r) => r.status !== "REQUESTED").length;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const gross = rows.filter((r) => ["COMPLETED", "IN_PROGRESS", "PAID", "ACCEPTED"].includes(r.status)).reduce((s, r) => s + r.fee, 0);
  const refunded = rows.filter((r) => r.status === "CANCELLED").reduce((s, r) => s + r.fee, 0) * 0.9;
  const pendingPayout = rows.filter((r) => ["IN_PROGRESS", "PAID", "ACCEPTED"].includes(r.status)).reduce((s, r) => s + r.fee, 0) * 0.8;
  return {
    totalRequests: total,
    sentToProviders: sent,
    acceptedByProvider: accepted,
    confirmedBookings: confirmed,
    completedServices: completed,
    autoCancelUnpaid: expired,
    cancelledTotal: cancelled,
    fulfillmentRate: pct(completed, total),
    acceptanceRate: pct(accepted, sent),
    providerAcceptanceRate: pct(accepted, sent),
    paymentExpiryRate: pct(expired, total),
    cancellationRate: pct(cancelled, total),
    grossRevenue: money(gross),
    ontorCommission: money(gross * 0.14),
    providerPayout: money(gross * 0.79),
    pendingPayout: money(pendingPayout),
    refundAmount: money(refunded),
  };
}

function reportingWindow(query: Record<string, any>) {
  const { start, end } = rangeFromQuery(query, 90);
  return { start, end, rows: reportingRows(query).filter((r) => inRange(r.date, start, end)) };
}

on("GET", "/reporting/summary", ({ query }) => {
  const { rows } = reportingWindow(query);
  return kpis(rows);
});
on("GET", "/reporting/supervisor-summary", ({ query }) => {
  const { start, end, rows } = reportingWindow(query);
  return { supervisorId: scopedSupervisorId(query), serviceType: query.serviceType ?? null, startDate: ymd(start), endDate: ymd(end), ...kpis(rows) };
});
function dailyBreakdown({ query }: MockContext) {
  const { start, end, rows } = reportingWindow(query);
  const days = eachDay(start, end)
    .reverse()
    .map((date) => ({ date, ...kpis(rows.filter((r) => String(r.date).startsWith(date))) }))
    .filter((d) => d.totalRequests > 0);
  const pg = cursorPage(days, query.cursor, query.limit, 31);
  return { data: pg.items, nextCursor: pg.nextCursor, hasMore: pg.hasMore, limit: pg.limit };
}
on("GET", "/reporting/daily-breakdown", dailyBreakdown);
on("GET", "/reporting/supervisor-daily-breakdown", dailyBreakdown);
