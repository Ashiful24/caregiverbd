import { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { initFcm } from "../../services/fcm";

/**
 * When the user is logged in and Firebase is configured, request notification permission,
 * get FCM token, and register it with the backend. Runs once per session.
 */
export function FcmInit() {
  const { isAuthenticated } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    initialized.current = true;
    initFcm({
      onForegroundMessage: (payload) => {
        if (payload?.title && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(String(payload.title), {
              body: payload.body ? String(payload.body) : undefined,
              icon: "/favicon.svg",
            });
          } catch {
            // ignore
          }
        }
      },
    }).catch(() => {
      initialized.current = false;
    });
  }, [isAuthenticated]);

  return null;
}
