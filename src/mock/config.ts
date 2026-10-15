/**
 * Demo mode: every API call is answered locally from `src/mock` instead of the backend.
 * On by default. Set `VITE_DEMO_MODE=false` in `.env` to talk to the real API again.
 */
export const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? "true").toLowerCase() !== "false";

/** Simulated network latency (ms) so loaders and spinners still show briefly. */
export const DEMO_LATENCY_MS = 250;

/** Demo logins. Every demo supervisor's email also works with the supervisor password. */
export const DEMO_ACCOUNTS = {
  admin: { identifier: "admin@hope.demo", password: "demo1234" },
  supervisor: { identifier: "supervisor@hope.demo", password: "demo1234" },
};
