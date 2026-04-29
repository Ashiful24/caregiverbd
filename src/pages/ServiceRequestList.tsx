import { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import Badge from "../components/ui/badge/Badge";
import {
  adminServiceRequestsApi,
  consultationTypesApi,
  type AdminServiceRequestListDto,
  type ConsultationType,
} from "../services/api";
import { formatDate, formatDateTime } from "../utils/format";

const LIMIT_OPTIONS = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

function normalizeTree(
  data: ConsultationType[] | ConsultationType | null | undefined
): ConsultationType[] {
  if (!data) return [];
  return Array.isArray(data) ? data : [data];
}

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

function serviceRequestStatusBadgeColor(
  status: string
): "success" | "warning" | "error" | "light" {
  const s = String(status).toUpperCase();
  switch (s) {
    case "COMPLETED":
    case "ACCEPTED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "error";
    case "IN_PROGRESS":
    case "PAYMENT_PENDING":
      return "light";
    default:
      return "light";
  }
}

export default function ServiceRequestList() {
  const [list, setList] = useState<AdminServiceRequestListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [consultationTypes, setConsultationTypes] = useState<ConsultationType[]>([]);
  const [consultationTypeFilterId, setConsultationTypeFilterId] = useState<
    number | ""
  >("");
  const [searchDoctorInput, setSearchDoctorInput] = useState("");
  const [searchDoctorQuery, setSearchDoctorQuery] = useState("");
  const [searchPatientInput, setSearchPatientInput] = useState("");
  const [searchPatientQuery, setSearchPatientQuery] = useState("");

  const fetchConsultationTypes = useCallback(async () => {
    try {
      const response = await consultationTypesApi.getAll();
      const data = response.data as
        | ConsultationType[]
        | ConsultationType
        | null
        | undefined;
      setConsultationTypes(normalizeTree(data));
    } catch {
      setConsultationTypes([]);
    }
  }, []);

  useEffect(() => {
    fetchConsultationTypes();
  }, [fetchConsultationTypes]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDoctorQuery(searchDoctorInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchDoctorInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchPatientQuery(searchPatientInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchPatientInput]);

  const consultationTypeOptions = useMemo(
    () => flattenConsultationTypes(consultationTypes),
    [consultationTypes]
  );

  const fetchList = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      let aborted = false;
      try {
        const response = await adminServiceRequestsApi.getList(
          {
            page,
            limit,
            consultationTypeId:
              consultationTypeFilterId === "" || consultationTypeFilterId == null
                ? undefined
                : Number(consultationTypeFilterId),
            searchDoctor: searchDoctorQuery || undefined,
            searchPatient: searchPatientQuery || undefined,
          },
          { signal }
        );
        const payload = response.data as {
          data?: AdminServiceRequestListDto[];
          total?: number;
          page?: number;
          limit?: number;
        } | null;
        const items = payload?.data ?? [];
        const totalCount = payload?.total ?? 0;
        const limitVal = payload?.limit ?? limit;
        setList(Array.isArray(items) ? items : []);
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
            : "Failed to load appointments.";
        setError(message);
        setList([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        if (!aborted) setLoading(false);
      }
    },
    [
      page,
      limit,
      consultationTypeFilterId,
      searchDoctorQuery,
      searchPatientQuery,
      limit,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      <PageMeta
        title="Appointments | Hope - BMQAS"
        description="All service requests (appointments) for Hope Pro by BMQAS"
      />
      <PageBreadcrumb pageTitle="Appointments" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Appointments
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              All service requests. Search by doctor or patient.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="shrink-0">Consultation type</span>
              <select
                value={consultationTypeFilterId}
                onChange={(e) => {
                  const v = e.target.value;
                  setConsultationTypeFilterId(v === "" ? "" : Number(v));
                  setPage(1);
                }}
                className="min-w-[180px] rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">All types</option>
                {consultationTypeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.depth > 0 ? "—".repeat(opt.depth) + " " : ""}
                    {opt.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 pb-4 dark:border-gray-800 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:pb-4">
          <input
            type="search"
            placeholder="Search by doctor..."
            value={searchDoctorInput}
            onChange={(e) => setSearchDoctorInput(e.target.value)}
            className="min-w-[180px] rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
          <input
            type="search"
            placeholder="Search by patient..."
            value={searchPatientInput}
            onChange={(e) => setSearchPatientInput(e.target.value)}
            className="min-w-[180px] rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
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
          ) : list.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              No appointments found.
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        #{item.id}
                      </span>
                      <Badge
                        size="sm"
                        color={serviceRequestStatusBadgeColor(item.status)}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">
                          Patient
                        </dt>
                        <dd className="text-gray-800 dark:text-gray-200">
                          {item.patientName ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">
                          Provider
                        </dt>
                        <dd className="text-gray-800 dark:text-gray-200">
                          {item.providerName ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">
                          Type
                        </dt>
                        <dd className="text-gray-800 dark:text-gray-200">
                          {item.consultationTypeName ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">
                          Amount
                        </dt>
                        <dd className="text-gray-800 dark:text-gray-200">
                          {item.amount ?? "—"}
                        </dd>
                      </div>
                      {item.scheduledAt && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-gray-500 dark:text-gray-400">
                            Scheduled
                          </dt>
                          <dd className="text-gray-800 dark:text-gray-200">
                            {formatDateTime(item.scheduledAt)}
                          </dd>
                        </div>
                      )}
                      {item.createdAt && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-gray-500 dark:text-gray-400">
                            Created
                          </dt>
                          <dd className="text-gray-800 dark:text-gray-200">
                            {formatDate(item.createdAt)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>

              <div
                className="hidden overflow-x-auto md:block"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <Table>
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell
                        isHeader
                        className="w-[4%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        #
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[14%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Patient
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[14%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Provider
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[14%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Type
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Status
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Amount
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[16%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Scheduled
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[12%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Created
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {list.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {item.id}
                        </TableCell>
                        <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                          {item.patientName ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {item.providerName ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {item.consultationTypeName ?? "—"}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            size="sm"
                            color={serviceRequestStatusBadgeColor(item.status)}
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right text-theme-sm text-gray-600 dark:text-gray-400">
                          {item.amount ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {item.scheduledAt
                            ? formatDateTime(item.scheduledAt)
                            : "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {item.createdAt
                            ? formatDate(item.createdAt)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {!loading && list.length > 0 && totalPages > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                Rows per page
                <select
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
                </select>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium">{from}</span> to{" "}
                <span className="font-medium">{to}</span> of{" "}
                <span className="font-medium">{total}</span> appointments
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
