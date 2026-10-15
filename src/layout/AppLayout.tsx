import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { DEMO_DATA_EVENT } from "../mock";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import { FcmInit } from "../components/common/FcmInit";

/** Remount the page when the demo data changes in another tab (e.g. the mobile app view). */
function useDemoDataVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(DEMO_DATA_EVENT, bump);
    return () => window.removeEventListener(DEMO_DATA_EVENT, bump);
  }, []);
  return version;
}

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const demoVersion = useDemoDataVersion();

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Outlet key={demoVersion} />
        </div>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <FcmInit />
      <LayoutContent />
    </SidebarProvider>
  );
};

export default AppLayout;
