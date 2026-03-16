# FCM (Firebase Cloud Messaging) for Web Push Notifications

Yes, you can use FCM for push notifications in this web app. Here is how it’s set up and what you need to do.

---

## Service account vs web config (important)

**No – the Firebase service account JSON is not used for the frontend connection.**

Firebase uses two different kinds of credentials:

| Use case | Credential | Where it lives |
|----------|------------|----------------|
| **Browser (this app)** – receive push, get FCM token | **Web app config** (apiKey, projectId, appId, messagingSenderId, etc.) + **VAPID public key** | Frontend: `.env` (VITE_FIREBASE_*) and `public/firebase-messaging-sw.js` |
| **Backend/server** – send push via FCM Admin API | **Service account JSON** (has a private key) | Backend only: e.g. Hope backend server, never in the frontend repo |

- **Service account JSON** = for your **backend** (Node.js, etc.) to **send** notifications with the Firebase Admin SDK. It contains a **private key** and must **never** be in the frontend, in the browser, or in public repos.
- **Web app config + VAPID key** = for the **browser** to connect to Firebase, request permission, and get an FCM token so it can **receive** push. These are public/safe in the client.

So for the **frontend** Firebase connection you need the **Web app config** from Firebase Console (Project settings > General > Your apps > Web app) and the **VAPID key** (Project settings > Cloud Messaging > Web Push certificates). The service account file is only for the backend.

**Security:** If `firebase-service-account.json` (or any file with a private key) was ever committed to git, remove it from the repo and **revoke/rotate that key** in [Google Cloud Console](https://console.cloud.google.com/) (IAM & Admin > Service accounts > select the account > Keys). The file is now in `.gitignore` so it won’t be committed again. Keep the service account file only on your backend server.

---

## What’s already in the project

- **Firebase SDK** – `firebase` is used for FCM in the browser.
- **Backend registration** – After the user allows notifications, the app gets an FCM token and sends it to your API with `POST /notifications/device` (`device: "web"`).
- **Foreground handling** – When the app is open, incoming messages are handled in the client; you can show in-app toasts or use the browser `Notification` API.
- **Background handling** – A service worker (`public/firebase-messaging-sw.js`) shows system notifications when the app is in the background or closed.

## 1. Where to find each value

### Step 1 – Web app config (API Key, Project ID, App ID, etc.)

1. Open **[Firebase Console](https://console.firebase.google.com/)** and select your project (e.g. **hope-7ea3f**).
2. Click the **gear icon** next to “Project Overview” → **Project settings**.
3. In **General**, scroll to **Your apps**.
4. If you don’t have a **Web** app yet: click **</>** (Add app) → register a name → **Register app** (you can skip Firebase Hosting for now).
5. You’ll see a **firebaseConfig** object. Copy each value into your `.env` as below:

| Your `.env` variable | Where it is in Firebase (firebaseConfig) |
|----------------------|------------------------------------------|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` (often `"your-project-id.firebaseapp.com"`) |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` (often `"your-project-id.appspot.com"`) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` (number – paste as-is) |
| `VITE_FIREBASE_APP_ID` | `appId` (long string like `"1:123456:web:abc..."`) |

You can also find the same config later under **Project settings** → **General** → **Your apps** → your Web app → **Config** (or “SDK setup and configuration”).

### Step 2 – VAPID key (for web push)

1. Still in **Project settings**, open the **Cloud Messaging** tab.
2. Scroll to **Web Push certificates**.
3. If there is no key yet: click **Generate key pair**. A long string (the public VAPID key) will appear.
4. Copy that full string → put it in `.env` as **`VITE_FIREBASE_VAPID_KEY`** (no quotes in `.env`).

That’s the only place you get the VAPID key; it’s not in the `firebaseConfig` object.

### Quick checklist

- [ ] Firebase Console → Project settings → General → Your apps → Web app → copy **apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId** into the six `VITE_FIREBASE_*` vars in `.env`.
- [ ] Firebase Console → Project settings → **Cloud Messaging** → Web Push certificates → copy **Key pair** into `VITE_FIREBASE_VAPID_KEY` in `.env`.

## 2. Environment variables

In your `.env` (and `.env.production` for production), add:

```env
# Firebase (FCM for web)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_public_key
```

Use the same values as in the Firebase Console (and the **public** VAPID key from Cloud Messaging).

## 3. Service worker config (background notifications)

The file `public/firebase-messaging-sw.js` is used for **background** push (when the tab is in the background or closed). It cannot read `.env`, so you must put your Firebase config inside it.

Edit `public/firebase-messaging-sw.js` and replace the `firebaseConfig` object with your real values (same as in `.env`):

```javascript
const firebaseConfig = {
  apiKey: "your_api_key",
  authDomain: "your_project_id.firebaseapp.com",
  projectId: "your_project_id",
  storageBucket: "your_project_id.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id",
};
```

Optional: you can add a build step (e.g. a small Node script or Vite plugin) that generates this file from your env so you don’t maintain two copies of the config.

## 4. Backend

Your backend already has:

- `POST /notifications/device` with body: `{ deviceId, regToken, device, type? }`.

Ensure it accepts `device: "web"` and stores the token (e.g. by user/session) so you can target web clients when sending messages from your server or from Firebase (Admin SDK).

## 5. How it runs in the app

- When a user is **logged in** and the app is inside the protected layout, `FcmInit` runs once:
  - It checks that Firebase env vars and VAPID key are set.
  - It requests notification permission.
  - It registers the service worker at `/firebase-messaging-sw.js`, gets an FCM token, and calls `POST /notifications/device` with `device: "web"` and that token.
- **Foreground**: `onMessage` in `src/services/fcm.ts` receives payloads; `FcmInit` can show a browser `Notification` if you pass a title/body.
- **Background**: `firebase-messaging-sw.js` receives the push and calls `showNotification`.

## 6. HTTPS and local testing

- Push and the Push API require a **secure context** (HTTPS or `localhost`).
- For local dev, `localhost` is fine. For production, use HTTPS.

## 7. Sending test messages

- **Firebase Console**: Cloud Messaging > “Send your first message” or “New campaign”. Choose “Web” and optionally provide the FCM token of a test device.
- **Backend**: Use the Firebase Admin SDK (or your own API that uses it) to send to the tokens you stored from `POST /notifications/device`.

## Summary

| Step | Action |
|------|--------|
| 1 | Create/use a Firebase project and get Web app config + VAPID key. |
| 2 | Set `VITE_FIREBASE_*` and `VITE_FIREBASE_VAPID_KEY` in `.env`. |
| 3 | Edit `public/firebase-messaging-sw.js` and paste the same Firebase config. |
| 4 | Ensure backend accepts `device: "web"` and stores the token. |
| 5 | Deploy with HTTPS (except localhost). |

After that, FCM for web is enabled: tokens are registered when users are logged in, and they can receive push notifications in the foreground (via the app) and in the background (via the service worker).
