import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import ThemedSelect from "../form/ThemedSelect";
import { Modal } from "../ui/modal";
import Badge from "../ui/badge/Badge";
import {
  adminCancellationPoliciesApi,
  type CancellationPolicyItem,
  type CancellationPolicyServiceCategory,
  type CancellationPolicyServiceType,
} from "../../services/api";
import { formatDateTime, formatStatusLabel } from "../../utils/format";
import {
  SettingsAlert,
  StatChip,
  PanelLoading,
  PanelEmpty,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
} from "./shared";

type CategoryTab = CancellationPolicyServiceCategory;
type ServiceTypeTab = CancellationPolicyServiceType;

type PolicyFormState = {
  feeType: string;
  feeValue: string;
  isActive: boolean;
  windowMin: string;
  exceptions: string[];
};

const CANCELLATION_EXCEPTIONS = ["HOPE_FAULT"] as const;
const EDITABLE_FEE_TYPES = ["PERCENT", "FLAT", "NONE"] as const;

function getPolicyStage(item: CancellationPolicyItem): string {
  return String(item.stage ?? "").toUpperCase();
}

function isPreServiceStage(item: CancellationPolicyItem): boolean {
  return getPolicyStage(item) === "PRE_SERVICE";
}

function isInProgressStage(item: CancellationPolicyItem): boolean {
  return getPolicyStage(item) === "IN_PROGRESS";
}

function isPrePaymentStage(item: CancellationPolicyItem): boolean {
  return getPolicyStage(item) === "PRE_PAYMENT";
}

function hasExceptionsMetadata(item: CancellationPolicyItem): boolean {
  return isPreServiceStage(item) || isInProgressStage(item);
}

function editableFeeTypesForStage(item: CancellationPolicyItem): readonly string[] {
  if (isPrePaymentStage(item)) return ["NONE"];
  return EDITABLE_FEE_TYPES;
}

function readWindowMin(metadata: Record<string, unknown> | null | undefined): string {
  const m = metadata ?? {};
  const v = m.window_minutes ?? m.windowMin ?? m.windowMinutes ?? m.window_min;
  if (v == null || v === "") return "";
  return String(v);
}

function readExceptions(metadata: Record<string, unknown> | null | undefined): string[] {
  const raw = metadata?.exceptions;
  if (!Array.isArray(raw)) return [];
  return raw.map((e) => String(e).toUpperCase()).filter(Boolean);
}

function readAdminFee(metadata: Record<string, unknown> | null | undefined): string {
  const v = metadata?.admin_fee ?? metadata?.adminFee;
  if (v == null || v === "") return "";
  return String(v);
}

function feeValueForType(feeType: string): string {
  const type = feeType.toUpperCase();
  if (type === "NONE") return "0.00";
  return "";
}

function buildSavePayload(
  row: CancellationPolicyItem,
  form: PolicyFormState
): { payload: { feeType: string; feeValue: string; isActive: boolean; metadata?: Record<string, unknown> }; errorKey?: string } {
  const stage = getPolicyStage(row);
  const feeType = form.feeType.toUpperCase();
  const allowedTypes = editableFeeTypesForStage(row);

  if (!allowedTypes.includes(feeType)) {
    return { payload: { feeType, feeValue: "", isActive: form.isActive }, errorKey: "systemConfig.consultationPolicy.feeTypeNotAllowed" };
  }

  const payload: {
    feeType: string;
    feeValue: string;
    isActive: boolean;
    metadata?: Record<string, unknown>;
  } = {
    feeType,
    feeValue: feeType === "NONE" ? "0.00" : form.feeValue.trim(),
    isActive: form.isActive,
  };

  if (stage === "PRE_SERVICE") {
    const windowMinutes = Number(form.windowMin);
    if (!Number.isFinite(windowMinutes) || windowMinutes < 0) {
      return { payload, errorKey: "systemConfig.consultationPolicy.windowMinRequired" };
    }
    payload.metadata = {
      window_minutes: windowMinutes,
      exceptions: form.exceptions,
    };
  } else if (stage === "IN_PROGRESS") {
    payload.metadata = { exceptions: form.exceptions };
  } else if (stage === "PRE_PAYMENT") {
    payload.metadata = {};
  } else if (feeType === "NONE") {
    payload.metadata = {};
  }

  return { payload };
}

function unwrapPolicies(res: unknown): CancellationPolicyItem[] {
  const body = (res as { data?: unknown })?.data ?? res;
  if (Array.isArray(body)) return body as CancellationPolicyItem[];
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    for (const key of ["policies", "data", "items"]) {
      if (Array.isArray(o[key])) return o[key] as CancellationPolicyItem[];
    }
  }
  return [];
}

function policyStageLabel(item: CancellationPolicyItem): string {
  const stage = item.stage?.trim();
  return stage ? formatStatusLabel(stage) : "—";
}

function formatPolicyFee(item: CancellationPolicyItem): string {
  const type = String(item.feeType ?? "").toUpperCase();
  const value = item.feeValue ?? "";
  const adminFee = readAdminFee(item.metadata);
  if (type === "NONE") return "—";
  if (type === "PERCENT") return value ? `${value}%` : "—";
  if (type === "FLAT") return value ? `৳${value}` : "—";
  if (type === "USAGE_BASED") {
    const base = value && value !== "0" && value !== "0.00" ? value : null;
    const parts = [base, adminFee ? `+৳${adminFee} admin` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "—";
  }
  return value ? `${type} ${value}` : "—";
}

function feeTypeI18nKey(type: string): string {
  switch (type.toUpperCase()) {
    case "PERCENT":
      return "systemConfig.consultationPolicy.feePercent";
    case "FLAT":
      return "systemConfig.consultationPolicy.feeFlat";
    case "USAGE_BASED":
      return "systemConfig.consultationPolicy.feeUsageBased";
    case "NONE":
      return "systemConfig.consultationPolicy.feeNone";
    default:
      return "systemConfig.consultationPolicy.feeType";
  }
}

function formFromItem(item: CancellationPolicyItem): PolicyFormState {
  const allowed = editableFeeTypesForStage(item);
  const rawFeeType = String(item.feeType ?? "PERCENT").toUpperCase();
  const feeType = allowed.includes(rawFeeType) ? rawFeeType : allowed[0];
  return {
    feeType,
    feeValue: feeType === "NONE" ? "0.00" : item.feeValue ?? "",
    isActive: item.isActive !== false,
    windowMin: isPreServiceStage(item) ? readWindowMin(item.metadata) : "",
    exceptions: hasExceptionsMetadata(item) ? readExceptions(item.metadata) : [],
  };
}

const toggleGroupClass =
  "inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-700 dark:bg-gray-800/80";

function toggleBtnClass(active: boolean): string {
  return `rounded-md px-3 py-1.5 text-sm font-medium transition ${
    active
      ? "bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-300"
      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
  }`;
}

const thClass =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";
const tdClass = "px-3 py-3 text-sm align-top";

export function ConsultationPolicyPanel() {
  const { t } = useTranslation();
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("CAREGIVER");
  const [serviceTypeTab, setServiceTypeTab] = useState<ServiceTypeTab>("SHORT_TERM");
  const [list, setList] = useState<CancellationPolicyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<CancellationPolicyItem | null>(null);
  const [form, setForm] = useState<PolicyFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminCancellationPoliciesApi.list({
        serviceCategory: categoryTab,
        policyServiceType: serviceTypeTab,
      });
      const items = unwrapPolicies(res);
      const sorted = [...items].sort((a, b) => {
        const ao = a.sortOrder ?? 0;
        const bo = b.sortOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return a.id - b.id;
      });
      setList(sorted);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("systemConfig.consultationPolicy.failedLoad");
      setError(msg);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [categoryTab, serviceTypeTab, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const active = list.filter((p) => p.isActive !== false).length;
    return { total: list.length, active, inactive: list.length - active };
  }, [list]);

  const openEdit = (item: CancellationPolicyItem) => {
    setEditing(item);
    setForm(formFromItem(item));
  };

  const closeEdit = () => {
    setEditing(null);
    setForm(null);
  };

  const handleFeeTypeChange = (newFeeType: string) => {
    if (!form) return;
    const nextType = newFeeType.toUpperCase();
    setForm({
      ...form,
      feeType: nextType,
      feeValue: feeValueForType(nextType),
    });
  };

  const toggleException = (code: string) => {
    if (!form) return;
    const upper = code.toUpperCase();
    const has = form.exceptions.includes(upper);
    setForm({
      ...form,
      exceptions: has
        ? form.exceptions.filter((e) => e !== upper)
        : [...form.exceptions, upper],
    });
  };

  const handleSave = async () => {
    if (!editing || !form) return;

    if (form.feeType !== "NONE" && !form.feeValue.trim()) {
      setError(t("systemConfig.consultationPolicy.feeValueRequired"));
      return;
    }

    const { payload, errorKey } = buildSavePayload(editing, form);
    if (errorKey) {
      setError(t(errorKey));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await adminCancellationPoliciesApi.update(editing.id, payload);
      setSuccess(t("systemConfig.consultationPolicy.saveSuccess"));
      closeEdit();
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("systemConfig.consultationPolicy.failedUpdate");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SettingsAlert
        variant="info"
        title={t("systemConfig.consultationPolicy.noticeTitle")}
        message={t("systemConfig.consultationPolicy.noticeMessage")}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className={toggleGroupClass} role="group" aria-label={t("systemConfig.consultationPolicy.categoryToggle")}>
          {(["CAREGIVER", "DOCTOR"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setCategoryTab(tab)}
              className={toggleBtnClass(categoryTab === tab)}
              aria-pressed={categoryTab === tab}
            >
              {tab === "DOCTOR"
                ? t("systemConfig.consultationPolicy.tabDoctor")
                : t("systemConfig.consultationPolicy.tabCaregiver")}
            </button>
          ))}
        </div>

        <div className={toggleGroupClass} role="group" aria-label={t("systemConfig.consultationPolicy.serviceTypeToggle")}>
          {(["SHORT_TERM", "LONG_TERM"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setServiceTypeTab(tab)}
              className={toggleBtnClass(serviceTypeTab === tab)}
              aria-pressed={serviceTypeTab === tab}
            >
              {tab === "SHORT_TERM"
                ? t("systemConfig.consultationPolicy.shortTerm")
                : t("systemConfig.consultationPolicy.longTerm")}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatChip label={t("systemConfig.consultationPolicy.statsTotal")} value={stats.total} />
        <StatChip
          label={t("systemConfig.consultationPolicy.statsActive")}
          value={stats.active}
          tone="positive"
        />
        <StatChip
          label={t("systemConfig.consultationPolicy.statsInactive")}
          value={stats.inactive}
          tone={stats.inactive > 0 ? "warning" : "neutral"}
        />
      </div>

      {success ? (
        <SettingsAlert
          variant="success"
          title={t("systemConfig.savedTitle")}
          message={success}
          onDismiss={() => setSuccess("")}
        />
      ) : null}

      {error ? (
        <SettingsAlert
          variant="error"
          title={t("systemConfig.errorTitle")}
          message={error}
          onDismiss={() => setError("")}
        />
      ) : null}

      {loading ? (
        <PanelLoading message={t("systemConfig.loading")} />
      ) : list.length === 0 ? (
        <PanelEmpty message={t("systemConfig.consultationPolicy.noPolicies")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <Table>
            <TableHeader className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/40">
              <TableRow>
                <TableCell isHeader className={thClass}>
                  {t("systemConfig.consultationPolicy.colPolicy")}
                </TableCell>
                <TableCell isHeader className={thClass}>
                  {t("systemConfig.consultationPolicy.colFee")}
                </TableCell>
                <TableCell isHeader className={thClass}>
                  {t("systemConfig.consultationPolicy.colStatus")}
                </TableCell>
                <TableCell isHeader className={thClass}>
                  {t("systemConfig.consultationPolicy.colUpdated")}
                </TableCell>
                <TableCell isHeader className={`${thClass} text-right`}>
                  {t("systemConfig.actions")}
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {list.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className={tdClass}>
                    <div className="font-medium text-gray-800 dark:text-white/90">
                      {policyStageLabel(item)}
                    </div>
                  </TableCell>
                  <TableCell className={`${tdClass} whitespace-nowrap`}>
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {formatPolicyFee(item)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t(feeTypeI18nKey(String(item.feeType ?? "")))}
                    </p>
                  </TableCell>
                  <TableCell className={tdClass}>
                    <Badge size="sm" color={item.isActive !== false ? "success" : "light"}>
                      {item.isActive !== false
                        ? t("systemConfig.consultationPolicy.active")
                        : t("systemConfig.consultationPolicy.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className={`${tdClass} whitespace-nowrap text-gray-600 dark:text-gray-400`}>
                    {item.updatedAt ? formatDateTime(item.updatedAt) : "—"}
                  </TableCell>
                  <TableCell className={`${tdClass} text-right`}>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className={btnGhost()}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t("common.actions.edit")}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal isOpen={editing !== null} onClose={closeEdit} className="max-w-lg">
        {editing && form ? (() => {
          const editableFeeTypes = editableFeeTypesForStage(editing);
          const currentFeeType = String(editing.feeType ?? "").toUpperCase();
          const showUnsupportedFeeType =
            currentFeeType === "USAGE_BASED" && !editableFeeTypes.includes(currentFeeType);

          return (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("systemConfig.consultationPolicy.editTitle", { name: policyStageLabel(editing) })}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isPrePaymentStage(editing)
                ? t("systemConfig.consultationPolicy.editHintPrePayment")
                : t("systemConfig.consultationPolicy.editHint")}
            </p>

            {showUnsupportedFeeType ? (
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                {t("systemConfig.consultationPolicy.usageBasedReadOnly")}
              </p>
            ) : null}

            <div className="mt-5 space-y-4">
              <div>
                <label className={labelClass}>{t("systemConfig.consultationPolicy.feeType")}</label>
                <ThemedSelect
                  value={form.feeType}
                  onChange={(e) => handleFeeTypeChange(e.target.value)}
                  className="mt-1"
                >
                  {showUnsupportedFeeType ? (
                    <option value="USAGE_BASED" disabled>
                      {t(feeTypeI18nKey("USAGE_BASED"))} ({t("systemConfig.consultationPolicy.notEditable")})
                    </option>
                  ) : null}
                  {editableFeeTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(feeTypeI18nKey(type))}
                    </option>
                  ))}
                </ThemedSelect>
                {form.feeType !== currentFeeType ? (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    {t("systemConfig.consultationPolicy.feeTypeChangeHint")}
                  </p>
                ) : null}
              </div>

              <div>
                <label className={labelClass}>
                  {form.feeType === "PERCENT"
                    ? t("systemConfig.consultationPolicy.feeValuePercent")
                    : form.feeType === "FLAT"
                      ? t("systemConfig.consultationPolicy.feeValueFlat")
                      : t("systemConfig.consultationPolicy.feeValue")}
                </label>
                <input
                  type="text"
                  value={form.feeType === "NONE" ? "0.00" : form.feeValue}
                  onChange={(e) => setForm({ ...form, feeValue: e.target.value })}
                  className={`${inputClass} mt-1`}
                  disabled={form.feeType === "NONE"}
                  placeholder={
                    form.feeType === "PERCENT"
                      ? "80.00"
                      : form.feeType === "FLAT"
                        ? "500.00"
                        : "0.00"
                  }
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {t("systemConfig.consultationPolicy.policyActive")}
              </label>

              {isPreServiceStage(editing) ? (
                <>
                  <div>
                    <label className={labelClass}>
                      {t("systemConfig.consultationPolicy.windowMin")}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.windowMin}
                      onChange={(e) => setForm({ ...form, windowMin: e.target.value })}
                      className={`${inputClass} mt-1`}
                      placeholder="120"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t("systemConfig.consultationPolicy.windowMinHint")}
                    </p>
                  </div>
                  <div>
                    <span className={labelClass}>{t("systemConfig.consultationPolicy.exceptions")}</span>
                    <div className="mt-2 space-y-2">
                      {CANCELLATION_EXCEPTIONS.map((code) => (
                        <label
                          key={code}
                          className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <input
                            type="checkbox"
                            checked={form.exceptions.includes(code)}
                            onChange={() => toggleException(code)}
                            className="rounded border-gray-300 dark:border-gray-600"
                          />
                          {t(`systemConfig.consultationPolicy.exception_${code}`)}
                        </label>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t("systemConfig.consultationPolicy.exceptionsHint")}
                    </p>
                  </div>
                </>
              ) : null}

              {isInProgressStage(editing) ? (
                <div>
                  <span className={labelClass}>{t("systemConfig.consultationPolicy.exceptions")}</span>
                  <div className="mt-2 space-y-2">
                    {CANCELLATION_EXCEPTIONS.map((code) => (
                      <label
                        key={code}
                        className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <input
                          type="checkbox"
                          checked={form.exceptions.includes(code)}
                          onChange={() => toggleException(code)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        {t(`systemConfig.consultationPolicy.exception_${code}`)}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("systemConfig.consultationPolicy.exceptionsHint")}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeEdit} className={btnSecondary()} disabled={submitting}>
                {t("common.actions.cancel")}
              </button>
              <button type="button" onClick={() => void handleSave()} className={btnPrimary()} disabled={submitting}>
                {submitting ? t("systemConfig.loading") : t("common.actions.save")}
              </button>
            </div>
          </div>
          );
        })() : null}
      </Modal>
    </>
  );
}
