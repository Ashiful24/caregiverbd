/**
 * Notification helpers shared by the admin mocks and the mobile mocks, so an admin
 * action (proposing a schedule, verifying a provider, paying out a withdrawal…)
 * reaches the patient / provider app as a push notification.
 */
import * as db from "./db";
import type { Row } from "./db";
import * as mdb from "./mobileDb";
import { iso } from "./utils";

const now = () => iso(new Date());
const nextId = (rows: Row[], start: number) => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), start - 1) + 1;

/** Push to a patient / provider app user (`user_notifications`). */
export function notifyUser(userId: number | null | undefined, title: string, body: string, type: string, data: Row = {}) {
  if (!userId) return;
  mdb.userNotifications.unshift({ id: nextId(mdb.userNotifications, 1), userId, title, body, type, data, status: "ACTIVE", readAt: null, createdAt: now() });
}

export function notifyProvider(providerId: unknown, title: string, body: string, type: string, data: Row = {}) {
  notifyUser(db.findProvider(providerId)?.userId, title, body, type, data);
}

export function notifyPatient(patientId: unknown, title: string, body: string, type: string, data: Row = {}) {
  notifyUser(db.findPatient(patientId)?.userId, title, body, type, data);
}

/** Admin panel bell (`db.notifications`). */
export function notifyAdmin(title: string, body: string, type: string) {
  db.notifications.unshift({ id: nextId(db.notifications, 1000), title, body, type, status: "ACTIVE", readAt: null, data: null, createdAt: now() });
}

/** Append a step to a request's activity log (shown as a timeline in the apps). */
export function logEvent(row: Row, step: string, actorRole: string, actorName: string | null, note?: string | null) {
  row.events = [...(row.events ?? []), { step, actorRole, actorName, note: note ?? null, at: now() }];
}
