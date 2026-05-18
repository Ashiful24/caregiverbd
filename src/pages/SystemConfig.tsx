import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Settings2 } from "lucide-react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { SystemSettingsPanel } from "../components/admin-settings/SystemSettingsPanel";
import { SchedulerJobsPanel } from "../components/admin-settings/SchedulerJobsPanel";

type SettingsTab = "system" | "scheduler";

export default function SystemConfig() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>("system");

  const tabs: { id: SettingsTab; label: string; icon: typeof Settings2 }[] = [
    { id: "system", label: t("systemConfig.tabSystem"), icon: Settings2 },
    { id: "scheduler", label: t("systemConfig.tabScheduler"), icon: Clock },
  ];

  return (
    <>
      <PageMeta
        title={t("systemConfig.metaTitle")}
        description={t("systemConfig.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("systemConfig.pageTitle")} />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <header className="border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white px-5 py-6 dark:border-gray-800 dark:from-white/[0.04] dark:to-transparent lg:px-8">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {t("systemConfig.heading")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {t("systemConfig.pageIntro")}
          </p>

          <nav
            className="mt-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1 dark:border-gray-700 dark:bg-gray-900/50"
            aria-label={t("systemConfig.tabsLabel")}
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
                    active
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {label}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="p-5 lg:p-8">
          {tab === "system" ? <SystemSettingsPanel /> : <SchedulerJobsPanel />}
        </div>
      </div>
    </>
  );
}
