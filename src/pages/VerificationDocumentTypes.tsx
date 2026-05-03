import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Button from "../components/ui/button/Button";
import { Modal } from "../components/ui/modal";
import Badge from "../components/ui/badge/Badge";
import {
  verificationDocumentTypesApi,
  type VerificationDocumentTypeItem,
} from "../services/api";
import { formatAccountActiveLabel } from "../utils/format";
import { PencilIcon, PlusIcon } from "../icons";

export default function VerificationDocumentTypes() {
  const { t } = useTranslation();
  const [list, setList] = useState<VerificationDocumentTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<VerificationDocumentTypeItem | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await verificationDocumentTypesApi.list();
      const data = res?.data ?? res;
      setList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("verificationDocumentTypes.failedLoad");
      setError(msg);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async () => {
    if (!code.trim() || !label.trim()) return;
    setSubmitting(true);
    try {
      await verificationDocumentTypesApi.create({
        code: code.trim().toUpperCase().replace(/\s+/g, "_"),
        label: label.trim(),
        isActive: true,
        displayOrder: displayOrder,
      });
      setAddModal(false);
      setCode("");
      setLabel("");
      setDisplayOrder(list.length);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("verificationDocumentTypes.failedAdd");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    setSubmitting(true);
    try {
      await verificationDocumentTypesApi.update(editModal.id, {
        label: label.trim(),
        displayOrder,
      });
      setEditModal(null);
      setLabel("");
      setDisplayOrder(0);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("verificationDocumentTypes.failedUpdate");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (item: VerificationDocumentTypeItem) => {
    setTogglingId(item.id);
    try {
      await verificationDocumentTypesApi.setActive(item.id, !item.isActive);
      await fetchData();
    } catch {
      setError(t("verificationDocumentTypes.failedUpdateStatus"));
    } finally {
      setTogglingId(null);
    }
  };

  const openEdit = (item: VerificationDocumentTypeItem) => {
    setEditModal(item);
    setLabel(item.label);
    setDisplayOrder(item.displayOrder);
  };

  return (
    <>
      <PageMeta
        title={t("verificationDocumentTypes.metaTitle")}
        description={t("verificationDocumentTypes.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("verificationDocumentTypes.pageTitle")} />
      <div className="min-w-0 max-w-full rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("verificationDocumentTypes.heading")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("verificationDocumentTypes.subheading")}
            </p>
          </div>
          <div className="flex w-full flex-shrink-0 flex-wrap items-center gap-3 sm:w-auto">
            <Button
              variant="primary"
              size="md"
              startIcon={<PlusIcon className="h-4 w-4" />}
              onClick={() => {
                setAddModal(true);
                setCode("");
                setLabel("");
                setDisplayOrder(list.length);
              }}
              disabled={loading}
              className="w-full rounded-xl shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto"
            >
              {t("verificationDocumentTypes.addType")}
            </Button>
          </div>
        </div>

        <div className="min-w-0 p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("verificationDocumentTypes.loading")}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <div className="inline-block min-w-full align-middle px-4 sm:px-6">
            <table className="min-w-[600px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.code")}</th>
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.label")}</th>
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.order")}</th>
                  <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.status")}</th>
                  <th className="whitespace-nowrap py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {list
                  .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 font-medium text-gray-800 dark:text-white/90">
                        {item.code}
                      </td>
                      <td className="py-3 text-gray-700 dark:text-gray-300">
                        {item.label}
                      </td>
                      <td className="py-3 text-gray-600 dark:text-gray-400">
                        {item.displayOrder}
                      </td>
                      <td className="py-3">
                        <Badge
                          size="sm"
                          color={item.isActive ? "success" : "error"}
                        >
                          {formatAccountActiveLabel(!!item.isActive)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={togglingId === item.id}
                            onClick={() => handleToggleActive(item)}
                            className="inline-flex min-h-[44px] items-center justify-center rounded border px-2 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {togglingId === item.id
                              ? "…"
                              : item.isActive
                                ? t("verificationDocumentTypes.deactivate")
                                : t("verificationDocumentTypes.activate")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {list.length === 0 && (
              <p className="py-6 text-center text-gray-500 dark:text-gray-400">
                {t("verificationDocumentTypes.emptyState")}
              </p>
            )}
            </div>
          </div>
        )}
        </div>
      </div>

      {addModal && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setAddModal(false)}
          title={t("verificationDocumentTypes.addModalTitle")}
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.codeHint")}</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("verificationDocumentTypes.codePlaceholder")}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.label")}</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("verificationDocumentTypes.labelPlaceholder")}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.displayOrder")}</span>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !submitting && setAddModal(false)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting || !code.trim() || !label.trim()}
                onClick={handleAdd}
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? t("supervisor.saving") : t("verificationDocumentTypes.add")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editModal && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setEditModal(null)}
          title={t("verificationDocumentTypes.editModalTitle")}
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("verificationDocumentTypes.codeReadonly", { code: editModal.code })}
            </p>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.label")}</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("verificationDocumentTypes.displayOrder")}</span>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !submitting && setEditModal(null)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting || !label.trim()}
                onClick={handleUpdate}
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
