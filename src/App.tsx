import { Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import PatientList from "./pages/PatientList";
import ProviderList from "./pages/ProviderList";
import UserList from "./pages/UserList";
import ConsultationTypeTree from "./pages/ConsultationTypeTree";
import ConsultationTypeConfig from "./pages/ConsultationTypeConfig";
import ServiceRequestList from "./pages/ServiceRequestList";
import VerificationDocuments from "./pages/VerificationDocuments";
import VerificationDocumentTypes from "./pages/VerificationDocumentTypes";
import SystemConfig from "./pages/SystemConfig";
import UpgradeRequests from "./pages/UpgradeRequests";
import UpgradeRequestDetail from "./pages/UpgradeRequestDetail";
import Notifications from "./pages/Notifications";
import FinancialReports from "./pages/FinancialReports";
import NurseScheduleList from "./pages/NurseScheduleList";
import NurseScheduleCalendarPage from "./pages/NurseScheduleCalendarPage";
import ProtectedRoute from "./components/common/ProtectedRoute";
import PublicRoute from "./components/common/PublicRoute";

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Protected Dashboard Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index path="/" element={<Home />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/providers" element={<ProviderList />} />
          <Route path="/schedule/:requestId" element={<NurseScheduleCalendarPage />} />
          <Route path="/schedule" element={<NurseScheduleList />} />
          <Route path="/users" element={<UserList />} />
          <Route path="/consultation-types" element={<ConsultationTypeTree />} />
          <Route path="/consultation-types/config/:id" element={<ConsultationTypeConfig />} />
          <Route path="/appointments" element={<ServiceRequestList />} />
          <Route path="/upgrade-requests" element={<UpgradeRequests />} />
          <Route path="/upgrade-requests/:id" element={<UpgradeRequestDetail />} />
          <Route path="/financial-reports" element={<FinancialReports />} />
          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/verification-documents" element={<VerificationDocuments />} />
          <Route path="/verification-document-types" element={<VerificationDocumentTypes />} />
          <Route path="/system-config" element={<SystemConfig />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* Public Auth Routes */}
        <Route
          path="/signin"
          element={
            <PublicRoute>
              <SignIn />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignUp />
            </PublicRoute>
          }
        />

        {/* Fallback Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
