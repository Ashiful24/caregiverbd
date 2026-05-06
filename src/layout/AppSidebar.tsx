import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";

import {
  BoltIcon,
  CalenderIcon,
  ChevronDownIcon,
  FolderIcon,
  GridIcon,
  GroupIcon,
  HorizontaLDots,
  ListIcon,
  MailIcon,
  PageIcon,
  TaskIcon,
  UserCircleIcon,
  UserIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  nameKey: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { nameKey: string; path: string; pro?: boolean; new?: boolean }[];
  allowedRoles?: string[];
};

type NavSection = {
  titleKey?: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    items: [
      { icon: <GridIcon />, nameKey: "navigation.dashboard", path: "/", allowedRoles: ["ADMIN", "SUPERVISOR"] },
    ],
  },
  {
    titleKey: "navigation.appUsers",
    items: [{ icon: <UserCircleIcon />, nameKey: "navigation.allUsers", path: "/users", allowedRoles: ["ADMIN"] }],
  },
  {
    titleKey: "navigation.profile",
    items: [
      {
        icon: <GroupIcon />,
        nameKey: "navigation.providers",
        path: "/providers",
        allowedRoles: ["ADMIN", "SUPERVISOR"],
      },
      { icon: <UserIcon />, nameKey: "navigation.patients", path: "/patients", allowedRoles: ["ADMIN"] },
      {
        icon: <CalenderIcon />,
        nameKey: "navigation.serviceRequest",
        path: "/schedule",
        allowedRoles: ["ADMIN", "SUPERVISOR"],
      },
      { icon: <TaskIcon />, nameKey: "navigation.supervisor", path: "/supervisors", allowedRoles: ["ADMIN"] },
    ],
  },
  {
    titleKey: "navigation.configuration",
    items: [
      {
        icon: <FolderIcon />,
        nameKey: "navigation.consultationTypes",
        path: "/consultation-types",
        allowedRoles: ["ADMIN"],
      },
      {
        icon: <ListIcon />,
        nameKey: "navigation.consultationTypeLevels",
        path: "/consultation-type-levels",
        allowedRoles: ["ADMIN"],
      },
      {
        icon: <PageIcon />,
        nameKey: "navigation.documentTypes",
        path: "/verification-document-types",
        allowedRoles: ["ADMIN"],
      },
      { icon: <BoltIcon />, nameKey: "navigation.systemConfig", path: "/system-config", allowedRoles: ["ADMIN"] },
    ],
  },
  {
    titleKey: "navigation.operations",
    items: [
      { icon: <ListIcon />, nameKey: "navigation.appointments", path: "/appointments", allowedRoles: ["ADMIN"] },
      { icon: <PageIcon />, nameKey: "navigation.upgradeRequests", path: "/upgrade-requests", allowedRoles: ["ADMIN"] },
    ],
  },
  {
    title: "Finance",
    titleKey: "navigation.reports",
    items: [
      {
        icon: <GridIcon />,
        name: "Financial Reports",
        allowedRoles: ["ADMIN"],
        subItems: [
          { name: "Master Report", path: "/financial-reports" },
          { name: "GL Reconciliation", path: "/gl-reconciliation" },
        ],
      },
    ],
  },
  {
    items: [{ icon: <MailIcon />, nameKey: "navigation.notifications", path: "/notifications", allowedRoles: ["ADMIN"] }],
  },
];

const AppSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const currentRole = String(user?.role ?? "").toUpperCase();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "reference";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => {
      if (path === "/schedule") {
        return location.pathname === "/schedule" || location.pathname.startsWith("/schedule/");
      }
      return location.pathname === path;
    },
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;
    navSections.forEach((section, sectionIndex) => {
      section.items.forEach((nav) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({ type: "main", index: sectionIndex });
              submenuMatched = true;
            }
          });
        }
      });
    });
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "reference") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "reference") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.nameKey}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size  ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{t(nav.nameKey)}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{t(nav.nameKey)}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.nameKey}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {t(subItem.nameKey)}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const sectionsForRole = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.allowedRoles?.length) return true;
        return item.allowedRoles.map((r) => r.toUpperCase()).includes(currentRole);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden"
                src="/images/logo/logo.png"
                alt="Logo"
                width={150}
                height={40}
              />
              <img
                className="hidden dark:block"
                src="/images/logo/logo-dark.png"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  t("common.menu")
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              <div className="flex flex-col gap-6">
                {sectionsForRole.map((section, sectionIndex) => (
                  <div key={section.titleKey ?? sectionIndex}>
                    {section.titleKey && (isExpanded || isHovered || isMobileOpen) && (
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {t(section.titleKey)}
                      </p>
                    )}
                    {renderMenuItems(section.items, "main")}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
