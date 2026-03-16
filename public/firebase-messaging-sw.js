/**
 * FCM background message handler (service worker).
 * Must use the same config as your web app for push to work when tab is in background.
 */
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBOS0bC6nD5cAVBwS2uy_E6sr8AQ-VRwVA",
  authDomain: "hope-7ea3f.firebaseapp.com",
  projectId: "hope-7ea3f",
  storageBucket: "hope-7ea3f.firebasestorage.app",
  messagingSenderId: "513314877093",
  appId: "1:513314877093:web:b4369d7d48467f0e49a74c",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title ?? payload?.data?.title ?? "Notification";
  const options = {
    body: payload?.notification?.body ?? payload?.data?.body ?? "",
    icon: "/favicon.png",
    data: payload?.data ?? {},
  };
  return self.registration.showNotification(title, options);
});
