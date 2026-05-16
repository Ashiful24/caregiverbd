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
import ConsultationTypeLevels from "./pages/ConsultationTypeLevels";
import SystemConfig from "./pages/SystemConfig";
import UpgradeRequests from "./pages/UpgradeRequests";
import UpgradeRequestDetail from "./pages/UpgradeRequestDetail";
import Notifications from "./pages/Notifications";
import WithdrawalRequests from "./pages/WithdrawalRequests";
import CancellationRefunds from "./pages/CancellationRefunds";
import MasterFinancialReport from "./pages/MasterFinancialReport";
import GlReconciliation from "./pages/GlReconciliation";
import NurseScheduleList from "./pages/NurseScheduleList";
import NurseScheduleCalendarPage from "./pages/NurseScheduleCalendarPage";
import SupervisorList from "./pages/SupervisorList";
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
          <Route
            index
            path="/"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "SUPERVISOR"]}>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <PatientList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/providers"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "SUPERVISOR"]}>
                <ProviderList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule/:requestId"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "SUPERVISOR"]}>
                <NurseScheduleCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "SUPERVISOR"]}>
                <NurseScheduleList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisors"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <SupervisorList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <UserList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consultation-types"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <ConsultationTypeTree />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consultation-types/config/:id"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <ConsultationTypeConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <ServiceRequestList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade-requests"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <UpgradeRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade-requests/:id"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <UpgradeRequestDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/financial-reports"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <MasterFinancialReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gl-reconciliation"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <GlReconciliation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/withdrawal-requests"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <WithdrawalRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cancellation-refunds"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <CancellationRefunds />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "SUPERVISOR"]}>
                <UserProfiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verification-documents"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <VerificationDocuments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/verification-document-types"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <VerificationDocumentTypes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consultation-type-levels"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <ConsultationTypeLevels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/system-config"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <SystemConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <Notifications />
              </ProtectedRoute>
            }
          />
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
