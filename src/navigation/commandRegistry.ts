/** Client-only command palette destinations (no backend calls). Roles align with App routes / sidebar. */

export type CmdGroup =
  | "core"
  | "people"
  | "operations"
  | "cancellations"
  | "configuration"
  | "reports"
  | "account";

export type NavCommand = {
  id: string;
  path: `/${string}`;
  titleKey: string;
  group: CmdGroup;
  /** If omitted, all authenticated admin-app roles may see — use explicit list matching router. */
  allowedRoles?: string[];
  /** Extra lowercase substring hints (ASCII). Still matches translated title and path. */
  keywords?: string[];
};

export const NAV_COMMANDS: NavCommand[] = [
  {
    id: "dashboard",
    path: "/",
    titleKey: "navigation.dashboard",
    group: "core",
    allowedRoles: ["ADMIN", "SUPERVISOR"],
    keywords: ["home", "main"],
  },
  {
    id: "providers",
    path: "/providers",
    titleKey: "navigation.providers",
    group: "people",
    allowedRoles: ["ADMIN", "SUPERVISOR"],
    keywords: ["nurses", "care"],
  },
  {
    id: "patients",
    path: "/patients",
    titleKey: "navigation.patients",
    group: "people",
    allowedRoles: ["ADMIN"],
    keywords: ["users", "client"],
  },
  {
    id: "schedule",
    path: "/schedule",
    titleKey: "navigation.serviceRequest",
    group: "people",
    allowedRoles: ["ADMIN", "SUPERVISOR"],
    keywords: ["calendar", "shift", "shifts"],
  },
  {
    id: "supervisors",
    path: "/supervisors",
    titleKey: "navigation.supervisor",
    group: "people",
    allowedRoles: ["ADMIN"],
  },
  {
    id: "users",
    path: "/users",
    titleKey: "navigation.allUsers",
    group: "people",
    allowedRoles: ["ADMIN"],
    keywords: ["accounts", "staff"],
  },
  {
    id: "appointments",
    path: "/appointments",
    titleKey: "navigation.appointments",
    group: "operations",
    allowedRoles: ["ADMIN"],
    keywords: ["booking", "service"],
  },
  {
    id: "upgrade-requests",
    path: "/upgrade-requests",
    titleKey: "navigation.upgradeRequests",
    group: "operations",
    allowedRoles: ["ADMIN"],
    keywords: ["upgrade"],
  },
  {
    id: "withdrawal-requests",
    path: "/withdrawal-requests",
    titleKey: "navigation.withdrawalRequests",
    group: "operations",
    allowedRoles: ["ADMIN"],
    keywords: ["payout", "wallet"],
  },
  {
    id: "provider-cancel-requests",
    path: "/provider-cancel-requests",
    titleKey: "navigation.providerCancelRequests",
    group: "cancellations",
    allowedRoles: ["ADMIN"],
    keywords: ["provider", "cancel", "review", "reassign", "cancellation"],
  },
  {
    id: "cancellation-refunds",
    path: "/cancellation-refunds",
    titleKey: "navigation.cancellationRefunds",
    group: "cancellations",
    allowedRoles: ["ADMIN"],
    keywords: ["refund", "cancel", "cancellation", "gateway"],
  },
  {
    id: "consultation-types",
    path: "/consultation-types",
    titleKey: "navigation.consultationTypes",
    group: "configuration",
    allowedRoles: ["ADMIN"],
    keywords: ["types", "consultation"],
  },
  {
    id: "consultation-type-levels",
    path: "/consultation-type-levels",
    titleKey: "navigation.consultationTypeLevels",
    group: "configuration",
    allowedRoles: ["ADMIN"],
    keywords: ["levels"],
  },
  {
    id: "verification-document-types",
    path: "/verification-document-types",
    titleKey: "navigation.documentTypes",
    group: "configuration",
    allowedRoles: ["ADMIN"],
    keywords: ["kyc", "documents"],
  },
  {
    id: "service-checklist-groups",
    path: "/service-checklist-groups",
    titleKey: "navigation.serviceChecklistGroups",
    group: "configuration",
    allowedRoles: ["ADMIN"],
    keywords: ["checklist", "service", "groups"],
  },
  {
    id: "verification-documents",
    path: "/verification-documents",
    titleKey: "navigation.verificationDocuments",
    group: "configuration",
    allowedRoles: ["ADMIN"],
    keywords: ["uploads", "files"],
  },
  {
    id: "system-config",
    path: "/system-config",
    titleKey: "navigation.systemConfig",
    group: "configuration",
    allowedRoles: ["ADMIN"],
    keywords: ["settings", "keys"],
  },
  {
    id: "financial-reports",
    path: "/financial-reports",
    titleKey: "navigation.masterFinancialReport",
    group: "reports",
    allowedRoles: ["ADMIN"],
    keywords: ["money", "master", "financial"],
  },
  {
    id: "gl-reconciliation",
    path: "/gl-reconciliation",
    titleKey: "navigation.glReconciliation",
    group: "reports",
    allowedRoles: ["ADMIN"],
    keywords: ["gl", "ledger", "reconcile"],
  },
  {
    id: "admin-supervisor-reporting",
    path: "/admin-supervisor-reporting",
    titleKey: "navigation.adminSupervisorReporting",
    group: "reports",
    allowedRoles: ["ADMIN", "SUPERVISOR"],
    keywords: ["admin", "supervisor", "reporting", "kpi", "dashboard"],
  },
  {
    id: "notifications",
    path: "/notifications",
    titleKey: "navigation.notifications",
    group: "account",
    allowedRoles: ["ADMIN"],
    keywords: ["alerts", "inbox"],
  },
  {
    id: "profile",
    path: "/profile",
    titleKey: "navigation.userProfile",
    group: "account",
    allowedRoles: ["ADMIN", "SUPERVISOR"],
    keywords: ["account", "me"],
  },
];

const GROUP_ORDER: CmdGroup[] = [
  "core",
  "people",
  "operations",
  "cancellations",
  "configuration",
  "reports",
  "account",
];

export function filterCommandsForRole(
  role: string,
  commands: NavCommand[] = NAV_COMMANDS,
): NavCommand[] {
  const r = role.toUpperCase();
  return commands.filter((c) => {
    if (!c.allowedRoles?.length) return true;
    return c.allowedRoles.map((x) => x.toUpperCase()).includes(r);
  });
}

export function sortCommandsByGroup(commands: NavCommand[]): NavCommand[] {
  return [...commands].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      a.id.localeCompare(b.id),
  );
}

export function commandMatchesQuery(
  cmd: NavCommand,
  q: string,
  translatedTitle: string,
): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  const title = translatedTitle.toLowerCase();
  const path = cmd.path.toLowerCase();
  if (title.includes(n) || path.includes(n)) return true;
  return (cmd.keywords ?? []).some((k) => k.includes(n) || n.includes(k));
}
