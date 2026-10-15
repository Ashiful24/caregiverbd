import { Route, Routes } from "react-router";
import { ClipboardList, HeartPulse, House, Search as SearchIcon, UserRound } from "lucide-react";
import { getSession, patientApi } from "../api";
import { useApi } from "../hooks";
import { AppShell } from "../AppShell";
import { BottomNav } from "../ui";
import { NotificationsScreen, useUnreadCount } from "../shared";
import PatientHome from "./Home";
import { OpenRequest, ProviderDetail } from "./Search";
import { Search } from "./FindProvider";
import { RequestDetail, Requests } from "./Requests";
import { LongTermDetail, NewLongTerm } from "./LongTerm";
import Health from "./Health";
import { Favorites, Payments, Profile } from "./Profile";

function PatientNav() {
  return (
    <BottomNav
      items={[
        { to: "/app/patient", label: "Home", icon: <House size={21} />, end: true },
        { to: "/app/patient/search", label: "Book", icon: <SearchIcon size={21} /> },
        { to: "/app/patient/requests", label: "Bookings", icon: <ClipboardList size={21} /> },
        { to: "/app/patient/health", label: "Health", icon: <HeartPulse size={21} /> },
        { to: "/app/patient/profile", label: "Profile", icon: <UserRound size={21} /> },
      ]}
    />
  );
}

export default function PatientApp() {
  const session = getSession("PATIENT");
  const unread = useUnreadCount("PATIENT");
  const me = useApi(() => patientApi.get("/patients/me"), []);
  const firstName = me.data?.firstName ?? session?.user.firstName ?? "";
  const lastName = me.data?.lastName ?? session?.user.lastName ?? "";
  return (
    <AppShell
      name={`${firstName} ${lastName}`}
      subtitle={me.data ? `Patient · ${me.data.address ?? ""}` : "Patient"}
      verified={me.data?.status === "ACTIVE"}
      unread={unread}
      base="/app/patient"
      nav={<PatientNav />}
    >
      <Routes>
        <Route index element={<PatientHome />} />
        <Route path="search" element={<Search />} />
        <Route path="open-request" element={<OpenRequest />} />
        <Route path="providers/:id" element={<ProviderDetail />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="long-term/new" element={<NewLongTerm />} />
        <Route path="long-term/:id" element={<LongTermDetail />} />
        <Route path="health" element={<Health />} />
        <Route path="notifications" element={<NotificationsScreen role="PATIENT" back />} />
        <Route path="profile" element={<Profile />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="payments" element={<Payments />} />
      </Routes>
    </AppShell>
  );
}
