import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import {
  DashboardKpiCards,
  ServiceRequestsChart,
  RecentActivityPanel,
} from "../../components/dashboard";
import {
  dashboardApi,
  type DashboardServiceRequestsSummary,
  type DashboardRecentServiceRequest,
} from "../../services/api";

interface DashboardData {
  totalPatients: number;
  totalProviders: number;
  pendingProviders: number;
  serviceRequests: DashboardServiceRequestsSummary | null;
  pendingCertifications: number;
  recentServiceRequests: DashboardRecentServiceRequest[];
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData>({
    totalPatients: 0,
    totalProviders: 0,
    pendingProviders: 0,
    serviceRequests: null,
    pendingCertifications: 0,
    recentServiceRequests: [],
  });

  const fetchDashboard = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    let aborted = false;
    try {
      const res = await dashboardApi.getSummary({ signal });
      const summary = res?.data;

      const totalPatients = summary?.patients?.total ?? 0;
      const totalProviders = summary?.providers?.total ?? 0;
      const pendingProviders = summary?.providers?.pending ?? 0;
      const serviceRequests = summary?.serviceRequests ?? null;
      const pendingCertifications = summary?.pendingCertifications ?? 0;
      const recentServiceRequests = Array.isArray(summary?.recentServiceRequests) ? summary.recentServiceRequests : [];

      setData({
        totalPatients,
        totalProviders,
        pendingProviders,
        serviceRequests,
        pendingCertifications,
        recentServiceRequests,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        aborted = true; // Strict Mode or navigation: first request was aborted
        return;
      }
      setError("Failed to load dashboard.");
    } finally {
      if (!aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchDashboard(ac.signal);
    return () => ac.abort(); // In dev (Strict Mode) this runs so the first request is aborted; the second run succeeds
  }, [fetchDashboard]);

  const activeRequestsCount =
    (data.serviceRequests?.PENDING ?? 0) + (data.serviceRequests?.IN_PROGRESS ?? 0) + (data.serviceRequests?.ACCEPTED ?? 0);

  return (
    <>
      <PageMeta
        title="Dashboard | Hope - BMQAS"
        description="Dashboard page for Hope Pro by Bengal Mobile QA Solution"
      />
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <section>
          <DashboardKpiCards
            totalPatients={data.totalPatients}
            totalProviders={data.totalProviders}
            pendingProviders={data.pendingProviders}
            activeRequestsCount={activeRequestsCount}
            pendingCertifications={data.pendingCertifications}
            loading={loading}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ServiceRequestsChart summary={data.serviceRequests} loading={loading} />
          <RecentActivityPanel items={data.recentServiceRequests} loading={loading} />
        </div>
      </div>
    </>
  );
}
