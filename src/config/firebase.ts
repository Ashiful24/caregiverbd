/**
 * Firebase config for FCM (push notifications) on web.
 * Set VITE_FIREBASE_* in .env (see .env.example).
 *
 * NOTE: src/fcm/firebase-service-account.json holds the Admin SDK service account
 * (private key, client email). It is gitignored and must never be imported here —
 * it is a backend-only credential and would be exposed in the browser bundle.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

/** VAPID key (Web Push certificate) from Firebase Console > Project Settings > Cloud Messaging. */
export const vapidKey: string = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? "";

export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    vapidKey
  );
}
