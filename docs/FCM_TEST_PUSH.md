# How to check push notifications (FCM)

## Prerequisites

- `VITE_FIREBASE_VAPID_KEY` is set in `.env`
- App runs on **localhost** or **HTTPS**
- Restart dev server after changing `.env**: `npm run dev`

---

## Step 1 – Register for push in the app

1. Open the app in the browser (e.g. `http://localhost:5173`)
2. **Log in** (FCM only runs when the user is authenticated)
3. When the browser asks **Allow notifications?** → click **Allow**
4. The app gets an FCM token and sends it to your backend via `POST /notifications/device`

**To see the FCM token (for testing):** In `src/components/common/FcmInit.tsx`, temporarily add `onTokenRegistered` when calling `initFcm`:

```ts
initFcm({
  onTokenRegistered: (token) => console.log("FCM token:", token),
  onForegroundMessage: (payload) => { ... },
});
```

Open DevTools (F12) → Console and copy the printed token.

---

## Step 2 – Send a test from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/) → your project (**ontor-a20b9**)
2. Left menu: **Engage** → **Messaging** (or **Build** → **Cloud Messaging**)
3. Click **Create your first campaign** or **New campaign** → **Firebase Notification messages**
4. Enter **Notification title** and **Notification text** (e.g. "Test" / "Hello from FCM")
5. Click **Next** until **Targeting**
6. Under **Target**, choose **Send to a single device**
7. Paste the **FCM token** (from your backend or from the console.log above)
8. Finish and send

**What you should see:**

- **Tab open and focused:** App receives the message; a browser notification may appear
- **Tab in background or closed:** A **system notification** (OS notification) appears from the service worker

---

## Step 3 – Send from your backend (optional)

If your backend stores the token from `POST /notifications/device`, use the Firebase Admin SDK (with your service account JSON on the server):

```js
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
await admin.messaging().send({
  token: "<FCM_TOKEN_FROM_YOUR_DB>",
  notification: { title: "Test", body: "Hello from backend" },
});
```

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| No permission prompt | VAPID key in `.env`? Restart dev server. Using localhost or HTTPS? |
| Token not received | Browser console for errors. Network tab: is `POST /notifications/device` sent and 2xx? |
| No notification when sending | Correct FCM token? Try with tab in **background** (minimize window). |
| Service worker errors | F12 → Application → Service Workers. Is `firebase-messaging-sw.js` registered? |
