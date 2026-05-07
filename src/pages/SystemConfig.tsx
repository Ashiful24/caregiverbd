import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import ThemedSelect from "../components/form/ThemedSelect";
import { Modal } from "../components/ui/modal";
import { adminSystemConfigApi, type SystemConfigItem } from "../services/api";
import { PencilIcon } from "../icons";
import { formatDate } from "../utils/format";

/** Profile status enum shared by providers and patients. */
const PROFILE_STATUS_OPTIONS = [
  { value: "PENDING",      label: "PENDING" },
  { value: "ACTIVE",       label: "ACTIVE" },
  { value: "REJECTED",     label: "REJECTED" },
  { value: "DEACTIVATED",  label: "DEACTIVATED" },
  { value: "ARCHIVED",     label: "ARCHIVED" },
];

/**
 * Returns the appropriate dropdown options for a config key, or null if the
 * key should stay as a free-text input.
 */
function getEnumOptions(key: string): { value: string; label: string }[] | null {
  const k = key.toUpperCase();
  if (k.includes("REGISTRATION_STATUS") || k.includes("DEFAULT_STATUS")) {
    return PROFILE_STATUS_OPTIONS;
  }
  return null;
}

export default function SystemConfig() {
  const { t } = useTranslation();
  const [list, setList] = useState<SystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  const openEdit = (item: SystemConfigItem) => {
    setEditing(item);
    setValue(item.value);
    setDescription(item.description ?? "");
  };

  const handleSave = async () => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await adminSystemConfigApi.update(editing.key, {
        value: value.trim(),
        description: description.trim() || null,
      });
      setEditing(null);
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

  return (
    <>
      <PageMeta
        title={t("systemConfig.metaTitle")}
        description={t("systemConfig.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("systemConfig.pageTitle")} />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("systemConfig.heading")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("systemConfig.subheading")}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("systemConfig.loading")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("systemConfig.key")}</th>
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("systemConfig.value")}</th>
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("systemConfig.description")}</th>
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("systemConfig.updated")}</th>
                  <th className="py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t("systemConfig.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {list.map((item) => (
                  <tr key={item.key}>
                    <td className="py-3 font-mono text-sm font-medium text-gray-800 dark:text-white/90">
                      {item.key}
                    </td>
                    <td className="py-3 text-gray-700 dark:text-gray-300">
                      {item.value}
                    </td>
                    <td className="max-w-xs py-3 text-gray-600 dark:text-gray-400">
                      <span className="line-clamp-2">{item.description ?? t("common.noValue")}</span>
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">
                      {item.updatedAt ? formatDate(item.updatedAt) : t("common.noValue")}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      >
                        <PencilIcon className="h-4 w-4" />
                        {t("common.actions.edit")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && (
              <p className="py-6 text-center text-gray-500 dark:text-gray-400">
                {t("systemConfig.noEntries")}
              </p>
            )}
          </div>
        )}
      </div>

      {editing && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setEditing(null)}
          title={t("systemConfig.editTitle", { key: editing.key })}
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("systemConfig.keyNotEditable")}
            </p>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("systemConfig.value")}</span>
              {(() => {
                const opts = getEnumOptions(editing.key);
                return opts ? (
                  <ThemedSelect
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  >
                    {opts.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </ThemedSelect>
                ) : (
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    placeholder={t("systemConfig.value")}
                  />
                );
              })()}
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("systemConfig.descriptionOptional")}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("systemConfig.description")}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !submitting && setEditing(null)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting || !value.trim()}
                onClick={handleSave}
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? t("supervisor.saving") : t("common.actions.save")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
