import { Route, Routes } from "react-router";
import { BriefcaseMedical, CalendarDays, CalendarRange, House, UserRound, Wallet } from "lucide-react";
import { getSession, providerApi } from "../api";
import { useApi } from "../hooks";
import { AppShell } from "../AppShell";
import { BottomNav } from "../ui";
import { NotificationsScreen, useUnreadCount } from "../shared";
import ProviderHome from "./Home";
import { JobDetail, Jobs } from "./Jobs";
import { ShiftDetail, Shifts } from "./Shifts";
import Schedule from "./Schedule";
import WalletScreen from "./Wallet";
import { ProviderProfile, Reviews, ServicesOffered, Settings, Upgrade } from "./Profile";
import Verification from "./Verification";

function ProviderNav() {
  const caregiver = getSession("PROVIDER")?.providerCategory === "CAREGIVER";
  return (
    <BottomNav
      items={[
        { to: "/app/provider", label: "Home", icon: <House size={21} />, end: true },
        { to: "/app/provider/jobs", label: "Jobs", icon: <BriefcaseMedical size={21} /> },
        caregiver
          ? { to: "/app/provider/shifts", label: "Shifts", icon: <CalendarRange size={21} /> }
          : { to: "/app/provider/schedule", label: "Schedule", icon: <CalendarDays size={21} /> },
        { to: "/app/provider/wallet", label: "Wallet", icon: <Wallet size={21} /> },
        { to: "/app/provider/profile", label: "Profile", icon: <UserRound size={21} /> },
      ]}
    />
  );
}

export default function ProviderApp() {
  const session = getSession("PROVIDER");
  const unread = useUnreadCount("PROVIDER");
  const me = useApi(() => providerApi.get("/providers/me"), []);
  const d = me.data;
  const active = d?.status === "ACTIVE";
  const firstName = d?.firstName ?? session?.user.firstName ?? "";
  const type = d?.consultationTypeName ?? session?.providerType;
  return (
    <AppShell
      name={d?.providerName ?? `${firstName} ${session?.user.lastName ?? ""}`}
      subtitle={type ? `Provider · ${type}` : "Provider"}
      verified={active}
      unread={unread}
      base="/app/provider"
      nav={<ProviderNav />}
    >
      <Routes>
        <Route index element={<ProviderHome />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="shifts/:slotId" element={<ShiftDetail />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="wallet" element={<WalletScreen />} />
        <Route path="notifications" element={<NotificationsScreen role="PROVIDER" back />} />
        <Route path="profile" element={<ProviderProfile />} />
        <Route path="verification" element={<Verification />} />
        <Route path="services" element={<ServicesOffered />} />
        <Route path="settings" element={<Settings />} />
        <Route path="upgrade" element={<Upgrade />} />
        <Route path="reviews" element={<Reviews />} />
      </Routes>
    </AppShell>
  );
}
