import { useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { BatteryFull, SignalHigh, Wifi } from "lucide-react";
import { getSession, type Role } from "./api";
import { ToastProvider } from "./ui";
import Launcher from "./Launcher";
import { ForgotPassword, Login, Register } from "./auth/AuthScreens";
import PatientApp from "./patient/PatientApp";
import ProviderApp from "./provider/ProviderApp";

function RequireSession({ role, children }: { role: Role; children: ReactNode }) {
  const location = useLocation();
  const base = role === "PATIENT" ? "/app/patient" : "/app/provider";
  if (!getSession(role)) return <Navigate to={`${base}/login`} replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function useClock() {
  const fmt = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 15_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/** Phone status bar with the front-camera cut-out; only drawn inside the desktop frame. */
function StatusBar() {
  const time = useClock();
  return (
    <div className="relative hidden h-9 shrink-0 items-center justify-between bg-white px-7 text-[13px] font-semibold text-gray-900 md:flex dark:bg-gray-900 dark:text-white">
      <span>{time}</span>
      <div aria-hidden className="absolute left-1/2 top-2 flex h-[26px] w-[104px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-3">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-800 ring-2 ring-gray-900">
          <span className="block h-1 w-1 translate-x-[3px] translate-y-[3px] rounded-full bg-blue-900/80" />
        </span>
      </div>
      <span className="flex items-center gap-1">
        <SignalHigh size={15} />
        <Wifi size={15} />
        <BatteryFull size={18} />
      </span>
    </div>
  );
}

/** Full screen on phones; a phone with a camera notch on desktop. */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-100 dark:bg-gray-950 md:flex md:items-center md:justify-center md:p-6">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-gray-950 md:h-[844px] md:max-h-[calc(100dvh-48px)] md:w-[400px] md:rounded-[3rem] md:border-[12px] md:border-gray-900 md:shadow-2xl dark:md:border-gray-700">
        <StatusBar />
        <div className="relative min-h-0 flex-1">{children}</div>
        <div aria-hidden className="hidden h-5 shrink-0 items-center justify-center bg-white md:flex dark:bg-gray-900">
          <span className="h-1 w-32 rounded-full bg-gray-900 dark:bg-gray-300" />
        </div>
      </div>
    </div>
  );
}

export default function MobileApp() {
  return (
    <PhoneFrame>
      <ToastProvider>
        <Routes>
          <Route index element={<Launcher />} />
          <Route path="patient/login" element={<Login role="PATIENT" />} />
          <Route path="patient/register" element={<Register role="PATIENT" />} />
          <Route path="patient/forgot" element={<ForgotPassword role="PATIENT" />} />
          <Route path="provider/login" element={<Login role="PROVIDER" />} />
          <Route path="provider/register" element={<Register role="PROVIDER" />} />
          <Route path="provider/forgot" element={<ForgotPassword role="PROVIDER" />} />
          <Route
            path="patient/*"
            element={
              <RequireSession role="PATIENT">
                <PatientApp />
              </RequireSession>
            }
          />
          <Route
            path="provider/*"
            element={
              <RequireSession role="PROVIDER">
                <ProviderApp />
              </RequireSession>
            }
          />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </ToastProvider>
    </PhoneFrame>
  );
}
