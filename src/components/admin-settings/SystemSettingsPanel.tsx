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
import { adminSystemConfigApi, type SystemConfigItem } from "../../services/api";
import { formatDate } from "../../utils/format";
import {
  configLabelKey,
  filterSystemConfigs,
  formatConfigKeyFallback,
  groupSystemConfigs,
  isBooleanConfigKey,
  isMetersConfigKey,
  isPercentConfigKey,
  isSecondsConfigKey,
  type ConfigGroupId,
} from "./configFieldHelpers";
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

const GROUP_ORDER: ConfigGroupId[] = ["features", "financial", "registration", "other"];

function getEnumOptions(key: string): { value: string; label: string }[] | null {
  const k = key.toUpperCase();
  if (k.includes("REGISTRATION_STATUS") || k.includes("DEFAULT_STATUS")) {
    return [
      { value: "PENDING", label: "PENDING" },
      { value: "ACTIVE", label: "ACTIVE" },
      { value: "REJECTED", label: "REJECTED" },
      { value: "DEACTIVATED", label: "DEACTIVATED" },
      { value: "ARCHIVED", label: "ARCHIVED" },
    ];
  }
  return null;
}

export function SystemSettingsPanel() {
  const { t } = useTranslation();
  const [list, setList] = useState<SystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SystemConfigItem | null>(null);
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminSystemConfigApi.list();
      const data = res?.data ?? res;
      setList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("systemConfig.failedLoad");
      setError(msg);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => filterSystemConfigs(list, search), [list, search]);
  const grouped = useMemo(() => groupSystemConfigs(filtered), [filtered]);

  const labelFor = (key: string) =>
    t(configLabelKey(key), { defaultValue: formatConfigKeyFallback(key) });

  const openEdit = (item: SystemConfigItem) => {
    setEditing(item);
    setValue(item.value);
    setDescription(item.description ?? "");
    setSuccess("");
    setError("");
  };

  const handleSave = async () => {
    if (!editing) return;
    const trimmed = value.trim();
    if (isMetersConfigKey(editing.key)) {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        setError(t("systemConfig.invalidMeters"));
        return;
      }
    }
    if (isSecondsConfigKey(editing.key)) {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        setError(t("systemConfig.invalidSeconds"));
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      await adminSystemConfigApi.update(editing.key, {
        value: trimmed,
        description: description.trim() || null,
      });
      setEditing(null);
      setSuccess(t("systemConfig.saveSuccess", { key: editing.key }));
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("systemConfig.failedUpdate");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderValue = (item: SystemConfigItem) => {
    if (isBooleanConfigKey(item.key)) {
      const on = item.value === "true" || item.value === "1";
      return (
        <Badge color={on ? "success" : "light"} size="sm">
          {on ? t("systemConfig.booleanOn") : t("systemConfig.booleanOff")}
        </Badge>
      );
    }
    if (isPercentConfigKey(item.key)) {
      return <span className="font-semibold tabular-nums">{item.value}%</span>;
    }
    if (isMetersConfigKey(item.key)) {
      return (
        <span className="font-semibold tabular-nums">
          {item.value} {t("systemConfig.metersUnit")}
        </span>
      );
    }
    if (isSecondsConfigKey(item.key)) {
      return (
        <span className="font-semibold tabular-nums">
          {item.value} {t("systemConfig.secondsUnit")}
        </span>
      );
    }
    return <span className="font-mono text-sm tabular-nums">{item.value}</span>;
  };

  const renderGroup = (groupId: ConfigGroupId) => {
    const items = grouped[groupId];
    if (items.length === 0) return null;
    return (
      <section key={groupId} className="mb-8 last:mb-0">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white/90">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
          {t(`systemConfig.groups.${groupId}`)}
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            ({items.length})
          </span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 bg-gray-50/90 dark:border-gray-800 dark:bg-white/[0.03]">
                <TableCell isHeader className="w-[28%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  {t("systemConfig.setting")}
                </TableCell>
                <TableCell isHeader className="w-[18%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  {t("systemConfig.value")}
                </TableCell>
                <TableCell isHeader className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 md:table-cell">
                  {t("systemConfig.description")}
                </TableCell>
                <TableCell isHeader className="hidden w-[12%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 lg:table-cell">
                  {t("systemConfig.updated")}
                </TableCell>
                <TableCell isHeader className="w-[10%] px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                  {t("systemConfig.actions")}
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.key}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800/80"
                >
                  <TableCell className="px-4 py-3.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                      {labelFor(item.key)}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {item.key}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-gray-800 dark:text-gray-200">
                    {renderValue(item)}
                  </TableCell>
                  <TableCell className="hidden px-4 py-3.5 text-sm text-gray-600 dark:text-gray-400 md:table-cell">
                    <span className="line-clamp-2">
                      {item.description ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                    {item.updatedAt ? formatDate(item.updatedAt) : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className={btnGhost()}
                      aria-label={t("common.actions.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    );
  };

  return (
    <>
      <SettingsAlert
        variant="warning"
        title={t("systemConfig.restartNoticeTitle")}
        message={t("systemConfig.restartNoticeMessage")}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatChip label={t("systemConfig.statsTotal")} value={list.length} />
        <StatChip
          label={t("systemConfig.statsShowing")}
          value={filtered.length}
        />
        <StatChip
          label={t("systemConfig.statsFeatures")}
          value={grouped.features.length}
        />
        <StatChip
          label={t("systemConfig.statsFinancial")}
          value={grouped.financial.length}
        />
      </div>

      <SettingsToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("systemConfig.searchPlaceholder")}
      >
        <button type="button" onClick={() => void fetchData()} className={btnSecondary()}>
          <RefreshCw className="h-4 w-4" />
          {t("systemConfig.refresh")}
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
      ) : filtered.length === 0 ? (
        <PanelEmpty message={t("systemConfig.noEntries")} />
      ) : (
        GROUP_ORDER.map(renderGroup)
      )}

      {editing ? (
        <Modal
          isOpen
          onClose={() => !submitting && setEditing(null)}
          title={labelFor(editing.key)}
        >
          <div className="space-y-4">
            <SettingsAlert
              variant="warning"
              title={t("systemConfig.restartNoticeTitle")}
              message={t("systemConfig.editRestartHint")}
            />

            <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{editing.key}</p>
            {editing.description ? (
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {editing.description}
              </p>
            ) : null}

            <label className="block">
              <span className={labelClass}>{t("systemConfig.value")}</span>
              {(() => {
                const enumOpts = getEnumOptions(editing.key);
                if (enumOpts) {
                  return (
                    <ThemedSelect
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className={`${inputClass} mt-1`}
                    >
                      {enumOpts.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </ThemedSelect>
                  );
                }
                if (isBooleanConfigKey(editing.key)) {
                  return (
                    <ThemedSelect
                      value={value === "true" || value === "1" ? "true" : "false"}
                      onChange={(e) => setValue(e.target.value)}
                      className={`${inputClass} mt-1`}
                    >
                      <option value="true">{t("systemConfig.booleanOn")}</option>
                      <option value="false">{t("systemConfig.booleanOff")}</option>
                    </ThemedSelect>
                  );
                }
                if (isMetersConfigKey(editing.key)) {
                  return (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
                        {t("systemConfig.metersUnit")}
                      </span>
                    </div>
                  );
                }
                if (isSecondsConfigKey(editing.key)) {
                  return (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
                        {t("systemConfig.secondsUnit")}
                      </span>
                    </div>
                  );
                }
                return (
                  <input
                    type={isPercentConfigKey(editing.key) ? "number" : "text"}
                    min={isPercentConfigKey(editing.key) ? 0 : undefined}
                    step={isPercentConfigKey(editing.key) ? "0.01" : undefined}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                );
              })()}
            </label>

            <label className="block">
              <span className={labelClass}>{t("systemConfig.descriptionOptional")}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`${inputClass} mt-1`}
              />
            </label>

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => !submitting && setEditing(null)}
                className={btnSecondary()}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting || !value.trim()}
                onClick={() => void handleSave()}
                className={btnPrimary()}
              >
                {submitting ? t("supervisor.saving") : t("common.actions.save")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
