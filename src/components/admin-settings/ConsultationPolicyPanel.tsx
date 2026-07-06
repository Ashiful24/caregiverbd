import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, RefreshCw } from "lucide-react";
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
  SettingsToolbar,
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
  metadataJson: string;
};

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

function policyLabel(item: CancellationPolicyItem): string {
  return (
    item.policyKey?.trim() ||
    item.title?.trim() ||
    item.name?.trim() ||
    item.description?.trim() ||
    `#${item.id}`
  );
}

function formatPolicyFee(item: CancellationPolicyItem): string {
  const type = String(item.feeType ?? "").toUpperCase();
  const value = item.feeValue ?? "";
  if (type === "PERCENT") return `${value}%`;
  if (type === "FIXED") return value;
  return value ? `${type} ${value}` : "—";
}

function formFromItem(item: CancellationPolicyItem): PolicyFormState {
  return {
    feeType: String(item.feeType ?? "PERCENT").toUpperCase(),
    feeValue: item.feeValue ?? "",
    isActive: item.isActive !== false,
    metadataJson: JSON.stringify(item.metadata ?? {}, null, 2),
  };
}

function subTabClass(active: boolean): string {
  return `rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
    active
      ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/30 dark:text-brand-300"
      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
  }`;
}

const thClass =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";
const tdClass = "px-3 py-3 text-sm align-top";

export function ConsultationPolicyPanel() {
  const { t } = useTranslation();
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("DOCTOR");
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

  const handleSave = async () => {
    if (!editing || !form) return;
    let metadata: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(form.metadataJson || "{}");
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>;
      } else {
        setError(t("systemConfig.consultationPolicy.invalidMetadata"));
        return;
      }
    } catch {
      setError(t("systemConfig.consultationPolicy.invalidMetadata"));
      return;
    }

    if (!form.feeValue.trim()) {
      setError(t("systemConfig.consultationPolicy.feeValueRequired"));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await adminCancellationPoliciesApi.update(editing.id, {
        feeType: form.feeType,
        feeValue: form.feeValue.trim(),
        metadata,
        isActive: form.isActive,
      });
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

      <div className="mb-4 flex flex-wrap gap-2">
        {(["DOCTOR", "CAREGIVER"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setCategoryTab(tab)}
            className={subTabClass(categoryTab === tab)}
          >
            {tab === "DOCTOR"
              ? t("systemConfig.consultationPolicy.tabDoctor")
              : t("systemConfig.consultationPolicy.tabCaregiver")}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["SHORT_TERM", "LONG_TERM"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setServiceTypeTab(tab)}
            className={subTabClass(serviceTypeTab === tab)}
          >
            {tab === "SHORT_TERM"
              ? t("systemConfig.consultationPolicy.shortTerm")
              : t("systemConfig.consultationPolicy.longTerm")}
          </button>
        ))}
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

      <SettingsToolbar>
        <button type="button" onClick={() => void fetchData()} className={btnSecondary()}>
          <RefreshCw className="h-4 w-4" />
          {t("systemConfig.consultationPolicy.refresh")}
        </button>
      </SettingsToolbar>

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
                      {policyLabel(item)}
                    </div>
                    {item.description && item.description !== policyLabel(item) ? (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {item.description}
                      </p>
                    ) : null}
                    {item.hoursBeforeService != null ? (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {t("systemConfig.consultationPolicy.hoursBefore", {
                          hours: item.hoursBeforeService,
                        })}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className={`${tdClass} whitespace-nowrap`}>
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {formatPolicyFee(item)}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatStatusLabel(String(item.feeType ?? ""))}
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
        {editing && form ? (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("systemConfig.consultationPolicy.editTitle", { name: policyLabel(editing) })}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("systemConfig.consultationPolicy.editHint")}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className={labelClass}>{t("systemConfig.consultationPolicy.feeType")}</label>
                <ThemedSelect
                  value={form.feeType}
                  onChange={(e) => setForm({ ...form, feeType: e.target.value })}
                  className="mt-1"
                >
                  <option value="PERCENT">{t("systemConfig.consultationPolicy.feePercent")}</option>
                  <option value="FIXED">{t("systemConfig.consultationPolicy.feeFixed")}</option>
                </ThemedSelect>
              </div>

              <div>
                <label className={labelClass}>{t("systemConfig.consultationPolicy.feeValue")}</label>
                <input
                  type="text"
                  value={form.feeValue}
                  onChange={(e) => setForm({ ...form, feeValue: e.target.value })}
                  className={`${inputClass} mt-1`}
                  placeholder={form.feeType === "PERCENT" ? "50.00" : "100.00"}
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

              <div>
                <label className={labelClass}>{t("systemConfig.consultationPolicy.metadataJson")}</label>
                <textarea
                  value={form.metadataJson}
                  onChange={(e) => setForm({ ...form, metadataJson: e.target.value })}
                  rows={5}
                  className={`${inputClass} mt-1 font-mono text-xs`}
                  spellCheck={false}
                />
              </div>
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
        ) : null}
      </Modal>
    </>
  );
}
