/**
 * Extra demo tables used by the patient / provider mobile views (`src/mobile`).
 * Saved together with `db.ts` by `persist.ts`.
 */
import type { Row } from "./db";

/** Short-term schedule slots providers publish (`provider_schedules`). */
export const providerSlots: Row[] = [];

/** Patient favourites (`patient_liked_providers`). */
export const likedProviders: Row[] = [];

/** Provider → patient blacklist created by a rejection (`provider_patient_rejections`). */
export const providerPatientRejections: Row[] = [];

/** Two-way ratings after a completed service (`service_request_reviews`). */
export const reviews: Row[] = [];

/** Free-text feedback from patient to provider (`provider_feedbacks`). */
export const feedbacks: Row[] = [];

/** Daily patient vitals, one row per patient per day (`patient_vitals`). */
export const vitals: Row[] = [];

/** Push notification history per user (`user_notifications`). */
export const userNotifications: Row[] = [];

/** Provider wallet top-ups made from the app, used for the commission balance check. */
export const walletTopups: Row[] = [];

/** Online payment attempts through the demo gateway (`payment_attempts`). */
export const paymentAttempts: Row[] = [];
