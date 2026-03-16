/**
 * FCM (Firebase Cloud Messaging) for web push notifications.
 * - Requests permission, gets FCM token, registers with backend.
 * - Handles foreground messages (onMessage).
 * - Background messages are handled by public/firebase-messaging-sw.js.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { firebaseConfig, vapidKey, isFirebaseConfigured } from "../config/firebase";
import { notificationsApi } from "./api";

const FCM_SW_PATH = "/firebase-messaging-sw.js";

export interface FcmOptions {
  /** Called when a new FCM token is obtained and registered with the backend. */
  onTokenRegistered?: (token: string) => void;
  /** Called when a foreground push message is received (notification payload). */
  onForegroundMessage?: (payload: Record<string, unknown>) => void;
  /** Optional device id sent to backend (defaults to a stable browser id). */
  deviceId?: string;
}

let messagingInstance: Messaging | null = null;
/** Single in-flight registration so multiple callers (e.g. login + FcmInit) don't double-register. */
let initPromise: Promise<string | null> | null = null;

function getStableDeviceId(): string {
  const key = "hope_fcm_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = "web_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

/**
 * Request notification permission, get FCM token, register with backend, and set up foreground handler.
 * Call after login (AuthContext) or when app loads with existing session (FcmInit).
 * Multiple calls share the same in-flight registration so we only register once.
 */
const FCM_LOG_PREFIX = "[FCM]";

/** Runs FCM init assuming notification permission is already granted. Called only after permission is granted. */
async function doFcmInitCore(options: FcmOptions): Promise<string | null> {
  try {
    console.info(FCM_LOG_PREFIX, "Step 5: Initializing Firebase app…");
    const app = getApps().length > 0 ? getApp() : initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain || undefined,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket || undefined, 
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    } as import("firebase/app").FirebaseOptions);
    console.info(FCM_LOG_PREFIX, "Step 5: Firebase app ready ✓");

    console.info(FCM_LOG_PREFIX, "Step 6: Getting Firebase Messaging instance…");
    const messaging = getMessaging(app);
    messagingInstance = messaging;
    console.info(FCM_LOG_PREFIX, "Step 6: Messaging instance ready ✓");

    console.info(FCM_LOG_PREFIX, "Step 7: Registering service worker", FCM_SW_PATH, "…");
    const registration = await navigator.serviceWorker.register(FCM_SW_PATH).catch((e) => {
      console.warn(FCM_LOG_PREFIX, "Step 7: Service worker register error", e);
      return null;
    });
    if (!registration) {
      console.warn(FCM_LOG_PREFIX, "Step 7: Stopped — service worker registration failed");
      return null;
    }
    await navigator.serviceWorker.ready;
    console.info(FCM_LOG_PREFIX, "Step 7: Service worker registered and ready ✓");

    console.info(FCM_LOG_PREFIX, "Step 8: Getting FCM token (Firebase + VAPID)…");
    const token = await getToken(messaging, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn(FCM_LOG_PREFIX, "Step 8: Stopped — no FCM token (check VAPID key in Firebase Console)");
      return null;
    }
    console.info(FCM_LOG_PREFIX, "Step 8: FCM token received ✓ (length:", token?.length ?? 0, ")");

    const deviceId = options.deviceId ?? getStableDeviceId();
    console.info(FCM_LOG_PREFIX, "Step 9: Registering device with backend (POST /notifications/device)…", { deviceId, device: "web" });
    await notificationsApi.registerDevice({
      deviceId,
      regToken: token,
      device: "web",
      type: "web",
    });
    console.info(FCM_LOG_PREFIX, "Step 9: Backend registration successful ✓");

    console.info(FCM_LOG_PREFIX, "Step 10: Setting up foreground message handler…");
    options.onTokenRegistered?.(token);
    onMessage(messaging, (payload) => {
      options.onForegroundMessage?.(payload?.data as Record<string, unknown> ?? {});
    });
    console.info(FCM_LOG_PREFIX, "Step 10: FCM initialized successfully — device registered for push notifications ✓");
    return token;
  } catch (err) {
    console.warn(FCM_LOG_PREFIX, "Step failed with error:", err);
    return null;
  }
}

/**
 * Request notification permission, get FCM token, register with backend, and set up foreground handler.
 * Permission must be requested from a user gesture (click/key). If not yet granted, we wait for first click/keydown.
 */
export async function initFcm(options: FcmOptions = {}): Promise<string | null> {
  console.info(FCM_LOG_PREFIX, "Step 1: initFcm() called");

  if (typeof window === "undefined") {
    console.info(FCM_LOG_PREFIX, "Step 2: Skipped — not in browser (SSR)");
    return null;
  }
  console.info(FCM_LOG_PREFIX, "Step 2: In browser ✓");

  if (!isFirebaseConfigured()) {
    console.info(FCM_LOG_PREFIX, "Step 3: Skipped — Firebase not configured (check VITE_FIREBASE_* in .env)");
    return null;
  }
  console.info(FCM_LOG_PREFIX, "Step 3: Firebase config present ✓");

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.info(FCM_LOG_PREFIX, "Step 4: Skipped — Notification or ServiceWorker API not supported");
    return null;
  }
  console.info(FCM_LOG_PREFIX, "Step 4: Notification + ServiceWorker supported ✓");

  const permission = Notification.permission;
  console.info(FCM_LOG_PREFIX, "Step 5: Current notification permission:", permission);

  if (permission === "denied") {
    console.info(FCM_LOG_PREFIX, "Step 5: Skipped — notification permission already denied");
    return null;
  }

  if (permission === "default") {
    // Browser requires requestPermission() to be called from a user gesture (click/key). Defer until first interaction.
    console.info(FCM_LOG_PREFIX, "Step 5: Permission not yet asked — waiting for user click or keypress to show prompt…");
    return new Promise<string | null>((resolve) => {
      const runAfterGesture = () => {
        document.removeEventListener("click", runAfterGesture, true);
        document.removeEventListener("keydown", runAfterGesture, true);
        console.info(FCM_LOG_PREFIX, "Step 6: User gesture detected — requesting notification permission…");
        Notification.requestPermission().then((p) => {
          console.info(FCM_LOG_PREFIX, "Step 6: Permission result:", p);
          if (p !== "granted") {
            resolve(null);
            return;
          }
          const promise = doFcmInitCore(options);
          initPromise = promise;
          promise.then(resolve);
        });
      };
      document.addEventListener("click", runAfterGesture, { once: true, capture: true });
      document.addEventListener("keydown", runAfterGesture, { once: true, capture: true });
    });
  }

  // permission === "granted" — run full init without calling requestPermission()
  if (initPromise) {
    console.info(FCM_LOG_PREFIX, "Step 5: Reusing existing init (already in progress or done)");
    return initPromise;
  }
  initPromise = doFcmInitCore(options);
  return initPromise;
}

/**
 * Call from a user gesture (e.g. "Enable notifications" button) to request permission
 * and register the device with the backend. Use when Notification.permission === "default"
 * so the device registration API gets called after the user explicitly enables.
 */
export async function requestPermissionAndRegister(options: FcmOptions = {}): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (!isFirebaseConfigured()) return null;
  const permission = Notification.permission;
  if (permission === "denied") return null;
  if (permission === "granted") {
    if (initPromise) return initPromise;
    initPromise = doFcmInitCore(options);
    return initPromise;
  }
  // permission === "default" — we're in a user gesture (button click)
  const result = await Notification.requestPermission();
  if (result !== "granted") return null;
  if (initPromise) return initPromise;
  initPromise = doFcmInitCore(options);
  return initPromise;
}

/** Whether push notifications can be used (browser + Firebase configured). */
export function canUsePushNotifications(): boolean {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  return isFirebaseConfigured();
}

/**
 * Use this to show a simple in-app notification when a foreground message is received
 * (optional; browser may also show a notification if the SW handles it).
 */
export function getMessagingInstance(): Messaging | null {
  return messagingInstance;
}
