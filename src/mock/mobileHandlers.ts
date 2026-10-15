/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Demo routes for the patient / provider mobile views (`src/mobile`).
 *
 * Paths follow the backend's business flow doc (`/v1/...`) under a `/m` prefix so they never
 * clash with the admin panel's mocks. The signed-in mobile user is passed as the `__as` query
 * param ("PATIENT:12" / "PROVIDER:5") instead of a JWT.
 *
 * All data lives in the same store as the admin panel, so a long-term request a patient creates
 * here shows up in the admin's schedule list, the nurses the admin assigns see the shifts here, etc.
 */
import * as db from "./db";
import type { Row } from "./db";
import * as mdb from "./mobileDb";
import { MockHttpError, on as onRoute, type MockContext } from "./handlers";
import { logEvent, notifyAdmin, notifyPatient, notifyUser } from "./notify";
import { dayOffset, eachDay, fakeJwt, iso, money, num, paginate, parseDay, ymd } from "./utils";

type Handler = (ctx: MockContext) => unknown;
const on = (method: string, path: string, handler: Handler) => onRoute(method, `/m${path}`, handler);

const DEMO_PASSWORD = "demo1234";
const DEMO_OTP = "123456";
const ACTIVE_SR = ["PENDING", "ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"];
const DEFAULT_LOCATION = { latitude: 23.7465, longitude: 90.376 }; // Dhanmondi

const fail = (status: number, message: string): never => {
  throw new MockHttpError(status, message);
};
const now = () => iso(new Date());
const nextId = (rows: Row[], start: number, key = "id") =>
  rows.reduce((m, r) => Math.max(m, num(r[key], 0)), start - 1) + 1;

function config(key: string, fallback: string): string {
  return db.systemConfig.find((c) => c.key === key)?.value ?? fallback;
}

// =============================================================== identity

type Actor = { role: "PATIENT"; patient: Row } | { role: "PROVIDER"; provider: Row };

function actor(query: Record<string, any>): Actor {
  const [role, id] = String(query.__as ?? "").split(":");
  if (role === "PATIENT") {
    const patient = db.findPatient(id);
    if (patient) return { role, patient };
  }
  if (role === "PROVIDER") {
    const provider = db.findProvider(id);
    if (provider) return { role, provider };
  }
  return fail(401, "Please sign in again");
}

function mePatient(query: Record<string, any>, requireActive = true): Row {
  const a = actor(query);
  if (a.role !== "PATIENT") fail(403, "This action is for patients only");
  const p = (a as { patient: Row }).patient;
  if (requireActive && p.status !== "ACTIVE")
    fail(403, `Your profile is ${String(p.status).toLowerCase()}. You can use services once it is ACTIVE.`);
  return p;
}

function meProvider(query: Record<string, any>, requireActive = true): Row {
  const a = actor(query);
  if (a.role !== "PROVIDER") fail(403, "This action is for providers only");
  const p = (a as { provider: Row }).provider;
  if (requireActive && p.status !== "ACTIVE")
    fail(403, `Your profile is ${String(p.status).toLowerCase()}. Admin must verify you before you can take services.`);
  return p;
}

function userIdOf(a: Actor): number {
  return a.role === "PATIENT" ? a.patient.userId : a.provider.userId;
}

function normalizePhone(value: unknown): string | null {
  let v = String(value ?? "").replace(/[\s-]/g, "");
  if (v.startsWith("+880")) v = "0" + v.slice(4);
  else if (v.startsWith("880")) v = "0" + v.slice(3);
  return /^01[3-9]\d{8}$/.test(v) ? v : null;
}

function isEmail(value: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

function findAccount(identifier: unknown): { role: "PATIENT" | "PROVIDER"; row: Row } | null {
  const raw = String(identifier ?? "").trim().toLowerCase();
  const phone = normalizePhone(raw);
  const match = (r: Row) => (phone && r.username === phone) || (r.email && String(r.email).toLowerCase() === raw);
  const patient = db.patients.find(match);
  if (patient) return { role: "PATIENT", row: patient };
  const provider = db.providers.find(match);
  if (provider) return { role: "PROVIDER", row: provider };
  return null;
}

function providerCategory(p: Row): "DOCTOR" | "CAREGIVER" {
  return db.categoryOfType(p.consultationTypeId);
}

function employmentType(p: Row): "SALARIED" | "INDEPENDENT" {
  const t = db.consultationTypes.find((x) => x.id === p.consultationTypeId);
  const root = db.consultationTypes.find((x) => x.id === (t?.parentId ?? t?.id));
  return (t?.employmentType ?? root?.employmentType) === "FULL_TIME" ? "SALARIED" : "INDEPENDENT";
}

function session(role: "PATIENT" | "PROVIDER", row: Row) {
  return {
    accessToken: fakeJwt(row.userId, role),
    role,
    profileId: row.id,
    user: { id: row.userId, firstName: row.firstName, lastName: row.lastName, email: row.email ?? null, username: row.username, role },
    providerCategory: role === "PROVIDER" ? providerCategory(row) : null,
    providerType: role === "PROVIDER" ? row.consultationTypeName : null,
    employmentType: role === "PROVIDER" ? employmentType(row) : null,
  };
}

const notify = notifyUser;

// =============================================================== ratings, distance, slots

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ratingOf(userId: number, seed: number) {
  const mine = mdb.reviews.filter((r) => r.revieweeUserId === userId);
  // Seeded profiles start with some history so the app does not look empty.
  const baseCount = seed > 0 ? 3 + ((seed * 7) % 25) : 0;
  const baseAvg = 4 + ((seed * 13) % 10) / 10;
  const total = baseCount + mine.length;
  const sum = baseCount * baseAvg + mine.reduce((s, r) => s + r.rating, 0);
  return { totalReviews: total, averageRating: total ? Math.round((sum / total) * 100) / 100 : 0 };
}

function providerRating(p: Row) {
  return ratingOf(p.userId, p.registeredInApp ? 0 : p.id);
}

function slotHours(s: Row): number {
  const [sh, sm] = String(s.startTime).split(":").map(Number);
  const [eh, em] = String(s.endTime).split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

function feeFor(p: Row, slot?: Row | null): number {
  const rate = num(p.rate);
  if (p.billingRateType === "HOURLY") return rate * (slot ? slotHours(slot) : 4);
  return rate;
}

function slotStart(s: Row): Date {
  return new Date(`${s.date}T${s.startTime}:00`);
}

/** Publish default slots for the next week until the provider manages their own schedule. */
function ensureSlots(p: Row) {
  if (p.scheduleManaged || p.status !== "ACTIVE") return;
  const doctor = providerCategory(p) === "DOCTOR";
  const pattern = doctor ? [["10:00", "13:00"], ["17:00", "21:00"]] : [["08:00", "14:00"], ["14:00", "20:00"]];
  for (let d = 0; d < 7; d++) {
    const date = ymd(dayOffset(d));
    if (mdb.providerSlots.some((s) => s.providerId === p.id && s.date === date)) continue;
    for (const [startTime, endTime] of pattern) {
      mdb.providerSlots.push({ id: nextId(mdb.providerSlots, 40000), providerId: p.id, date, startTime, endTime, status: "AVAILABLE" });
    }
  }
}

function futureSlots(p: Row, date?: string, time?: string): Row[] {
  ensureSlots(p);
  const nowMs = Date.now();
  return mdb.providerSlots
    .filter((s) => s.providerId === p.id && s.status === "AVAILABLE" && slotStart(s).getTime() > nowMs)
    .filter((s) => !date || s.date === date)
    .filter((s) => !time || (s.startTime <= time && time <= s.endTime))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

function offeredServices(p: Row) {
  return db.serviceChecklists
    .filter((c) => c.consultationTypeId === p.consultationTypeId && c.isActive)
    .map((c) => ({ id: c.id, label: c.name, displayOrder: c.displayOrder, offered: !(p.excludedServiceIds ?? []).includes(c.id) }));
}

function providerCard(p: Row, from?: { latitude: number; longitude: number }, patient?: Row) {
  const distance = from ? haversineKm(from.latitude, from.longitude, num(p.latitude), num(p.longitude)) : null;
  const level = db.levels.find((l) => l.id === p.levelId);
  return {
    id: p.id,
    userId: p.userId,
    providerName: db.providerName(p),
    gender: p.gender,
    consultationTypeId: p.consultationTypeId,
    consultationTypeName: p.consultationTypeName,
    category: providerCategory(p),
    employmentType: employmentType(p),
    experience: p.experience,
    levelName: level?.name ?? null,
    status: p.status,
    currentFee: num(p.rate),
    feeType: p.billingRateType,
    distance: distance == null ? null : Math.round(distance * 10) / 10,
    serviceRadiusKm: num(p.serviceRadiusKm, 0) || null,
    acceptingRequests: p.acceptingRequests !== false,
    isOnline: p.acceptingRequests !== false && p.id % 3 !== 0,
    isLiked: patient ? mdb.likedProviders.some((l) => l.patientId === patient.id && l.providerId === p.id) : false,
    ...providerRating(p),
  };
}

// =============================================================== service request helpers

function srOrThrow(id: unknown): Row {
  return db.serviceRequests.find((s) => s.id === Number(id)) ?? fail(404, "Service request not found");
}

function mapUrl(lat: unknown, lng: unknown) {
  return lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null;
}

function setSlotStatus(slotId: unknown, status: string) {
  const slot = mdb.providerSlots.find((s) => s.id === Number(slotId));
  if (slot) slot.status = status;
}

function commissionPercent(consultationTypeId: unknown): number {
  const t = db.consultationTypes.find((x) => x.id === Number(consultationTypeId));
  const root = db.consultationTypes.find((x) => x.id === (t?.parentId ?? t?.id));
  return t?.platformCommissionPercent ?? root?.platformCommissionPercent ?? 15;
}

function txFor(sr: Row): Row | undefined {
  return db.transactions.find((t) => t.serviceRequestId === sr.id && t.type === "CONSULTATION_PAYMENT");
}

function upsertTransaction(sr: Row, status: string, paymentMethod: string | null) {
  const pct = commissionPercent(sr.consultationTypeId);
  const b = db.feeBreakdown(num(sr.fee), pct, false);
  const existing = txFor(sr);
  const row: Row = {
    transactionId: existing?.transactionId ?? nextId(db.transactions, 10000, "transactionId"),
    date: sr.scheduledAt ?? now(),
    type: "CONSULTATION_PAYMENT",
    status,
    paymentMethod,
    serviceType: "SHORT_TERM",
    longTermOpportunityId: null,
    serviceRequestId: sr.id,
    serviceRequestStatus: sr.status,
    consultationTypeName: sr.consultationTypeName,
    scheduledDate: sr.scheduledDate,
    providerId: sr.providerId,
    providerName: sr.providerName,
    patientId: sr.patientId,
    patientName: sr.patientName,
    supervisorId: null,
    isEscrow: status !== "COMPLETED" && paymentMethod === "ONLINE",
    commissionPercent: pct,
    ...b,
  };
  if (existing) Object.assign(existing, row);
  else db.transactions.unshift(row);
}

function srView(sr: Row, a: Actor) {
  const p = sr.providerId ? db.findProvider(sr.providerId) : null;
  const patient = db.findPatient(sr.patientId);
  const isPatient = a.role === "PATIENT";
  const myReview = mdb.reviews.find((r) => r.serviceRequestId === sr.id && r.reviewerUserId === userIdOf(a));
  return {
    ...sr,
    startOtp: isPatient ? sr.startOtp ?? null : undefined,
    hasStartOtp: Boolean(sr.startOtp),
    destinationMapUrl: sr.destinationMapUrl ?? mapUrl(sr.latitude, sr.longitude),
    provider: p ? { ...providerCard(p), phone: p.username } : null,
    patient: patient ? { id: patient.id, name: db.patientName(patient), phone: patient.username, ...ratingOf(patient.userId, patient.id) } : null,
    checklist: p
      ? offeredServices(p).filter((s) => s.offered).map((s) => ({ ...s, done: (sr.checklistDone ?? []).includes(s.id) }))
      : [],
    reviewed: Boolean(myReview),
    myReview: myReview ?? null,
    feedbackGiven: mdb.feedbacks.some((f) => f.serviceRequestId === sr.id),
    events: sr.events ?? [],
  };
}

/** Auto-timeout: direct bookings nobody answered within AUTO_CANCEL_EXPIRY_AFTER_MINUTES expire. */
function sweepExpired() {
  const minutes = num(config("AUTO_CANCEL_EXPIRY_AFTER_MINUTES", "60"), 60);
  const cutoff = Date.now() - minutes * 60 * 1000;
  for (const sr of db.serviceRequests) {
    if (sr.source !== "APP" || sr.status !== "PENDING" || !sr.providerId) continue;
    if (new Date(sr.createdAt).getTime() > cutoff) continue;
    sr.status = "EXPIRED";
    logEvent(sr, "REQUEST_EXPIRED", "SYSTEM", null);
    const patient = db.findPatient(sr.patientId);
    const p = db.findProvider(sr.providerId);
    if (patient) notify(patient.userId, "Request expired", `${sr.providerName} did not respond in time. Please book another provider.`, "REQUEST_EXPIRED", { serviceRequestId: sr.id });
    if (p) notify(p.userId, "Request expired", `You did not respond to ${sr.patientName}'s request in time.`, "REQUEST_EXPIRED_PROVIDER", { serviceRequestId: sr.id });
  }
}

function completeServiceRequest(sr: Row, paymentMethod: "CASH" | "ONLINE") {
  sr.status = "COMPLETED";
  sr.paymentMethod = paymentMethod;
  sr.completedAt = now();
  if (sr.scheduleSlotId) setSlotStatus(sr.scheduleSlotId, "AVAILABLE");
  upsertTransaction(sr, "COMPLETED", paymentMethod);
  logEvent(sr, "SERVICE_COMPLETED", "PATIENT", sr.patientName, paymentMethod === "CASH" ? "Paid in cash" : "Paid online");
  const p = db.findProvider(sr.providerId);
  const patient = db.findPatient(sr.patientId);
  if (p) notify(p.userId, "Completion confirmed", `${sr.patientName} confirmed the service and paid ${paymentMethod === "CASH" ? "in cash" : "online"}.`, "COMPLETION_CONFIRMED", { serviceRequestId: sr.id });
  if (patient) notify(patient.userId, "Service completed", `Thanks! Please rate ${sr.providerName}.`, "SERVICE_COMPLETED", { serviceRequestId: sr.id });
}

// =============================================================== long-term helpers

function ltoOrThrow(id: unknown): Row {
  return db.longTermOpportunities.find((l) => l.id === Number(id)) ?? fail(404, "Long-term request not found");
}

/** `showOtp` only for the patient: the carer must get the start code from them. */
function ltoShifts(lto: Row, showOtp = false): Row[] {
  return (db.ltoSchedules.get(lto.id) ?? [])
    .map((r) => ({
      slotId: r.providerSchedule.id,
      date: r.providerSchedule.date,
      startTime: r.providerSchedule.startTime,
      endTime: r.providerSchedule.endTime,
      providerId: r.providerSchedule.providerId,
      providerName: r.providerSchedule.providerName,
      status: r.serviceRequest.status,
      fee: r.serviceRequest.fee,
      startedAt: r.serviceRequest.startedAt ?? null,
      completedAt: r.serviceRequest.completedAt ?? null,
      checklistDone: r.serviceRequest.checklistDone ?? [],
      cancelRequested: Boolean(r.serviceRequest.cancelRequested),
      hasStartOtp: Boolean(r.serviceRequest.startOtp),
      startOtp: showOtp ? r.serviceRequest.startOtp ?? null : undefined,
    }))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

function ltoPayable(lto: Row): number {
  const n = (db.ltoSchedules.get(lto.id) ?? []).length;
  return n > 0 ? n * num(lto.perShiftFee) : num(lto.fee);
}

function ltoView(lto: Row, forPatient = true) {
  return {
    ...lto,
    shifts: ltoShifts(lto, forPatient),
    payableAmount: money(ltoPayable(lto)),
    events: lto.events ?? [],
  };
}

function findShift(slotId: unknown): { lto: Row; row: Row } {
  for (const [ltoId, rows] of db.ltoSchedules.entries()) {
    const row = rows.find((r) => r.providerSchedule.id === Number(slotId));
    if (row) return { lto: ltoOrThrow(ltoId), row };
  }
  return fail(404, "Shift not found");
}

const PER_SHIFT_FEE: Record<number, number> = { 8: 1900, 12: 2600, 24: 4200 };

// =============================================================== auth

on("GET", "/demo/accounts", () => {
  const caregivers = db.providers.filter((p) => p.status === "ACTIVE" && providerCategory(p) === "CAREGIVER");
  const doctors = db.providers.filter((p) => p.status === "ACTIVE" && providerCategory(p) === "DOCTOR");
  const pendingProvider = db.providers.find((p) => p.status === "PENDING" && !p.registeredInApp);
  const fromApp = (rows: Row[]) => rows.filter((r) => r.registeredInApp);
  const pick = (p: Row, note: string) => ({ id: p.id, name: db.providerName(p), identifier: p.username, type: p.consultationTypeName, status: p.status, note });
  return {
    password: DEMO_PASSWORD,
    otp: DEMO_OTP,
    patients: [
      ...db.patients.filter((p) => p.status === "ACTIVE" && !p.registeredInApp).slice(0, 4),
      ...fromApp(db.patients),
    ].map((p) => ({ id: p.id, name: db.patientName(p), identifier: p.username, status: p.status, note: p.address })),
    providers: [
      ...caregivers.slice(0, 3).map((p) => pick(p, "Nurse / caregiver: long-term shifts")),
      ...doctors.slice(0, 2).map((p) => pick(p, "Doctor: home-visit bookings")),
      ...(pendingProvider ? [pick(pendingProvider, "Waiting for admin verification")] : []),
      ...fromApp(db.providers).map((p) => pick(p, "Registered from the app")),
    ],
  };
});

on("POST", "/users/login", ({ body }) => {
  const identifier = String(body?.identifier ?? "").trim();
  if (!isEmail(identifier) && !normalizePhone(identifier))
    fail(400, "Invalid identifier. Please provide a valid email address or Bangladeshi mobile number (e.g., 01712345678 or user@example.com)");
  const acc = findAccount(identifier);
  if (!acc || String(body?.password ?? "") !== (acc.row.password ?? DEMO_PASSWORD)) fail(400, "Invalid email/phone number or password");
  if (acc!.row.isActive === false) fail(403, "This account has been deactivated by admin");
  return session(acc!.role, acc!.row);
});

on("POST", "/auth/otp/request", ({ body }) => {
  const id = String(body?.mobileNumber ?? "").trim();
  const phone = normalizePhone(id);
  if (!phone && !isEmail(id)) fail(400, "Invalid identifier. Use a Bangladeshi mobile number (01XXXXXXXXX) or an email address.");
  if (body?.useFor === "REGISTRATION" && findAccount(id)) fail(400, "An account already exists with this phone/email. Please sign in.");
  return { message: `OTP sent to ${phone ?? id}. Demo OTP: ${DEMO_OTP}` };
});

on("POST", "/auth/otp/verify", ({ body }) => {
  if (String(body?.otpCode ?? "") !== DEMO_OTP) fail(400, "Invalid or expired OTP code");
  return { verificationToken: `verified:${normalizePhone(body?.mobileNumber) ?? String(body?.mobileNumber).toLowerCase()}` };
});

function checkRegistration(body: Row): string {
  const phone = normalizePhone(body?.mobileNumber);
  if (!phone) fail(400, "mobileNumber must be a valid Bangladeshi number. Example: 01712345678");
  if (body?.verificationToken !== `verified:${phone}`) fail(400, "Invalid or expired verification token. Verify your OTP again.");
  if (findAccount(phone)) fail(400, "Mobile number already registered. Please use a different mobile number.");
  if (body?.email && findAccount(body.email)) fail(400, "Email already registered. Please use a different email address.");
  if (String(body?.password ?? "").length < 8) fail(400, "Password must be at least 8 characters");
  if (!String(body?.firstName ?? "").trim() || !String(body?.lastName ?? "").trim()) fail(400, "First and last name are required");
  return phone!;
}

on("POST", "/auth/register/patient", ({ body }) => {
  const phone = checkRegistration(body);
  const nid = String(body?.nidNumber ?? "").trim();
  if (!/^\d{10}(\d{3}|\d{7})?$/.test(nid)) fail(400, "NID must be 10, 13 or 17 digits");
  if (db.patients.some((p) => p.nidNumber === nid)) fail(400, "NID number already registered");
  const status = config("DEFAULT_PATIENT_REGISTRATION_STATUS", "ACTIVE");
  const id = nextId(db.patients, 1);
  const patient: Row = {
    id,
    userId: Math.max(...db.patients.map((p) => p.userId)) + 1,
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    gender: body.gender ?? null,
    email: body.email?.trim() || undefined,
    username: phone,
    nidNumber: nid,
    isFaceVerified: false,
    status: ["PENDING", "ACTIVE", "REJECTED", "ARCHIVED"].includes(status) ? status : "ACTIVE",
    isActive: true,
    address: body.address?.trim() || "Dhanmondi, Dhaka",
    password: body.password,
    registeredInApp: true,
    createdAt: now(),
    updatedAt: now(),
  };
  db.patients.push(patient);
  notify(patient.userId, "Welcome to Caregiver BD", "Your account is ready. Book a doctor or request long-term care anytime.", "WELCOME");
  return session("PATIENT", patient);
});

on("POST", "/auth/register/provider", ({ body }) => {
  const phone = checkRegistration(body);
  const type = db.consultationTypes.find((t) => t.id === Number(body?.consultationTypeId));
  if (!type || type.parentId == null) fail(400, `Consultation type with ID ${body?.consultationTypeId} does not exist. Please pick a specialty.`);
  const id = nextId(db.providers, 1);
  const doctor = db.categoryOfType(type!.id) === "DOCTOR";
  const provider: Row = {
    id,
    userId: Math.max(...db.providers.map((p) => p.userId)) + 1,
    firstName: doctor && !/^dr\.?\s/i.test(body.firstName) ? `Dr. ${body.firstName.trim()}` : body.firstName.trim(),
    lastName: body.lastName.trim(),
    gender: body.gender ?? null,
    email: body.email?.trim() || `${phone}@caregiverbd.demo`,
    username: phone,
    bmdcNumber: null,
    experience: num(body.experience, 0),
    status: "PENDING",
    consultationTypeId: type!.id,
    consultationTypeName: type!.name,
    rate: money(doctor ? 1000 : 2200),
    billingRateType: doctor ? "CONSULTATION" : "SHIFT_8H",
    levelId: null,
    latitude: String(DEFAULT_LOCATION.latitude + 0.01),
    longitude: String(DEFAULT_LOCATION.longitude + 0.01),
    serviceRadiusKm: "8",
    supervisorId: null,
    profilePicture: null,
    acceptingRequests: true,
    password: body.password,
    registeredInApp: true,
    createdAt: now(),
    updatedAt: now(),
  };
  db.providers.push(provider);
  db.userDocuments.set(provider.userId, []);
  db.providerCertifications.set(provider.id, []);
  db.billingRates.set(provider.id, [
    { id: db.nextRateId(), providerId: id, amount: provider.rate, type: provider.billingRateType, validFrom: now(), validTo: null, createdAt: now() },
  ]);
  db.salaries.set(provider.id, []);
  notifyAdmin("New provider registration", `${db.providerName(provider)} (${type!.name}) registered from the app and needs verification.`, "PROVIDER_REGISTERED");
  notify(provider.userId, "Registration received", "Upload your documents and certifications. Admin will verify your profile.", "WELCOME");
  return session("PROVIDER", provider);
});

on("POST", "/auth/password-reset/request", () => ({ message: `If an account exists, an OTP has been sent. Demo OTP: ${DEMO_OTP}` }));
on("POST", "/auth/password-reset/verify-otp", ({ body }) => {
  if (String(body?.otpCode ?? "") !== DEMO_OTP) fail(400, "Invalid or expired OTP code");
  const acc = findAccount(body?.mobileNumber);
  if (!acc) fail(404, "User not found");
  return { verificationToken: `reset:${acc!.row.username}` };
});
on("POST", "/auth/password-reset/reset", ({ body }) => {
  const acc = findAccount(body?.mobileNumber);
  if (!acc) fail(404, "User not found");
  if (body?.verificationToken !== `reset:${acc!.row.username}`) fail(400, "Invalid verification token");
  if (String(body?.newPassword ?? "").length < 8) fail(400, "Password must be at least 8 characters");
  acc!.row.password = body.newPassword;
  return { message: "Password has been reset. Please sign in." };
});

on("PUT", "/users/profile/password", ({ query, body }) => {
  const a = actor(query);
  const row = a.role === "PATIENT" ? a.patient : a.provider;
  if (String(body?.currentPassword ?? "") !== (row.password ?? DEMO_PASSWORD)) fail(400, "Current password is incorrect");
  if (String(body?.newPassword ?? "").length < 8) fail(400, "New password must be at least 8 characters");
  if (body.newPassword === body.currentPassword) fail(400, "New password must be different from current password");
  row.password = body.newPassword;
  return { message: "Password updated" };
});

// =============================================================== shared

on("GET", "/consultation-types", () => {
  const roots = db.consultationTypes.filter((t) => t.parentId == null);
  return roots.map((r) => ({
    ...r,
    children: db.consultationTypes.filter((t) => t.parentId === r.id),
  }));
});
on("GET", "/consultation-types/:id/services", ({ params }) =>
  db.serviceChecklists
    .filter((c) => c.consultationTypeId === Number(params.id) && c.isActive)
    .map((c) => ({ id: c.id, label: c.name, displayOrder: c.displayOrder }))
);

on("GET", "/notifications", ({ query }) => {
  const userId = userIdOf(actor(query));
  const rows = mdb.userNotifications.filter((n) => n.userId === userId);
  return { data: rows.slice(0, 50), meta: { total: rows.length, unreadCount: rows.filter((n) => !n.readAt).length } };
});
on("PATCH", "/notifications/:id/read", ({ query, params }) => {
  const userId = userIdOf(actor(query));
  const n = mdb.userNotifications.find((x) => x.id === Number(params.id) && x.userId === userId) ?? fail(404, "Notification not found");
  n.readAt = n.readAt ?? now();
  return n;
});
on("POST", "/notifications/mark-all-read", ({ query }) => {
  const userId = userIdOf(actor(query));
  mdb.userNotifications.filter((n) => n.userId === userId && !n.readAt).forEach((n) => (n.readAt = now()));
  return { message: "All read" };
});


// reviews -------------------------------------------------------------

on("POST", "/reviews/service-request/:id", ({ query, params, body }) => {
  const a = actor(query);
  const sr = srOrThrow(params.id);
  if (sr.status !== "COMPLETED") fail(400, "You can review only after the service is completed");
  const p = db.findProvider(sr.providerId);
  const patient = db.findPatient(sr.patientId);
  const me = userIdOf(a);
  if (me !== p?.userId && me !== patient?.userId) fail(403, "You were not part of this service");
  if (mdb.reviews.some((r) => r.serviceRequestId === sr.id && r.reviewerUserId === me)) fail(400, "You already reviewed this service");
  const rating = num(body?.rating, 0);
  if (rating < 1 || rating > 5) fail(400, "Rating must be between 1 and 5");
  const toPatient = me === p?.userId;
  const review = {
    id: nextId(mdb.reviews, 1),
    serviceRequestId: sr.id,
    reviewerUserId: me,
    reviewerName: toPatient ? db.providerName(p) : db.patientName(patient),
    revieweeUserId: toPatient ? patient!.userId : p!.userId,
    revieweeName: toPatient ? db.patientName(patient) : db.providerName(p),
    rating,
    comment: String(body?.comment ?? "").slice(0, 1000) || null,
    createdAt: now(),
  };
  mdb.reviews.unshift(review);
  notify(review.revieweeUserId, "New review", `${review.reviewerName} rated you ${rating}★`, "REVIEW_RECEIVED", { serviceRequestId: sr.id });
  return review;
});
on("GET", "/reviews/my/received", ({ query }) => {
  const a = actor(query);
  const me = userIdOf(a);
  const seed = a.role === "PATIENT" ? a.patient.id : a.provider.registeredInApp ? 0 : a.provider.id;
  return { reviews: mdb.reviews.filter((r) => r.revieweeUserId === me), ...ratingOf(me, seed) };
});

// wallet & transactions (both roles) ----------------------------------

function providerWalletView(p: Row) {
  const w = db.providerWallet(p.id);
  const topups = mdb.walletTopups.filter((t) => t.providerId === p.id).reduce((s, t) => s + num(t.amount), 0);
  return { ...w, walletBalance: money(num(w.walletBalance) + topups), totalBalance: money(num(w.totalBalance) + topups) };
}

on("GET", "/financial/wallet/me", ({ query }) => {
  const a = actor(query);
  if (a.role === "PROVIDER") return providerWalletView(a.provider);
  const paid = db.transactions.filter((t) => t.patientId === a.patient.id && t.status === "COMPLETED" && t.type === "CONSULTATION_PAYMENT");
  return { totalSpent: money(paid.reduce((s, t) => s + num(t.totalFee), 0)), paymentsCount: paid.length, currency: "BDT" };
});

on("GET", "/financial/transactions/me", ({ query }) => {
  const a = actor(query);
  const rows = db.transactions.filter((t) => (a.role === "PATIENT" ? t.patientId === a.patient.id : t.providerId === a.provider.id));
  const topups =
    a.role === "PROVIDER"
      ? mdb.walletTopups.filter((t) => t.providerId === a.provider.id).map((t) => ({
          transactionId: t.id, date: t.createdAt, type: "WALLET_RECHARGE", status: "COMPLETED", paymentMethod: t.method,
          totalFee: num(t.amount), providerFee: num(t.amount), consultationTypeName: null, patientName: null, providerName: null,
        }))
      : [];
  const all = [...rows, ...topups].sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const pg = paginate(all, query.page, query.limit, 30);
  return { data: pg.items, meta: { total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages } };
});

// demo payment gateway (SSLCommerz stand-in) ---------------------------

on("POST", "/payments/demo/:attemptId/:result", ({ query, params }) => {
  const a = actor(query);
  const attempt = mdb.paymentAttempts.find((x) => x.id === Number(params.attemptId)) ?? fail(404, "Payment session not found");
  if (a.role !== "PATIENT" || attempt.patientId !== a.patient.id) fail(403, "Not your payment");
  if (attempt.status !== "INITIATED") fail(400, `This payment was already ${String(attempt.status).toLowerCase()}`);
  const result = String(params.result).toUpperCase();
  if (!["SUCCESS", "FAIL", "CANCEL"].includes(result)) fail(400, "Unknown payment result");
  attempt.status = result === "SUCCESS" ? "COMPLETED" : result === "FAIL" ? "FAILED" : "CANCELLED";
  attempt.callbacks = [...(attempt.callbacks ?? []), { callbackType: result.toLowerCase(), receivedAt: now() }];
  if (result !== "SUCCESS") return { status: attempt.status, message: result === "FAIL" ? "Payment failed. You can try again." : "Payment cancelled." };

  if (attempt.kind === "SERVICE_REQUEST") {
    const sr = srOrThrow(attempt.referenceId);
    if (sr.status === "PAYMENT_PENDING") completeServiceRequest(sr, "ONLINE");
  } else {
    const lto = ltoOrThrow(attempt.referenceId);
    if (lto.status === "PAYMENT_PENDING") markLtoPaid(lto, db.findPatient(attempt.patientId)!);
  }
  return { status: "COMPLETED", message: "Payment successful" };
});

function startPayment(patient: Row, kind: "SERVICE_REQUEST" | "LONG_TERM", referenceId: number, amount: number) {
  const attempt = {
    id: nextId(mdb.paymentAttempts, 1),
    kind,
    referenceId,
    patientId: patient.id,
    amount: money(amount),
    gateway: "SSLCOMMERZ",
    status: "INITIATED",
    createdAt: now(),
    callbacks: [],
  };
  mdb.paymentAttempts.unshift(attempt);
  return { paymentAttemptId: attempt.id, amount: attempt.amount, gateway: "SSLCOMMERZ", gatewayUrl: `demo://sslcommerz/${attempt.id}` };
}

// =============================================================== patient

on("GET", "/patients/me", ({ query }) => {
  const p = mePatient(query, false);
  const mine = db.serviceRequests.filter((s) => s.patientId === p.id);
  return {
    ...p,
    password: undefined,
    name: db.patientName(p),
    ...ratingOf(p.userId, p.id),
    counts: {
      active: mine.filter((s) => ACTIVE_SR.includes(s.status) || s.status === "PAYMENT_PENDING").length,
      completed: mine.filter((s) => s.status === "COMPLETED").length,
      longTerm: db.longTermOpportunities.filter((l) => l.patientId === p.id).length,
    },
  };
});
on("PUT", "/patients/me", ({ query, body }) => {
  const p = mePatient(query, false);
  for (const k of ["firstName", "lastName", "address", "email", "gender"]) {
    if (body?.[k] !== undefined) p[k] = String(body[k]).trim() || p[k];
  }
  p.updatedAt = now();
  return p;
});

on("POST", "/providers/search", ({ query, body }) => {
  const a = actor(query);
  const patient = a.role === "PATIENT" ? a.patient : undefined;
  const from = {
    latitude: num(body?.latitude, DEFAULT_LOCATION.latitude),
    longitude: num(body?.longitude, DEFAULT_LOCATION.longitude),
  };
  const today = ymd(new Date());
  const date = body?.date && String(body.date) >= today ? String(body.date) : undefined;
  if (body?.date && !date) fail(400, "Past dates are not allowed. Pick today or a future date.");
  const time = body?.time || undefined;
  const typeIds: number[] = (body?.consultationTypeId ?? []).map(Number);
  const levelIds: number[] = (body?.levelId ?? []).map(Number);
  const radius = num(body?.radiusKm, 20);
  const rows = db.providers
    .filter((p) => p.status === "ACTIVE" && p.acceptingRequests !== false)
    .filter((p) => !typeIds.length || typeIds.includes(p.consultationTypeId))
    .filter((p) => !levelIds.length || levelIds.includes(p.levelId))
    .map((p) => ({ p, card: providerCard(p, from, patient) }))
    .filter(({ p, card }) => card.distance! <= (num(p.serviceRadiusKm, 0) || radius) && card.distance! <= radius)
    .map(({ p, card }) => ({ ...card, availableSlots: futureSlots(p, date, time).slice(0, 12).map((s) => ({ ...s, fee: money(feeFor(p, s)) })) }))
    .filter((c) => (!date && !time) || c.availableSlots.length > 0)
    .sort((x, y) => (x.distance ?? 0) - (y.distance ?? 0));
  const pg = paginate(rows, body?.page, body?.limit, 20);
  return { data: pg.items, meta: { total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages, radiusKm: radius } };
});

on("POST", "/providers/:id/search", ({ query, params, body }) => {
  const a = actor(query);
  const p = db.findProvider(params.id);
  if (!p || p.status !== "ACTIVE") fail(404, "Provider not found");
  const from = { latitude: num(body?.latitude, DEFAULT_LOCATION.latitude), longitude: num(body?.longitude, DEFAULT_LOCATION.longitude) };
  return {
    ...providerCard(p!, from, a.role === "PATIENT" ? a.patient : undefined),
    availableSlots: futureSlots(p!, body?.date || undefined, body?.time || undefined).map((s) => ({ ...s, fee: money(feeFor(p!, s)) })),
    offeredServices: offeredServices(p!),
    reviews: mdb.reviews.filter((r) => r.revieweeUserId === p!.userId).slice(0, 10),
    feedbacks: mdb.feedbacks.filter((f) => f.providerId === p!.id).slice(0, 10),
  };
});

on("GET", "/patients/me/liked-providers", ({ query }) => {
  const patient = mePatient(query);
  const rows = mdb.likedProviders
    .filter((l) => l.patientId === patient.id)
    .map((l) => ({ l, p: db.findProvider(l.providerId) }))
    .filter(({ p }) => p?.status === "ACTIVE")
    .map(({ l, p }) => ({ ...providerCard(p!, DEFAULT_LOCATION, patient), likedAt: l.likedAt }));
  return { data: rows, meta: { total: rows.length, page: 1, limit: rows.length, totalPages: 1 } };
});
on("POST", "/patients/me/liked-providers/:id", ({ query, params }) => {
  const patient = mePatient(query);
  if (!db.findProvider(params.id)) fail(404, "Provider not found");
  if (mdb.likedProviders.some((l) => l.patientId === patient.id && l.providerId === Number(params.id)))
    return { message: "Provider already liked", providerId: Number(params.id) };
  mdb.likedProviders.push({ patientId: patient.id, providerId: Number(params.id), likedAt: now() });
  return { message: "Provider liked", providerId: Number(params.id) };
});
on("DELETE", "/patients/me/liked-providers/:id", ({ query, params }) => {
  const patient = mePatient(query);
  const i = mdb.likedProviders.findIndex((l) => l.patientId === patient.id && l.providerId === Number(params.id));
  if (i < 0) fail(404, "No like found for this provider");
  mdb.likedProviders.splice(i, 1);
  return null;
});

// short-term booking ----------------------------------------------------

on("POST", "/service-requests", ({ query, body }) => {
  const patient = mePatient(query);
  const type = db.consultationTypes.find((t) => t.id === Number(body?.consultationTypeId));
  if (!type) fail(400, `Consultation type with ID ${body?.consultationTypeId} does not exist.`);
  const provider = body?.providerId ? db.findProvider(body.providerId) : null;
  if (body?.providerId && (!provider || provider.status !== "ACTIVE")) fail(400, "Provider not found or not active");
  if (provider && provider.consultationTypeId !== type!.id) fail(400, "This provider does not offer the selected service");
  if (provider && provider.acceptingRequests === false)
    fail(400, "This provider is not accepting new requests at the moment. Please try another provider or try again later.");
  if (provider && mdb.providerPatientRejections.some((r) => r.providerId === provider.id && r.patientId === patient.id))
    fail(400, "This provider is not available for your requests. Please choose another provider.");

  let slot: Row | null = null;
  let scheduledAt: string | null = body?.scheduledAt ?? null;
  if (body?.scheduleSlotId) {
    slot = mdb.providerSlots.find((s) => s.id === Number(body.scheduleSlotId)) ?? null;
    if (!slot || slot.status !== "AVAILABLE") fail(400, "This time slot is no longer available. Please pick another one.");
    if (provider && slot!.providerId !== provider.id) fail(400, "The selected slot does not belong to this provider");
    if (slotStart(slot!).getTime() < Date.now()) fail(400, "The selected slot is in the past");
    scheduledAt = iso(slotStart(slot!));
    const dup = db.serviceRequests.find((s) => s.patientId === patient.id && s.scheduleSlotId === slot!.id && ACTIVE_SR.includes(s.status));
    if (dup) fail(400, `You already have a ${dup.status} service request for this time slot (${slot!.startTime}). Please choose a different time slot or cancel your existing request first.`);
  }
  if (scheduledAt) {
    const clash = db.serviceRequests.find((s) => s.patientId === patient.id && s.scheduledAt === scheduledAt && ACTIVE_SR.includes(s.status));
    if (clash) fail(400, `You already have a ${clash.status} service request scheduled for ${new Date(scheduledAt).toLocaleString()}. You cannot book another service at the same time.`);
  }

  const lat = num(body?.latitude, DEFAULT_LOCATION.latitude);
  const lng = num(body?.longitude, DEFAULT_LOCATION.longitude);
  const fee = provider ? feeFor(provider, slot) : 0;
  const when = scheduledAt ? new Date(scheduledAt) : new Date();
  const sr: Row = {
    id: nextId(db.serviceRequests, 6000),
    status: "PENDING",
    source: "APP",
    patientId: patient.id,
    patientName: db.patientName(patient),
    providerId: provider?.id ?? null,
    providerName: provider ? db.providerName(provider) : null,
    consultationTypeId: type!.id,
    consultationTypeName: type!.name,
    amount: money(fee),
    fee: money(fee),
    billingRateId: provider ? (db.billingRates.get(provider.id) ?? []).find((r) => !r.validTo)?.id ?? null : null,
    paymentMethod: null,
    scheduledAt,
    scheduledDate: ymd(when),
    scheduledTime: slot?.startTime ?? `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`,
    endTime: slot?.endTime ?? null,
    scheduleSlotId: slot?.id ?? null,
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6),
    address: String(body?.address ?? patient.address),
    description: body?.description || null,
    beneficiaryType: body?.beneficiaryType ?? "SELF",
    beneficiaryDependentName: body?.beneficiaryDependentName ?? null,
    destinationMapUrl: mapUrl(lat.toFixed(6), lng.toFixed(6)),
    startedAt: null,
    completedAt: null,
    createdAt: now(),
    updatedAt: now(),
    longTermOpportunityId: null,
    checklistDone: [],
    declinedBy: [],
    events: [],
  };
  logEvent(sr, "REQUEST_CREATED", "PATIENT", sr.patientName);
  db.serviceRequests.unshift(sr);
  if (provider) {
    upsertTransaction(sr, "PENDING", null);
    notify(provider.userId, "New service request", `${sr.patientName} booked you for ${sr.scheduledDate} ${sr.scheduledTime}.`, "NEW_REQUEST", { serviceRequestId: sr.id });
  }
  return srView(sr, { role: "PATIENT", patient });
});

on("GET", "/service-requests/patient/my-requests", ({ query }) => {
  const patient = mePatient(query, false);
  sweepExpired();
  const rows = db.serviceRequests.filter((s) => s.patientId === patient.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pg = paginate(rows, query.page, query.limit, 50);
  return { data: pg.items.map((s) => srView(s, { role: "PATIENT", patient })), meta: { total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages } };
});

on("POST", "/service-requests/:id/cancel", ({ query, params, body }) => {
  const patient = mePatient(query);
  const sr = srOrThrow(params.id);
  if (sr.patientId !== patient.id) fail(403, "Not your request");
  if (!["PENDING", "ACCEPTED", "ON_THE_WAY"].includes(sr.status)) fail(400, `A ${sr.status} request cannot be cancelled`);
  sr.status = "CANCELLED";
  sr.cancelledAt = now();
  sr.cancelReason = body?.reason || null;
  if (sr.scheduleSlotId) setSlotStatus(sr.scheduleSlotId, "AVAILABLE");
  const tx = txFor(sr);
  if (tx) tx.status = "CANCELLED";
  logEvent(sr, "REQUEST_CANCELLED", "PATIENT", sr.patientName, sr.cancelReason);
  const p = db.findProvider(sr.providerId);
  if (p) notify(p.userId, "Request cancelled", `${sr.patientName} cancelled the ${sr.scheduledDate} ${sr.scheduledTime} request.`, "REQUEST_CANCELLED", { serviceRequestId: sr.id });
  return srView(sr, { role: "PATIENT", patient });
});

on("POST", "/service-requests/:id/regenerate-start-otp", ({ query, params }) => {
  const patient = mePatient(query);
  const sr = srOrThrow(params.id);
  if (sr.patientId !== patient.id) fail(403, "Not your request");
  if (sr.status !== "ON_THE_WAY" || !sr.startOtp) fail(400, "The provider has not requested a start OTP yet");
  const cooldown = num(config("OTP_RESEND_COOLDOWN_SECONDS", "60"), 60);
  const wait = Math.ceil(cooldown - (Date.now() - new Date(sr.startOtpSentAt).getTime()) / 1000);
  if (wait > 0) fail(400, `Please wait ${wait}s before generating a new OTP`);
  sr.startOtp = String(Math.floor(100000 + Math.random() * 900000));
  sr.startOtpSentAt = now();
  return { message: "New OTP generated", otp: sr.startOtp };
});

on("POST", "/service-requests/:id/confirm-completion", ({ query, params, body }) => {
  const patient = mePatient(query);
  const sr = srOrThrow(params.id);
  if (sr.patientId !== patient.id) fail(403, "Not your request");
  if (sr.status !== "PAYMENT_PENDING") fail(400, "Request must be PAYMENT_PENDING");
  const method = body?.paymentMethod === "ONLINE" ? "ONLINE" : "CASH";
  if (method === "CASH") {
    completeServiceRequest(sr, "CASH");
    return { serviceRequest: srView(sr, { role: "PATIENT", patient }) };
  }
  upsertTransaction(sr, "PENDING", "ONLINE");
  return { serviceRequest: srView(sr, { role: "PATIENT", patient }), ...startPayment(patient, "SERVICE_REQUEST", sr.id, num(sr.fee)) };
});

on("POST", "/feedback", ({ query, body }) => {
  const patient = mePatient(query);
  const sr = srOrThrow(body?.serviceRequestId);
  if (sr.patientId !== patient.id || sr.status !== "COMPLETED") fail(400, "Feedback is allowed only on your completed services");
  if (mdb.feedbacks.some((f) => f.serviceRequestId === sr.id)) fail(400, "Feedback already submitted for this service");
  const text = String(body?.feedback ?? "").trim();
  if (!text) fail(400, "Please write some feedback");
  const row = { id: nextId(mdb.feedbacks, 1), serviceRequestId: sr.id, providerId: sr.providerId, patientId: patient.id, patientName: db.patientName(patient), feedback: text.slice(0, 1000), createdAt: now() };
  mdb.feedbacks.unshift(row);
  return row;
});

// vitals ------------------------------------------------------------------

function ensureVitals(patient: Row) {
  if (mdb.vitals.some((v) => v.patientId === patient.id)) return;
  for (let i = 13; i >= 1; i--) {
    const s = patient.id + i;
    mdb.vitals.push({
      id: nextId(mdb.vitals, 1),
      patientId: patient.id,
      recordedAt: ymd(dayOffset(-i)),
      bloodPressureSystolic: 116 + ((s * 7) % 22),
      bloodPressureDiastolic: 74 + ((s * 3) % 12),
      bloodSugar: Math.round((5.2 + ((s * 5) % 9) * 0.3) * 10) / 10,
      steps: 2500 + ((s * 911) % 5200),
      waterIntake: 1.5 + ((s % 5) * 0.25),
    });
  }
}

on("POST", "/patient-vitals", ({ query, body }) => {
  const patient = mePatient(query);
  const day = parseDay(body?.recordedAt);
  if (!day) fail(400, "recordedAt is required (YYYY-MM-DD)");
  ensureVitals(patient);
  const date = ymd(day!);
  let row = mdb.vitals.find((v) => v.patientId === patient.id && v.recordedAt === date);
  if (!row) {
    row = { id: nextId(mdb.vitals, 1), patientId: patient.id, recordedAt: date };
    mdb.vitals.push(row);
  }
  for (const k of ["bloodPressureSystolic", "bloodPressureDiastolic", "bloodSugar", "steps", "waterIntake"]) {
    if (body?.[k] !== undefined && body[k] !== "" && body[k] !== null) row[k] = num(body[k]);
  }
  return row;
});

on("GET", "/patient-vitals/me/range", ({ query }) => {
  const patient = mePatient(query);
  ensureVitals(patient);
  const end = query.endDate ?? ymd(new Date());
  const start = query.startDate ?? ymd(dayOffset(-29));
  const rows = mdb.vitals
    .filter((v) => v.patientId === patient.id && v.recordedAt >= start && v.recordedAt <= end)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const avg = (k: string) => {
    const vals = rows.map((r) => r[k]).filter((x) => x != null);
    return vals.length ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10 : null;
  };
  const series = (k: string) => ({ history: rows.filter((r) => r[k] != null).map((r) => ({ date: r.recordedAt, value: r[k] })), avg: avg(k) });
  return {
    bloodSugar: series("bloodSugar"),
    bloodPressure: {
      history: rows.filter((r) => r.bloodPressureSystolic != null).map((r) => ({ date: r.recordedAt, systolic: r.bloodPressureSystolic, diastolic: r.bloodPressureDiastolic })),
      avg: { systolic: avg("bloodPressureSystolic"), diastolic: avg("bloodPressureDiastolic") },
    },
    steps: series("steps"),
    waterIntake: series("waterIntake"),
    startDate: start,
    endDate: end,
  };
});

// long-term care ------------------------------------------------------------

on("POST", "/long-term-opportunities", ({ query, body }) => {
  const patient = mePatient(query);
  const type = db.consultationTypes.find((t) => t.id === Number(body?.consultationTypeId));
  if (!type || db.categoryOfType(type.id) !== "CAREGIVER" || type.parentId == null) fail(400, "Pick a nursing or caregiver service for long-term care");
  const start = parseDay(body?.startDate);
  const end = parseDay(body?.endDate);
  if (!start || !end) fail(400, "Start and end dates are required");
  if (ymd(start!) < ymd(new Date())) fail(400, "Start date cannot be in the past");
  if (end! < start!) fail(400, "End date must be on or after the start date");
  const days = eachDay(start!, end!).length;
  if (days > 60) fail(400, "Long-term requests can cover at most 60 days");
  const shiftDurationHours = [8, 12, 24].includes(num(body?.shiftDurationHours)) ? num(body.shiftDurationHours) : 12;
  const startHour = Math.min(23, Math.max(0, num(body?.startHour, 8)));
  const perShift = PER_SHIFT_FEE[shiftDurationHours];
  const id = nextId(db.longTermOpportunities, 901);
  const lto: Row = {
    id,
    status: "REQUESTED",
    source: "APP",
    requestNo: `LTO-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: db.patientName(patient),
    patient: { id: patient.id, firstName: patient.firstName, lastName: patient.lastName },
    consultationTypeId: type!.id,
    consultationTypeName: type!.name,
    serviceAddressText: String(body?.serviceAddressText || patient.address),
    fee: money(perShift * days),
    preferredStartTime: `${startHour % 12 === 0 ? 12 : startHour % 12}:00 ${startHour >= 12 ? "PM" : "AM"}`,
    shiftDurationHours,
    startDate: ymd(start!),
    endDate: ymd(end!),
    assignedNurses: [],
    supervisorId: null,
    supervisorName: null,
    perShiftFee: perShift,
    startHour,
    notes: String(body?.notes ?? "").trim(),
    beneficiaryName: body?.beneficiaryName || null,
    createdAt: now(),
    events: [],
  };
  logEvent(lto, "REQUESTED", "PATIENT", lto.patientName);
  db.longTermOpportunities.unshift(lto);
  db.ltoSchedules.set(id, []);
  notifyAdmin("Long-term request", `New ${days}-day ${type!.name} request from ${lto.patientName} (${lto.serviceAddressText}).`, "LONG_TERM_REQUESTED");
  return ltoView(lto);
});

on("GET", "/long-term-opportunities/patient/my", ({ query }) => {
  const patient = mePatient(query, false);
  return db.longTermOpportunities
    .filter((l) => l.patientId === patient.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((l) => ltoView(l));
});

on("GET", "/long-term-opportunities/:id", ({ query, params }) => {
  const a = actor(query);
  const lto = ltoOrThrow(params.id);
  if (a.role === "PATIENT" && lto.patientId !== a.patient.id) fail(403, "Not your request");
  if (a.role === "PROVIDER" && !ltoShifts(lto).some((s) => s.providerId === a.provider.id)) fail(403, "You are not assigned to this request");
  return ltoView(lto, a.role === "PATIENT");
});

function patientLto(query: Record<string, any>, id: unknown) {
  const patient = mePatient(query);
  const lto = ltoOrThrow(id);
  if (lto.patientId !== patient.id) fail(403, "Not your request");
  return { patient, lto };
}

on("POST", "/long-term-opportunities/:id/accept-schedule", ({ query, params }) => {
  const { lto } = patientLto(query, params.id);
  if (lto.status !== "SCHEDULE_PROPOSED") fail(400, "There is no proposed schedule to accept yet");
  if (!ltoShifts(lto).length) fail(400, "The proposed schedule has no shifts");
  lto.fee = money(ltoPayable(lto));
  lto.status = "PAYMENT_PENDING";
  logEvent(lto, "SCHEDULE_ACCEPTED", "PATIENT", lto.patientName);
  return ltoView(lto);
});

on("POST", "/long-term-opportunities/:id/request-change", ({ query, params, body }) => {
  const { lto } = patientLto(query, params.id);
  if (!["SCHEDULE_PROPOSED", "PAYMENT_PENDING"].includes(lto.status)) fail(400, "Changes can be requested only on a proposed schedule");
  const note = String(body?.note ?? "").trim();
  if (!note) fail(400, "Tell us what should change");
  lto.status = "CHANGE_REQUESTED";
  lto.changeRequestNote = note;
  lto.notes = [lto.notes, `Patient change request: ${note}`].filter(Boolean).join("\n");
  logEvent(lto, "CHANGE_REQUESTED", "PATIENT", lto.patientName, note);
  notifyAdmin("Schedule change requested", `${lto.patientName} asked to change ${lto.requestNo}: "${note}"`, "LONG_TERM_REQUESTED");
  return ltoView(lto);
});

on("POST", "/long-term-opportunities/:id/pay", ({ query, params }) => {
  const { patient, lto } = patientLto(query, params.id);
  if (lto.status !== "PAYMENT_PENDING") fail(400, "This request is not waiting for payment");
  return { ...startPayment(patient, "LONG_TERM", lto.id, ltoPayable(lto)), opportunity: ltoView(lto) };
});

function markLtoPaid(lto: Row, patient: Row) {
  lto.status = "PAID";
  lto.paidAt = now();
  lto.fee = money(ltoPayable(lto));
  logEvent(lto, "PAID", "PATIENT", lto.patientName, `৳${lto.fee} paid online`);
  const pct = commissionPercent(lto.consultationTypeId);
  const nurses = new Set<number>();
  for (const r of db.ltoSchedules.get(lto.id) ?? []) {
    const p = db.findProvider(r.providerSchedule.providerId);
    nurses.add(r.providerSchedule.providerId);
    db.transactions.unshift({
      transactionId: nextId(db.transactions, 10000, "transactionId"),
      date: `${r.providerSchedule.date}T${r.providerSchedule.startTime}:00`,
      type: "CONSULTATION_PAYMENT",
      status: "PENDING",
      paymentMethod: "ONLINE",
      serviceType: "LONG_TERM",
      longTermOpportunityId: lto.id,
      serviceRequestId: r.serviceRequest.id,
      serviceRequestStatus: r.serviceRequest.status,
      consultationTypeName: lto.consultationTypeName,
      scheduledDate: r.providerSchedule.date,
      providerId: p?.id ?? null,
      providerName: db.providerName(p),
      patientId: patient.id,
      patientName: lto.patientName,
      supervisorId: lto.supervisorId,
      isEscrow: true,
      commissionPercent: pct,
      ...db.feeBreakdown(num(lto.perShiftFee), pct, lto.supervisorId != null),
    });
  }
  for (const id of nurses) {
    const p = db.findProvider(id);
    if (p) notify(p.userId, "Long-term booking confirmed", `${lto.patientName} paid for ${lto.requestNo}. Your shifts are confirmed.`, "LONG_TERM_CONFIRMED", { longTermOpportunityId: lto.id });
  }
  notifyAdmin("Payment received", `Payment of ৳${lto.fee} received for ${lto.requestNo}.`, "PAYMENT_RECEIVED");
}

on("POST", "/long-term-opportunities/:id/cancel", ({ query, params, body }) => {
  const { patient, lto } = patientLto(query, params.id);
  if (!["REQUESTED", "SCHEDULE_PROPOSED", "CHANGE_REQUESTED", "PAYMENT_PENDING", "PAID"].includes(lto.status))
    fail(400, `A ${lto.status} request cannot be cancelled from the app. Please contact support.`);
  const wasPaid = lto.status === "PAID";
  lto.status = "CANCELLED";
  lto.cancelledAt = now();
  logEvent(lto, "CANCELLED", "PATIENT", lto.patientName, body?.reason || null);
  for (const r of db.ltoSchedules.get(lto.id) ?? []) r.serviceRequest.status = "CANCELLED";
  for (const t of db.transactions.filter((x) => x.longTermOpportunityId === lto.id)) t.status = "CANCELLED";
  if (wasPaid) {
    const fee = num(lto.fee);
    const feeAmount = Math.round(fee * 0.1);
    db.refunds.unshift({
      cancellation: {
        id: nextId(db.refunds.map((r) => r.cancellation), 600),
        cancelledAt: now(), scope: "LONG_TERM", serviceRequestId: null, longTermOpportunityId: lto.id,
        actor: "PATIENT", actorUserId: patient.userId, actorName: lto.patientName, stage: "PRE_SERVICE",
        statusAtCancel: "PAID", reasonCategory: "OTHER", reasonNote: body?.reason || "Cancelled from the patient app",
        feeAmount: money(feeAmount), refundAmount: money(fee - feeAmount), refundMethod: "GATEWAY", adminNotes: null,
      },
      refundTransaction: {
        id: nextId(db.refunds.map((r) => r.refundTransaction), 8800), status: "PENDING", amount: money(fee - feeAmount),
        paymentMethod: "ONLINE", referenceId: String(lto.id), referenceType: "LONG_TERM", longTermOpportunityId: lto.id,
        patientId: patient.id, providerId: null, patientName: lto.patientName, providerName: null,
        gatewayRefundRefId: null, gatewayRefundStatus: "PROCESSING", purpose: "CANCELLATION_REFUND", adminEscalated: false,
        createdAt: now(), updatedAt: now(),
      },
    });
    notifyAdmin("Long-term booking cancelled", `${lto.patientName} cancelled paid booking ${lto.requestNo}. Refund ৳${money(fee - feeAmount)} pending.`, "REFUND_PENDING");
  }
  return ltoView(lto);
});

// =============================================================== provider

on("GET", "/providers/me", ({ query }) => {
  const p = meProvider(query, false);
  const certs = db.providerCertifications.get(p.id) ?? [];
  const docs = db.userDocuments.get(p.userId) ?? [];
  const level = db.levels.find((l) => l.id === p.levelId);
  const type = db.consultationTypes.find((t) => t.id === p.consultationTypeId);
  const root = type?.parentId ?? type?.id;
  const roleLabel =
    root === 6 ? `Certified Nurse · ${p.consultationTypeName}`
    : root === 10 ? `Certified Caregiver · ${p.consultationTypeName}`
    : root === 13 ? "Physiotherapist"
    : `${p.consultationTypeName}${p.bmdcNumber ? ` · BMDC ${p.bmdcNumber}` : ""}`;
  return {
    ...providerCard(p),
    roleLabel,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.username,
    email: p.email,
    latitude: p.latitude,
    longitude: p.longitude,
    locationUpdatedAt: p.locationUpdatedAt ?? null,
    serviceRadiusKm: num(p.serviceRadiusKm, 0) || null,
    maxServiceRadiusKm: num(config("PROVIDER_MAX_SERVICE_RADIUS_KM", "15"), 15),
    levelName: level?.name ?? null,
    supervisorName: (() => {
      const s = db.supervisors.find((x) => x.id === p.supervisorId);
      return s ? `${s.firstName} ${s.lastName}` : null;
    })(),
    verification: { ...onboardingProgress(p), certifications: certs.length, documentsApproved: docs.filter((d) => d.status === "APPROVED").length },
    submittedForReviewAt: p.submittedForReviewAt ?? null,
  };
});

on("PATCH", "/providers/me/availability", ({ query, body }) => {
  const p = meProvider(query, false);
  p.acceptingRequests = Boolean(body?.acceptingRequests);
  return { acceptingRequests: p.acceptingRequests };
});

on("PUT", "/providers/location", ({ query, body }) => {
  const p = meProvider(query);
  const lat = num(body?.latitude, NaN);
  const lng = num(body?.longitude, NaN);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) fail(400, "Invalid coordinates");
  p.latitude = lat.toFixed(6);
  p.longitude = lng.toFixed(6);
  p.locationUpdatedAt = now();
  return { latitude: p.latitude, longitude: p.longitude, locationUpdatedAt: p.locationUpdatedAt };
});

on("PUT", "/providers/service-radius", ({ query, body }) => {
  const p = meProvider(query);
  const r = num(body?.serviceRadiusKm, 0);
  const max = num(config("PROVIDER_MAX_SERVICE_RADIUS_KM", "15"), 15);
  if (r < 0.1) fail(400, "Radius must be at least 0.1 km");
  if (r > max) fail(400, `Radius cannot be more than ${max} km`);
  p.serviceRadiusKm = String(r);
  return { serviceRadiusKm: r };
});

on("GET", "/providers/billing-rate/history", ({ query }) => {
  const p = meProvider(query);
  const rows = [...(db.billingRates.get(p.id) ?? [])].sort((a, b) => String(b.validFrom).localeCompare(String(a.validFrom)));
  return { currentRate: rows.find((r) => !r.validTo) ?? null, history: rows.filter((r) => r.validTo), employmentType: employmentType(p) };
});
on("PUT", "/providers/billing-rate", ({ query, body }) => {
  const p = meProvider(query);
  if (employmentType(p) === "SALARIED") fail(403, "Your rate is managed by Caregiver BD admin");
  const amount = num(body?.amount, 0);
  if (amount < 100) fail(400, "Fee must be at least ৳100");
  const rows = db.billingRates.get(p.id) ?? [];
  rows.filter((r) => !r.validTo).forEach((r) => (r.validTo = now()));
  rows.push({ id: db.nextRateId(), providerId: p.id, amount: money(amount), type: p.billingRateType, validFrom: now(), validTo: null, createdAt: now() });
  db.billingRates.set(p.id, rows);
  p.rate = money(amount);
  return { message: "Fee updated. New bookings use the new fee; existing bookings keep their locked fee." };
});

on("GET", "/providers/me/consultation-services", ({ query }) => offeredServices(meProvider(query, false)));
on("PUT", "/providers/me/consultation-services", ({ query, body }) => {
  const p = meProvider(query);
  const valid = new Set(offeredServices(p).map((s) => s.id));
  p.excludedServiceIds = (body?.excludedServiceIds ?? []).map(Number).filter((id: number) => valid.has(id));
  return offeredServices(p);
});

// schedule -------------------------------------------------------------------

on("GET", "/providers/me/schedule", ({ query }) => {
  const p = meProvider(query, false);
  ensureSlots(p);
  const start = query.startDate ?? ymd(new Date());
  const end = query.endDate ?? ymd(dayOffset(13));
  return mdb.providerSlots
    .filter((s) => s.providerId === p.id && s.date >= start && s.date <= end)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
});

on("PUT", "/providers/me/schedule", ({ query, body }) => {
  const p = meProvider(query);
  ensureSlots(p);
  const incoming: Row[] = body?.slots ?? [];
  const overlap = (a: Row, b: Row) => a.date === b.date && a.startTime < b.endTime && b.startTime < a.endTime;
  incoming.forEach((s, i) => {
    if (!parseDay(s.date) || !/^\d{2}:\d{2}$/.test(s.startTime) || !/^\d{2}:\d{2}$/.test(s.endTime)) fail(400, "Each slot needs a date and HH:MM start/end time");
    if (s.endTime <= s.startTime) fail(400, `End time must be after start time (${s.startTime}-${s.endTime})`);
    if (s.date < ymd(new Date())) fail(400, "You cannot add slots in the past");
    incoming.slice(i + 1).forEach((o) => {
      if (overlap(s, o)) fail(400, `Overlapping slots on ${s.date}: ${s.startTime}-${s.endTime} overlaps with ${o.startTime}-${o.endTime}`);
    });
    const existing = mdb.providerSlots.find((x) => x.providerId === p.id && x.id !== Number(s.id) && overlap(x, s));
    if (existing) fail(400, `Cannot create schedule slot ${s.startTime}-${s.endTime} on ${s.date}. It overlaps with existing slot ${existing.startTime}-${existing.endTime}`);
  });
  for (const s of incoming) {
    const row = s.id ? mdb.providerSlots.find((x) => x.id === Number(s.id) && x.providerId === p.id) : null;
    if (row) {
      if (row.status === "BOOKED") fail(400, "A booked slot cannot be changed");
      Object.assign(row, { date: s.date, startTime: s.startTime, endTime: s.endTime });
    } else {
      mdb.providerSlots.push({ id: nextId(mdb.providerSlots, 40000), providerId: p.id, date: s.date, startTime: s.startTime, endTime: s.endTime, status: "AVAILABLE" });
    }
  }
  p.scheduleManaged = true;
  return { message: "Schedule saved" };
});

on("DELETE", "/providers/me/schedule/slots", ({ query }) => {
  const p = meProvider(query);
  ensureSlots(p);
  const ids = String(query.ids ?? "").split(",").map(Number).filter(Boolean);
  for (const id of ids) {
    const i = mdb.providerSlots.findIndex((s) => s.id === id && s.providerId === p.id);
    if (i < 0) continue;
    if (mdb.providerSlots[i].status === "BOOKED") fail(400, "A booked slot cannot be deleted");
    mdb.providerSlots.splice(i, 1);
  }
  p.scheduleManaged = true;
  return { message: "Deleted" };
});

on("PATCH", "/providers/me/schedule/slots/:id/block", ({ query, params, body }) => {
  const p = meProvider(query);
  const slot = mdb.providerSlots.find((s) => s.id === Number(params.id) && s.providerId === p.id) ?? fail(404, "Slot not found");
  if (slot.status === "BOOKED") fail(400, "A booked slot cannot be blocked");
  slot.status = body?.blocked ? "BLOCKED" : "AVAILABLE";
  p.scheduleManaged = true;
  return slot;
});

// short-term jobs -----------------------------------------------------------------

on("GET", "/service-requests/provider/my-requests", ({ query }) => {
  const p = meProvider(query, false);
  sweepExpired();
  const rows = db.serviceRequests
    .filter((s) => s.providerId === p.id)
    .sort((a, b) => String(b.scheduledAt ?? b.createdAt).localeCompare(String(a.scheduledAt ?? a.createdAt)));
  const pg = paginate(rows, query.page, query.limit, 60);
  return { data: pg.items.map((s) => srView(s, { role: "PROVIDER", provider: p })), meta: { total: pg.total, page: pg.page, limit: pg.limit, totalPages: pg.totalPages } };
});

on("GET", "/service-requests/nearby", ({ query }) => {
  const p = meProvider(query);
  const radius = num(query.radiusKm, 10);
  return db.serviceRequests
    .filter((s) => s.status === "PENDING" && !s.providerId && s.consultationTypeId === p.consultationTypeId)
    .filter((s) => !(s.declinedBy ?? []).includes(p.id))
    .filter((s) => !mdb.providerPatientRejections.some((r) => r.providerId === p.id && r.patientId === s.patientId))
    .map((s) => ({ ...srView(s, { role: "PROVIDER", provider: p }), distance: Math.round(haversineKm(num(p.latitude), num(p.longitude), num(s.latitude), num(s.longitude)) * 10) / 10 }))
    .filter((s) => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
});

function providerSr(query: Record<string, any>, id: unknown) {
  const p = meProvider(query);
  const sr = srOrThrow(id);
  if (sr.providerId !== p.id) fail(403, "This request is not assigned to you");
  return { p, sr };
}

on("PATCH", "/service-requests/:id/accept", ({ query, params }) => {
  const p = meProvider(query);
  const sr = srOrThrow(params.id);
  if (sr.status !== "PENDING") fail(400, `This request is already ${sr.status}`);
  if (p.acceptingRequests === false)
    fail(403, "You are currently not accepting new requests. Please turn on availability in your profile to accept this request.");
  if (sr.providerId && sr.providerId !== p.id) fail(403, "This request was sent to another provider");
  if (p.consultationTypeId !== sr.consultationTypeId) fail(400, "You do not offer this consultation type");
  if (mdb.providerPatientRejections.some((r) => r.providerId === p.id && r.patientId === sr.patientId)) fail(400, "You previously rejected this patient");
  if (sr.scheduledAt) {
    const clash = db.serviceRequests.find((s) => s.id !== sr.id && s.patientId === sr.patientId && s.scheduledAt === sr.scheduledAt && ["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"].includes(s.status));
    if (clash) fail(400, `Cannot accept this request. The patient already has a ${clash.status} service request scheduled for ${sr.scheduledDate} ${sr.scheduledTime}.`);
  }
  if (sr.scheduleSlotId) {
    const slot = mdb.providerSlots.find((s) => s.id === sr.scheduleSlotId);
    if (!slot) fail(400, "No available schedule slot found for the scheduled time");
    if (slot!.status === "BOOKED") fail(400, "The schedule slot is already booked");
  }

  const fee = sr.providerId ? num(sr.fee) : feeFor(p, mdb.providerSlots.find((s) => s.id === sr.scheduleSlotId));
  const pct = commissionPercent(sr.consultationTypeId);
  const commission = (fee * pct) / 100;
  const freeCount = num(config("COMMISSION_FREE_APPOINTMENT_COUNT", "0"), 0);
  const done = db.serviceRequests.filter((s) => s.providerId === p.id && s.status === "COMPLETED").length;
  if (commission > 0 && done >= freeCount) {
    const balance = num(providerWalletView(p).walletBalance);
    if (balance < commission)
      fail(400, `Insufficient wallet balance to accept this service request. Required commission: ${money(commission)} taka, Your current wallet balance: ${money(balance)} taka. Please top up your wallet to accept this request.`);
  }

  Object.assign(sr, {
    status: "ACCEPTED",
    providerId: p.id,
    providerName: db.providerName(p),
    fee: money(fee),
    amount: money(fee),
    billingRateId: (db.billingRates.get(p.id) ?? []).find((r) => !r.validTo)?.id ?? null,
    acceptedAt: now(),
    updatedAt: now(),
  });
  if (sr.scheduleSlotId) {
    setSlotStatus(sr.scheduleSlotId, "BOOKED");
    for (const other of db.serviceRequests) {
      if (other.id === sr.id || other.scheduleSlotId !== sr.scheduleSlotId || other.status !== "PENDING") continue;
      other.status = "REJECTED";
      logEvent(other, "REQUEST_REJECTED", "SYSTEM", null, "Slot was booked by another patient");
      const op = db.findPatient(other.patientId);
      if (op) notify(op.userId, "Slot no longer available", `${sr.providerName}'s ${other.scheduledTime} slot was booked by someone else.`, "REQUEST_REJECTED", { serviceRequestId: other.id });
    }
  }
  upsertTransaction(sr, "PENDING", null);
  logEvent(sr, "PROVIDER_ACCEPTED", "PROVIDER", sr.providerName);
  const patient = db.findPatient(sr.patientId);
  if (patient) notify(patient.userId, "Request accepted", `${sr.providerName} accepted your request for ${sr.scheduledDate} ${sr.scheduledTime}.`, "REQUEST_ACCEPTED", { serviceRequestId: sr.id });
  return srView(sr, { role: "PROVIDER", provider: p });
});

on("PATCH", "/service-requests/:id/reject", ({ query, params, body }) => {
  const p = meProvider(query);
  const sr = srOrThrow(params.id);
  if (!["PENDING", "ACCEPTED"].includes(sr.status)) fail(400, `A ${sr.status} request cannot be rejected`);
  if (sr.providerId && sr.providerId !== p.id) fail(403, "Only the assigned provider can reject this request");
  const reason = body?.reason || null;
  const blacklist = mdb.providerPatientRejections.find((r) => r.providerId === p.id && r.patientId === sr.patientId);
  if (blacklist) Object.assign(blacklist, { reason, updatedAt: now() });
  else mdb.providerPatientRejections.push({ providerId: p.id, patientId: sr.patientId, reason, createdAt: now() });

  if (!sr.providerId) {
    // Open (nearby) request: hide it for this provider, others can still take it.
    sr.declinedBy = [...(sr.declinedBy ?? []), p.id];
    return srView(sr, { role: "PROVIDER", provider: p });
  }
  if (sr.status === "ACCEPTED" && sr.scheduleSlotId) setSlotStatus(sr.scheduleSlotId, "AVAILABLE");
  const tx = txFor(sr);
  if (tx) tx.status = "CANCELLED";
  sr.status = "REJECTED";
  sr.rejectionReason = reason;
  sr.rejectedByProviderName = sr.providerName;
  logEvent(sr, "REQUEST_REJECTED", "PROVIDER", sr.providerName, reason);
  const patient = db.findPatient(sr.patientId);
  if (patient) notify(patient.userId, "Request rejected", `${sr.providerName} could not take your request${reason ? `: ${reason}` : ""}.`, "REQUEST_REJECTED", { serviceRequestId: sr.id });
  return srView(sr, { role: "PROVIDER", provider: p });
});

on("POST", "/service-requests/:id/on-the-way", ({ query, params }) => {
  const { p, sr } = providerSr(query, params.id);
  if (sr.status !== "ACCEPTED") fail(400, "Only an accepted request can be started");
  sr.status = "ON_THE_WAY";
  sr.onTheWayAt = now();
  logEvent(sr, "ON_THE_WAY", "PROVIDER", sr.providerName);
  const patient = db.findPatient(sr.patientId);
  if (patient) notify(patient.userId, "Provider is on the way", `${sr.providerName} is heading to your location.`, "PROVIDER_ON_THE_WAY", { serviceRequestId: sr.id });
  return srView(sr, { role: "PROVIDER", provider: p });
});

on("POST", "/service-requests/:id/request-start-otp", ({ query, params }) => {
  const { p, sr } = providerSr(query, params.id);
  if (sr.status !== "ON_THE_WAY") fail(400, "Mark yourself on the way first");
  sr.startOtp = String(Math.floor(100000 + Math.random() * 900000));
  sr.startOtpSentAt = now();
  sr.arrivedAt = now();
  logEvent(sr, "START_OTP_SENT", "PROVIDER", sr.providerName);
  const patient = db.findPatient(sr.patientId);
  if (patient) notify(patient.userId, "Your provider has arrived", "Share the start OTP shown in the app with your provider.", "START_OTP_SENT", { serviceRequestId: sr.id });
  return { message: "OTP sent to the patient" , serviceRequest: srView(sr, { role: "PROVIDER", provider: p }) };
});

on("POST", "/service-requests/:id/verify-start-otp", ({ query, params, body }) => {
  const { p, sr } = providerSr(query, params.id);
  if (sr.status !== "ON_THE_WAY" || !sr.startOtp) fail(400, "Request the start OTP first");
  if (String(body?.otp ?? "").trim() !== sr.startOtp) fail(400, "Wrong OTP. Ask the patient for the code shown in their app.");
  sr.status = "IN_PROGRESS";
  sr.startOtp = null;
  sr.startedAt = now();
  logEvent(sr, "SERVICE_STARTED", "PROVIDER", sr.providerName);
  const patient = db.findPatient(sr.patientId);
  if (patient) notify(patient.userId, "Service started", `${sr.providerName} started your service.`, "SERVICE_STARTED", { serviceRequestId: sr.id });
  return srView(sr, { role: "PROVIDER", provider: p });
});

on("PUT", "/service-requests/:id/checklist", ({ query, params, body }) => {
  const { p, sr } = providerSr(query, params.id);
  if (sr.status !== "IN_PROGRESS") fail(400, "Checklist can be updated only during the service");
  sr.checklistDone = (body?.doneIds ?? []).map(Number);
  return srView(sr, { role: "PROVIDER", provider: p });
});

on("POST", "/service-requests/:id/request-completion", ({ query, params }) => {
  const { p, sr } = providerSr(query, params.id);
  if (sr.status !== "IN_PROGRESS") fail(400, "Service must be IN_PROGRESS to request completion");
  sr.status = "PAYMENT_PENDING";
  sr.completionRequestedAt = now();
  logEvent(sr, "COMPLETION_REQUESTED", "PROVIDER", sr.providerName);
  const patient = db.findPatient(sr.patientId);
  if (patient) notify(patient.userId, "Confirm & pay", `${sr.providerName} finished the service. Please confirm and choose cash or online payment.`, "PAYMENT_PENDING", { serviceRequestId: sr.id });
  return srView(sr, { role: "PROVIDER", provider: p });
});

on("POST", "/service-requests/:id/provider-cancel", ({ query, params, body }) => {
  const { p, sr } = providerSr(query, params.id);
  if (!["ACCEPTED", "ON_THE_WAY"].includes(sr.status)) fail(400, "Only upcoming services can be cancelled");
  if (sr.cancelRequested) fail(400, "You already asked to cancel this service");
  const patient = db.findPatient(sr.patientId);
  db.providerCancelRequests.unshift({
    id: nextId(db.providerCancelRequests, 700),
    scope: "SINGLE",
    batchId: null,
    reviewStatus: "PENDING",
    createdAt: now(),
    reasonCategory: body?.reasonCategory ?? "OTHER",
    reasonNote: body?.reasonNote ?? null,
    stage: "PRE_SERVICE",
    provider: { id: p.id, userId: p.userId, name: db.providerName(p) },
    patient: { id: patient?.id ?? 0, userId: patient?.userId, name: db.patientName(patient) },
    serviceRequest: {
      id: sr.id, status: sr.status, statusAtRequest: sr.status, scheduledDate: sr.scheduledDate, scheduledTime: sr.scheduledTime,
      consultationTypeId: sr.consultationTypeId, consultationTypeName: sr.consultationTypeName,
      serviceCategory: db.categoryOfType(sr.consultationTypeId), fee: sr.fee,
    },
  });
  sr.cancelRequested = true;
  logEvent(sr, "PROVIDER_CANCEL_REQUESTED", "PROVIDER", sr.providerName, body?.reasonNote);
  notifyAdmin("Provider cancelled a shift", `${db.providerName(p)} asked to cancel ${sr.patientName}'s ${sr.scheduledDate} service. Review needed.`, "PROVIDER_CANCEL_REQUESTED");
  return srView(sr, { role: "PROVIDER", provider: p });
});

// long-term shifts ------------------------------------------------------------------

on("GET", "/providers/me/long-term-shifts", ({ query }) => {
  const p = meProvider(query, false);
  const out: Row[] = [];
  for (const lto of db.longTermOpportunities) {
    if (["REQUESTED", "REJECTED", "EXPIRED"].includes(lto.status)) continue;
    for (const s of ltoShifts(lto)) {
      if (s.providerId !== p.id) continue;
      out.push({
        ...s,
        opportunityId: lto.id,
        requestNo: lto.requestNo,
        opportunityStatus: lto.status,
        patientName: lto.patientName,
        address: lto.serviceAddressText,
        consultationTypeId: lto.consultationTypeId,
        consultationTypeName: lto.consultationTypeName,
        notes: lto.notes,
        confirmed: ["PAID", "IN_PROGRESS", "COMPLETED"].includes(lto.status),
      });
    }
  }
  return out.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
});

function myShift(query: Record<string, any>, slotId: unknown) {
  const p = meProvider(query);
  const { lto, row } = findShift(slotId);
  if (row.providerSchedule.providerId !== p.id) fail(403, "This shift is not assigned to you");
  return { p, lto, row };
}

function checkShiftStartable(lto: Row, row: Row) {
  if (!["PAID", "IN_PROGRESS"].includes(lto.status)) fail(400, "The patient has not paid for this booking yet");
  if (row.providerSchedule.date > ymd(new Date())) fail(400, `This shift starts on ${row.providerSchedule.date}. You can check in on that day.`);
  if (row.serviceRequest.status !== "ACCEPTED") fail(400, `This shift is already ${row.serviceRequest.status}`);
}

// Same identity check as short-term visits: the nurse arrives, the patient's app shows an OTP,
// the nurse types it in to start the shift.
on("POST", "/long-term-shifts/:slotId/request-start-otp", ({ query, params }) => {
  const { p, lto, row } = myShift(query, params.slotId);
  checkShiftStartable(lto, row);
  row.serviceRequest.startOtp = String(Math.floor(100000 + Math.random() * 900000));
  row.serviceRequest.startOtpSentAt = now();
  notifyPatient(lto.patientId, "Your carer has arrived", `${db.providerName(p)} is here for the ${row.providerSchedule.date} shift. Share the start OTP shown in the app.`, "START_OTP_SENT", { longTermOpportunityId: lto.id });
  return { message: "OTP sent to the patient" };
});

on("POST", "/long-term-opportunities/:id/shifts/:slotId/regenerate-start-otp", ({ query, params }) => {
  const patient = mePatient(query);
  const { lto, row } = findShift(params.slotId);
  if (lto.id !== Number(params.id) || lto.patientId !== patient.id) fail(403, "Not your booking");
  if (!row.serviceRequest.startOtp) fail(400, "Your carer has not requested a start OTP yet");
  const cooldown = num(config("OTP_RESEND_COOLDOWN_SECONDS", "60"), 60);
  const wait = Math.ceil(cooldown - (Date.now() - new Date(row.serviceRequest.startOtpSentAt).getTime()) / 1000);
  if (wait > 0) fail(400, `Please wait ${wait}s before generating a new OTP`);
  row.serviceRequest.startOtp = String(Math.floor(100000 + Math.random() * 900000));
  row.serviceRequest.startOtpSentAt = now();
  return { message: "New OTP generated", otp: row.serviceRequest.startOtp };
});

on("POST", "/long-term-shifts/:slotId/verify-start-otp", ({ query, params, body }) => {
  const { p, lto, row } = myShift(query, params.slotId);
  checkShiftStartable(lto, row);
  if (!row.serviceRequest.startOtp) fail(400, "Request the start OTP first");
  if (String(body?.otp ?? "").trim() !== row.serviceRequest.startOtp) fail(400, "Wrong OTP. Ask the patient for the code shown in their app.");
  row.serviceRequest.startOtp = null;
  row.serviceRequest.status = "IN_PROGRESS";
  row.serviceRequest.startedAt = now();
  if (lto.status === "PAID") {
    lto.status = "IN_PROGRESS";
    logEvent(lto, "IN_PROGRESS", "PROVIDER", db.providerName(p), "First shift started");
  }
  const patient = db.findPatient(lto.patientId);
  if (patient) notify(patient.userId, "Shift started", `${db.providerName(p)} checked in for the ${row.providerSchedule.date} shift.`, "SERVICE_STARTED", { longTermOpportunityId: lto.id });
  return { message: "Shift started" };
});

on("PUT", "/long-term-shifts/:slotId/checklist", ({ query, params, body }) => {
  const { row } = myShift(query, params.slotId);
  if (row.serviceRequest.status !== "IN_PROGRESS") fail(400, "Start the shift first");
  row.serviceRequest.checklistDone = (body?.doneIds ?? []).map(Number);
  return { message: "Saved" };
});

on("POST", "/long-term-shifts/:slotId/complete", ({ query, params }) => {
  const { p, lto, row } = myShift(query, params.slotId);
  if (row.serviceRequest.status !== "IN_PROGRESS") fail(400, "Start the shift first");
  row.serviceRequest.status = "COMPLETED";
  row.serviceRequest.completedAt = now();
  const tx = db.transactions.find((t) => t.serviceRequestId === row.serviceRequest.id && t.longTermOpportunityId === lto.id);
  if (tx) Object.assign(tx, { status: "COMPLETED", isEscrow: false, serviceRequestStatus: "COMPLETED" });
  const all = db.ltoSchedules.get(lto.id) ?? [];
  if (all.every((r) => ["COMPLETED", "CANCELLED"].includes(r.serviceRequest.status))) {
    lto.status = "COMPLETED";
    logEvent(lto, "COMPLETED", "SYSTEM", null, "All shifts completed");
  }
  const patient = db.findPatient(lto.patientId);
  if (patient) notify(patient.userId, "Shift completed", `${db.providerName(p)} completed the ${row.providerSchedule.date} shift.`, "SERVICE_COMPLETED", { longTermOpportunityId: lto.id });
  return { message: "Shift completed", opportunityStatus: lto.status };
});

on("POST", "/long-term-shifts/:slotId/cancel-request", ({ query, params, body }) => {
  const { p, lto, row } = myShift(query, params.slotId);
  if (row.serviceRequest.status !== "ACCEPTED") fail(400, "Only upcoming shifts can be cancelled");
  if (row.serviceRequest.cancelRequested) fail(400, "You already asked to cancel this shift");
  row.serviceRequest.cancelRequested = true;
  const reasonCategory = body?.reasonCategory ?? "OTHER";
  const reasonNote = body?.reasonNote ?? null;
  const id = nextId(db.providerCancelBatches, 800);
  db.providerCancelBatches.unshift({
    id,
    scope: "LONG_TERM",
    batchId: `batch-${lto.id}-${p.id}-${row.providerSchedule.id}`,
    opportunityId: lto.id,
    reviewStatus: "PENDING",
    createdAt: now(),
    reasonCategory,
    reasonNote,
    stage: "PRE_SERVICE",
    provider: { id: p.id, name: db.providerName(p) },
    patient: { id: lto.patientId, name: lto.patientName },
    shiftCount: 1,
    earliestDate: row.providerSchedule.date,
    latestDate: row.providerSchedule.date,
    shifts: [{
      cancellationId: id * 10,
      shiftId: row.providerSchedule.id,
      scheduledDate: row.providerSchedule.date,
      scheduledTime: row.providerSchedule.startTime,
      fee: row.serviceRequest.fee,
      reasonCategory,
      reasonNote,
      reviewStatus: "PENDING",
      srStatus: "ACCEPTED",
      previousSrStatus: "ACCEPTED",
      refundPreview: { feeAmount: "0.00", refundAmount: row.serviceRequest.fee },
    }],
  });
  notifyAdmin("Provider cancelled a shift", `${db.providerName(p)} asked to cancel the ${row.providerSchedule.date} shift of ${lto.requestNo}.`, "PROVIDER_CANCEL_REQUESTED");
  return { message: "Cancel request sent to admin" };
});

// analytics, wallet, withdrawals ------------------------------------------------------

on("GET", "/providers/me/service-analytics", ({ query }) => {
  const p = meProvider(query, false);
  const mine = db.serviceRequests.filter((s) => s.providerId === p.id);
  const start = query.startDate ?? ymd(dayOffset(-29));
  const end = query.endDate ?? ymd(new Date());
  const inRange = mine.filter((s) => s.scheduledDate >= start && s.scheduledDate <= end);
  const booked = (rows: Row[]) => rows.filter((s) => ["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS", "PAYMENT_PENDING", "COMPLETED"].includes(s.status)).length;
  const days = Array.from({ length: 7 }, (_, i) => dayOffset(i - 6));
  return {
    totalRequests: inRange.length,
    booked: booked(inRange),
    done: inRange.filter((s) => s.status === "COMPLETED").length,
    last7Days: days.map((d) => {
      const rows = mine.filter((s) => s.scheduledDate === ymd(d));
      return { date: ymd(d), day: d.toLocaleDateString("en-US", { weekday: "short" }), requests: rows.length, booked: booked(rows), done: rows.filter((s) => s.status === "COMPLETED").length };
    }),
  };
});

on("POST", "/financial/recharge", ({ query, body }) => {
  const p = meProvider(query, false);
  const amount = num(body?.amount, 0);
  if (amount < 50) fail(400, "Minimum top-up is ৳50");
  const row = { id: nextId(mdb.walletTopups, 97000), providerId: p.id, amount: money(amount), method: body?.method ?? "BKASH", createdAt: now() };
  mdb.walletTopups.unshift(row);
  return { message: "Wallet topped up", ...row };
});

on("GET", "/financial/withdrawals/me", ({ query }) => {
  const p = meProvider(query, false);
  return db.withdrawals.filter((w) => w.providerId === p.id);
});

on("POST", "/financial/withdrawal", ({ query, body }) => {
  const p = meProvider(query);
  const amount = num(body?.amount, 0);
  const available = num(providerWalletView(p).availableToWithdraw);
  if (amount < 500) fail(400, "Minimum withdrawal is ৳500");
  if (amount > available) fail(400, `You can withdraw at most ৳${money(available)} right now`);
  const method = ["BKASH", "NAGAD", "BANK"].includes(body?.method) ? body.method : "BKASH";
  if (method !== "BANK" && !normalizePhone(body?.mobileNumber)) fail(400, "Enter a valid wallet number");
  if (method === "BANK" && (!body?.bankName || !body?.accountNumber)) fail(400, "Bank name and account number are required");
  const w = {
    id: nextId(db.withdrawals, 300),
    providerId: p.id,
    userId: p.userId,
    providerName: db.providerName(p),
    amount: money(amount),
    status: "PENDING",
    method,
    mobileNumber: method !== "BANK" ? normalizePhone(body.mobileNumber) : null,
    bankName: method === "BANK" ? body.bankName : null,
    accountName: method === "BANK" ? db.providerName(p) : null,
    accountNumber: method === "BANK" ? body.accountNumber : null,
    reference: null,
    adminNote: null,
    proofUrl: null,
    createdAt: now(),
    requestedAt: now(),
    updatedAt: now(),
    approvedAt: null,
    completedAt: null,
  };
  db.withdrawals.unshift(w);
  notifyAdmin("Withdrawal request", `${w.providerName} requested a withdrawal of ৳${w.amount}.`, "WITHDRAWAL_REQUESTED");
  return w;
});

// verification documents, certifications, upgrades ----------------------------------------

on("GET", "/verification-documents", ({ query }) => {
  const p = meProvider(query, false);
  const typeId = num(query.consultationTypeId, p.consultationTypeId);
  const docs = db.userDocuments.get(p.userId) ?? [];
  const label = (code: string) => db.verificationDocTypes.find((t) => t.code === code)?.label ?? code;
  const requirements = db.verificationRequirements
    .filter((r) => r.consultationTypeId === typeId)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((r) => ({ id: r.id, documentType: r.documentType, label: label(r.documentType), isRequired: r.isRequired, uploadedDocument: docs.find((d) => d.type === r.documentType) ?? null }));
  return { consultationTypeId: typeId, consultationTypeName: db.consultationTypeName(typeId), requirements, documents: docs };
});

/**
 * Onboarding: every required document and certification must be submitted (not rejected).
 * Admin then reviews each one and finally sets the provider ACTIVE.
 */
function onboardingProgress(p: Row) {
  const docs = db.userDocuments.get(p.userId) ?? [];
  const certs = db.providerCertifications.get(p.id) ?? [];
  const reqDocs = db.verificationRequirements.filter((r) => r.consultationTypeId === p.consultationTypeId && r.isRequired);
  const reqCerts = db.certificationRequirements
    .filter((r) => r.consultationTypeId === p.consultationTypeId && r.isRequired)
    .map((r) => db.certificationTypes.find((t) => t.id === r.certificationTypeId)?.code);
  const docOf = (code: string) => docs.find((d) => d.type === code);
  const certOf = (code: unknown) => certs.find((c) => c.certificationTypeCode === code);
  const submitted = (x: Row | undefined) => Boolean(x) && x!.status !== "REJECTED";
  const approved = (x: Row | undefined) => x?.status === "APPROVED";
  const documentsUploaded = reqDocs.filter((r) => submitted(docOf(r.documentType))).length;
  const certificationsSubmitted = reqCerts.filter((c) => submitted(certOf(c))).length;
  return {
    documentsRequired: reqDocs.length,
    documentsUploaded,
    requiredDocumentsApproved: reqDocs.filter((r) => approved(docOf(r.documentType))).length,
    certificationsRequired: reqCerts.length,
    certificationsSubmitted,
    requiredCertificationsApproved: reqCerts.filter((c) => approved(certOf(c))).length,
    rejectedCount: [...docs, ...certs].filter((x) => x.status === "REJECTED").length,
    complete: documentsUploaded === reqDocs.length && certificationsSubmitted === reqCerts.length,
    submittedForReviewAt: p.submittedForReviewAt ?? null,
    // Submitted and nothing bounced back yet: files are locked while admin reviews them.
    underReview: p.status === "PENDING" && Boolean(p.submittedForReviewAt) && ![...docs, ...certs].some((x) => x.status === "REJECTED"),
  };
}

/** Provider stages every file in the app, uploads them, then submits once for admin review. */
on("POST", "/providers/me/submit-for-review", ({ query }) => {
  const p = meProvider(query, false);
  if (p.status !== "PENDING") fail(400, `Your profile is already ${String(p.status).toLowerCase()}`);
  const prog = onboardingProgress(p);
  if (prog.rejectedCount > 0) fail(400, "Replace the rejected items before submitting again");
  if (!prog.complete)
    fail(400, `Add all required items first (documents ${prog.documentsUploaded}/${prog.documentsRequired}, certificates ${prog.certificationsSubmitted}/${prog.certificationsRequired})`);
  const again = Boolean(p.submittedForReviewAt);
  p.submittedForReviewAt = now();
  notifyAdmin(
    again ? "Provider resubmitted documents" : "Provider ready for verification",
    `${db.providerName(p)} (${p.consultationTypeName}) submitted ${prog.documentsRequired} documents and ${prog.certificationsRequired} certifications for review.`,
    "PROVIDER_REGISTERED"
  );
  notify(p.userId, "Submitted for review", "Caregiver BD will review your documents, usually within 1–2 working days. You'll get a notification for each decision.", "ONBOARDING_SUBMITTED");
  return { message: "Submitted for review", submittedForReviewAt: p.submittedForReviewAt };
});

function assertEditable(p: Row, existing: Row | undefined, what: string) {
  if (existing?.status === "APPROVED") fail(400, `This ${what} is already approved and cannot be replaced`);
  if (existing?.status === "PENDING" && onboardingProgress(p).underReview) fail(400, `This ${what} is under review and cannot be changed now`);
}

on("POST", "/verification-documents/upload", ({ query, body }) => {
  const p = meProvider(query, false);
  const req = body?.verificationRequirementId ? db.verificationRequirements.find((r) => r.id === Number(body.verificationRequirementId)) : null;
  const type = String(req?.documentType ?? body?.type ?? "").toUpperCase().replace(/\s+/g, "_");
  if (!db.verificationDocTypes.some((t) => t.code === type && t.isActive)) fail(400, "Unknown or inactive document type");
  const docs = db.userDocuments.get(p.userId) ?? [];
  const existing = docs.find((d) => d.type === type);
  assertEditable(p, existing, "document");
  const fileUrl = body?.fileUrl ?? null;
  if (!fileUrl) fail(400, "Choose a file to upload");
  const file = { status: "PENDING", filePath: fileUrl, path: fileUrl, viewUrl: fileUrl, fileName: body?.fileName ?? null, mimeType: body?.mimeType ?? null, adminComment: null, createdAt: now() };
  if (existing) Object.assign(existing, file);
  else docs.push({ id: db.nextDocId(), userId: p.userId, type, ...file });
  db.userDocuments.set(p.userId, docs);
  return docs.find((d) => d.type === type);
});

on("GET", "/providers/me/certifications", ({ query }) => {
  const p = meProvider(query, false);
  const required = db.certificationRequirements
    .filter((r) => r.consultationTypeId === p.consultationTypeId)
    .map((r) => {
      const t = db.certificationTypes.find((x) => x.id === r.certificationTypeId);
      return { code: t?.code, name: t?.name, isRequired: r.isRequired };
    });
  return { types: required, certifications: db.providerCertifications.get(p.id) ?? [] };
});

on("POST", "/providers/me/certifications", ({ query, body }) => {
  const p = meProvider(query, false);
  const t = db.certificationTypes.find((x) => x.code === body?.certificationTypeCode);
  if (!t) fail(400, "Certification type not found");
  if (!String(body?.certificationNumber ?? "").trim()) fail(400, "Certification number is required");
  if (!body?.documentUrl) fail(400, "Attach a photo or PDF of the certificate");
  const list = db.providerCertifications.get(p.id) ?? [];
  assertEditable(p, list.find((c) => c.certificationTypeCode === t!.code), "certification");
  const allIds = [...db.providerCertifications.values()].flat();
  const cert = {
    id: nextId(allIds, 1),
    providerId: p.id,
    certificationTypeCode: t!.code,
    certificationTypeName: t!.name,
    certificationNumber: String(body.certificationNumber).trim(),
    status: "PENDING",
    approvedAt: null,
    approvedByName: null,
    adminComment: null,
    createdAt: now(),
    documentUrl: body.documentUrl,
    filePath: body.documentUrl,
    fileName: body?.fileName ?? null,
  };
  db.providerCertifications.set(p.id, [...list.filter((c) => c.certificationTypeCode !== t!.code), cert]);
  return cert;
});

on("GET", "/providers/me/upgrade-requests", ({ query }) => {
  const p = meProvider(query, false);
  return db.upgradeRequests.filter((u) => u.providerId === p.id);
});

on("POST", "/providers/me/upgrade-requests", ({ query, body }) => {
  const p = meProvider(query);
  const target = db.consultationTypes.find((t) => t.id === Number(body?.targetConsultationTypeId));
  if (!target || target.parentId == null) fail(400, "Pick a valid target service");
  if (target!.id === p.consultationTypeId) fail(400, "You are already in this category");
  if (db.upgradeRequests.some((u) => u.providerId === p.id && u.status === "PENDING")) fail(400, "You already have a pending upgrade request");
  const u = {
    id: nextId(db.upgradeRequests, 400),
    providerId: p.id,
    providerUserId: p.userId,
    providerName: db.providerName(p),
    currentConsultationTypeId: p.consultationTypeId,
    currentConsultationTypeName: p.consultationTypeName,
    targetConsultationTypeId: target!.id,
    targetConsultationTypeName: target!.name,
    status: "PENDING",
    createdAt: now(),
    reviewedBy: null,
    reviewedAt: null,
    adminComment: null,
  };
  db.upgradeRequests.unshift(u);
  notifyAdmin("Upgrade request", `${u.providerName} requested an upgrade to ${target!.name}.`, "UPGRADE_REQUESTED");
  return u;
});

on("GET", "/feedback/provider/me", ({ query }) => {
  const p = meProvider(query, false);
  return mdb.feedbacks.filter((f) => f.providerId === p.id);
});

// Registered last: routes match in order, so this must not shadow `/service-requests/nearby`.
on("GET", "/service-requests/:id", ({ query, params }) => {
  const a = actor(query);
  const sr = srOrThrow(params.id);
  const mine = a.role === "PATIENT" ? sr.patientId === a.patient.id : sr.providerId === a.provider.id || (sr.status === "PENDING" && !sr.providerId);
  if (!mine) fail(403, "You cannot view this request");
  return srView(sr, a);
});
