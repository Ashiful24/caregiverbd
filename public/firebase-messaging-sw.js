/**
 * FCM background message handler (service worker).
 * Must use the same Firebase project as the web app (ontor-a20b9) for push to work when tab is in background.
 */
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyAHXRWkvnXMcQZqLO6WgLaMJ3HEdwVkFVI",
  authDomain: "ontor-a20b9.firebaseapp.com",
  projectId: "ontor-a20b9",
  storageBucket: "ontor-a20b9.firebasestorage.app",
  messagingSenderId: "372733953913",
  appId: "1:372733953913:web:62b4fcd7e5b2da2df851a8",
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
