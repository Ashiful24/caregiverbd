import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import ThemedSelect from "../components/form/ThemedSelect";
import { DetailModal } from "../components/common/DetailModal";
import { ProviderFullDetailsView } from "../components/common/ProfileDetailBlocks";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import Badge from "../components/ui/badge/Badge";
import {
  providersApi,
  consultationTypesApi,
  verificationDocumentTypesApi,
  type ProviderFullDetailsDto,
  type ProviderListItem,
  type ConsultationType,
  type ProviderListStatusFilter,
  type VerificationDocumentTypeItem,
} from "../services/api";
import { formatDate, formatStatusLabel } from "../utils/format";
import { useAuth } from "../context/AuthContext";

const LIMIT_OPTIONS = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

/** Status tabs: All | Pending | Rejected | Active | Deactivated | Archived (matches backend enum) */
const STATUS_TABS: { value: ProviderListStatusFilter }[] = [
  { value: "all" },
  { value: "pending" },
  { value: "rejected" },
  { value: "active" },
  { value: "deactivated" },
  { value: "archived" },
];

function normalizeTree(
  data: ConsultationType[] | ConsultationType | null | undefined
): ConsultationType[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

/** Flatten consultation types to options: { id, name, depth }. */
function flattenConsultationTypes(
  roots: ConsultationType[],
  depth = 0
): { id: number; name: string; depth: number }[] {
  const out: { id: number; name: string; depth: number }[] = [];
  for (const node of roots) {
    out.push({ id: node.id, name: node.name, depth });
    if (Array.isArray(node.children) && node.children.length > 0) {
      out.push(...flattenConsultationTypes(node.children, depth + 1));
    }
  }
  return out;
}

function providerStatusBadgeColor(status: string): "success" | "warning" | "error" | "light" {
  switch (String(status).toUpperCase()) {
    case "ACTIVE":
    case "AVAILABLE":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "error";
    case "DEACTIVATED":
      return "light";
    case "ARCHIVED":
    default:
      return "light";
  }
}

export default function ProviderList() {
  const { t, i18n } = useTranslation();
  const apiLang: "en" | "bn" = i18n.resolvedLanguage === "bn" ? "bn" : "en";
  const { user } = useAuth();
  const currentRole = String(user?.role ?? "").toUpperCase();
  const supervisorId =
    currentRole === "SUPERVISOR" && Number.isFinite(Number(user?.id)) && Number(user?.id) > 0
      ? Number(user?.id)
      : undefined;

  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [consultationTypes, setConsultationTypes] = useState<ConsultationType[]>([]);
  const [consultationTypeFilterId, setConsultationTypeFilterId] = useState<number | "">("");
  const [documentTypes, setDocumentTypes] = useState<VerificationDocumentTypeItem[]>([]);
  const [documentTypeFilterCode, setDocumentTypeFilterCode] = useState<string>("");
  const [statusTab, setStatusTab] = useState<ProviderListStatusFilter>("all");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<ProviderFullDetailsDto | null>(null);

  // Debounce search: update searchQuery (and reset to page 1) after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /** Dropdown options from GET /consultation-types. Backend GET /admin/providers accepts consultationTypeId (single ID) and includes type + descendants. */
  const fetchConsultationTypes = useCallback(async () => {
    try {
      const response = await consultationTypesApi.getAll({ lang: apiLang });
      const data = response.data as ConsultationType[] | ConsultationType | null | undefined;
      setConsultationTypes(normalizeTree(data));
    } catch {
      setConsultationTypes([]);
    }
  }, [apiLang]);

  useEffect(() => {
    fetchConsultationTypes();
  }, [fetchConsultationTypes]);

  /** Dropdown options from GET /admin/verification-document-types. */
  const fetchDocumentTypes = useCallback(async () => {
    try {
      const response = await verificationDocumentTypesApi.list({ activeOnly: true, lang: apiLang });
      const data = response?.data;
      const list = Array.isArray(data) ? data : Array.isArray(response) ? response : [];
      setDocumentTypes(list);
    } catch {
      setDocumentTypes([]);
    }
  }, [apiLang]);

  useEffect(() => {
    fetchDocumentTypes();
  }, [fetchDocumentTypes]);

  const consultationTypeOptions = useMemo(
    () => flattenConsultationTypes(consultationTypes),
    [consultationTypes]
  );

  /** Refetch list. Use silent: true after detail updates to avoid full-page skeleton. */
  const fetchProviders = async (signal?: AbortSignal, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    let aborted = false;
    try {
      const response = await providersApi.getList(
        {
          page,
          limit,
          search: searchQuery || undefined,
          consultationTypeId:
            consultationTypeFilterId === "" || consultationTypeFilterId == null
              ? undefined
              : Number(consultationTypeFilterId),
          status: statusTab === "all" ? undefined : statusTab,
          documentType:
            documentTypeFilterCode === "" ? undefined : documentTypeFilterCode,
          ...(supervisorId != null ? { supervisorId } : {}),
        },
        { signal }
      );
      const payload = response.data as {
        providers?: ProviderListItem[];
        total?: number;
        page?: number;
        limit?: number;
      } | null;
      const list = payload?.providers ?? [];
      const totalCount = payload?.total ?? 0;
      const limitVal = payload?.limit ?? limit;
      setProviders(Array.isArray(list) ? list : []);
      setTotal(totalCount);
      setTotalPages(limitVal > 0 ? Math.ceil(totalCount / limitVal) || 1 : 1);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        aborted = true;
        return;
      }
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("providers.failedLoad");
      if (!silent) setError(message);
      if (!silent) {
        setProviders([]);
        setTotal(0);
        setTotalPages(0);
      }
    } finally {
      if (!aborted && !silent) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchProviders(controller.signal);
    return () => controller.abort();
  }, [
    page,
    limit,
    searchQuery,
    consultationTypeFilterId,
    documentTypeFilterCode,
    statusTab,
  ]);

  const loadProviderDetail = useCallback(async (providerId: number) => {
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await providersApi.getDetails(providerId);
      const data = (res?.data ?? res) as ProviderFullDetailsDto | null;
      setDetailData(data);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (detailModalOpen && detailProviderId != null) {
      loadProviderDetail(detailProviderId);
    } else {
      setDetailData(null);
    }
  }, [detailModalOpen, detailProviderId, loadProviderDetail]);

  const openDetails = (providerId: number) => {
    setDetailProviderId(providerId);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setDetailProviderId(null);
    setDetailData(null);
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      <PageMeta
        title={t("providers.metaTitle")}
        description={t("providers.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("providers.pageTitle")} />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("providers.heading")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("providers.subheading")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:ml-auto">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                placeholder={t("providers.searchProviders")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full min-w-[200px] rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:w-56"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="shrink-0">{t("providers.consultationType")}</span>
              <ThemedSelect
                value={consultationTypeFilterId}
                onChange={(e) => {
                  const v = e.target.value;
                  setConsultationTypeFilterId(v === "" ? "" : Number(v));
                  setPage(1);
                }}
                className="min-w-[180px] rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">{t("providers.allTypes")}</option>
                {consultationTypeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.depth > 0 ? "—".repeat(opt.depth) + " " : ""}
                    {opt.name}
                  </option>
                ))}
              </ThemedSelect>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="shrink-0">{t("providers.verificationDocument")}</span>
              <ThemedSelect
                value={documentTypeFilterCode}
                onChange={(e) => {
                  setDocumentTypeFilterCode(e.target.value);
                  setPage(1);
                }}
                className="min-w-[180px] rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">{t("providers.allDocuments")}</option>
                {documentTypes.map((opt) => (
                  <option key={opt.id} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </ThemedSelect>
            </label>
          </div>
        </div>

        {/* Status tabs */}
        <div className="border-b border-gray-200 px-4 dark:border-gray-800 sm:px-6">
          <nav
            className="-mb-px flex gap-4 overflow-x-auto pb-px sm:gap-8"
            aria-label={t("providers.statusFilter")}
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusTab(tab.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors ${
                  statusTab === tab.value
                    ? "border-brand-500 text-brand-500 dark:border-brand-500 dark:text-brand-500"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {tab.value === "all"
                  ? t("providers.statusAll")
                  : tab.value === "pending"
                  ? t("providers.statusPending")
                  : tab.value === "rejected"
                  ? t("providers.statusRejected")
                  : tab.value === "active"
                  ? t("providers.statusActive")
                  : tab.value === "deactivated"
                  ? t("providers.statusDeactivated")
                  : t("providers.statusArchived")}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:mx-6">
            {error}
          </div>
        )}

        <div className="px-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : providers.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              {statusTab === "all" && t("providers.noProvidersFound")}
              {statusTab === "pending" && t("providers.noPendingProvidersFound")}
              {statusTab === "active" && t("providers.noActiveProvidersFound")}
              {statusTab === "rejected" && t("providers.noRejectedProvidersFound")}
              {statusTab === "deactivated" && t("providers.noDeactivatedProvidersFound")}
              {statusTab === "archived" && t("providers.noArchivedProvidersFound")}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {providers.map((provider, index) => (
                  <div
                    key={provider.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetails(provider.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetails(provider.id);
                      }
                    }}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {[provider.firstName, provider.lastName].filter(Boolean).join(" ") || "—"}
                      </span>
                      <Badge size="sm" color={providerStatusBadgeColor(provider.status)}>
                        {formatStatusLabel(provider.status)}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">#</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{(page - 1) * limit + index + 1}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("providers.consultationType")}</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{provider.consultationTypeName ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("providers.email")}</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{provider.email ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("providers.phone")}</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{provider.username ?? "—"}</dd>
                      </div>
                      {provider.createdAt && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-gray-500 dark:text-gray-400">{t("providers.created")}</dt>
                          <dd className="text-gray-800 dark:text-gray-200">{formatDate(provider.createdAt)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block" style={{ WebkitOverflowScrolling: "touch" }}>
                <Table>
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="w-[5%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">#</TableCell>
                      <TableCell isHeader className="w-[16%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("providers.providerName")}</TableCell>
                      <TableCell isHeader className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("users.status")}</TableCell>
                      <TableCell isHeader className="w-[14%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("providers.consultationType")}</TableCell>
                      <TableCell isHeader className="w-[16%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("providers.email")}</TableCell>
                      <TableCell isHeader className="w-[12%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("providers.phone")}</TableCell>
                      <TableCell isHeader className="w-[12%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("providers.created")}</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {providers.map((provider, index) => (
                      <TableRow
                        key={provider.id}
                        onClick={() => openDetails(provider.id)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">{(page - 1) * limit + index + 1}</TableCell>
                        <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                          {[provider.firstName, provider.lastName].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge size="sm" color={providerStatusBadgeColor(provider.status)}>
                            {formatStatusLabel(provider.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">{provider.consultationTypeName ?? "—"}</TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400 truncate max-w-[140px]" title={provider.email ?? ""}>{provider.email ?? "—"}</TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">{provider.username ?? "—"}</TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {provider.createdAt ? formatDate(String(provider.createdAt)) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {!loading && providers.length > 0 && totalPages > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.rowsPerPage")}
                <ThemedSelect
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </ThemedSelect>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.showingRangeOf", {
                  from,
                  to,
                  total,
                  entity: t("providers.providersEntity"),
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t("common.actions.previous")}
              </button>
              <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.pageOf", { page, totalPages })}
              </span>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t("common.actions.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      <DetailModal
        title={t("providers.detailsTitle")}
        isOpen={detailModalOpen}
        onClose={closeDetailModal}
        loading={detailLoading}
        errorMessage={!detailLoading && !detailData ? t("providers.detailsLoadError") : null}
      >
        {detailData && (
          <ProviderFullDetailsView
            data={detailData}
            onRefresh={() => {
              if (detailProviderId != null) {
                loadProviderDetail(detailProviderId);
                fetchProviders(undefined, { silent: true });
              }
            }}
          />
        )}
      </DetailModal>
    </>
  );
}
