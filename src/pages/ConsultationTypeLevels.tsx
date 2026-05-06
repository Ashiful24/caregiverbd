import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Button from "../components/ui/button/Button";
import { Modal } from "../components/ui/modal";
import {
  consultationTypeLevelsApi,
  type ConsultationTypeLevel,
  type ConsultationTypeLevelCategory,
} from "../services/api";
import { PencilIcon, PlusIcon, TrashBinIcon, ViewIcon } from "../icons";

const CATEGORIES: ConsultationTypeLevelCategory[] = ["CAREGIVER", "DOCTOR"];

const actionIconButtonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700";

function formatSalaryAmount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ConsultationTypeLevels() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<ConsultationTypeLevelCategory>("CAREGIVER");
  const [list, setList] = useState<ConsultationTypeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<ConsultationTypeLevel | null>(null);
  const [detailItem, setDetailItem] = useState<ConsultationTypeLevel | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [name, setName] = useState("");
  const [levelNumber, setLevelNumber] = useState(1);
  const [formCategory, setFormCategory] = useState<ConsultationTypeLevelCategory>("CAREGIVER");
  const [minSalary, setMinSalary] = useState(0);
  const [maxSalary, setMaxSalary] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<ConsultationTypeLevel | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const resetForm = useCallback(
    (cat: ConsultationTypeLevelCategory) => {
      setName("");
      setLevelNumber(1);
      setFormCategory(cat);
      setMinSalary(0);
      setMaxSalary(0);
    },
    []
  );

  const applyFromItem = useCallback((item: ConsultationTypeLevel) => {
    setName(item.name);
    setLevelNumber(item.levelNumber);
    setFormCategory(item.category);
    setMinSalary(item.minSalary);
    setMaxSalary(item.maxSalary);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await consultationTypeLevelsApi.list({ category });
      const data = res?.data ?? res;
      setList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationTypeLevels.failedLoad");
      setError(msg);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [category, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openAdd = () => {
    setAddModal(true);
    resetForm(category);
  };

  const openEdit = async (item: ConsultationTypeLevel) => {
    setLoadingDetail(true);
    setError("");
    try {
      const res = await consultationTypeLevelsApi.getById(item.id);
      const data = (res?.data ?? res) as ConsultationTypeLevel;
      setEditModal(data);
      applyFromItem(data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationTypeLevels.failedGet");
      setError(msg);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openDetail = async (item: ConsultationTypeLevel) => {
    setLoadingDetail(true);
    setError("");
    setDetailItem(null);
    try {
      const res = await consultationTypeLevelsApi.getById(item.id);
      const data = (res?.data ?? res) as ConsultationTypeLevel;
      setDetailItem(data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationTypeLevels.failedGet");
      setError(msg);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || minSalary < 0 || maxSalary < 0 || minSalary > maxSalary) return;
    setSubmitting(true);
    try {
      await consultationTypeLevelsApi.create({
        name: name.trim(),
        levelNumber,
        category: formCategory,
        minSalary,
        maxSalary,
      });
      setAddModal(false);
      resetForm(category);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationTypeLevels.failedAdd");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    if (!name.trim() || minSalary < 0 || maxSalary < 0 || minSalary > maxSalary) return;
    setSubmitting(true);
    try {
      await consultationTypeLevelsApi.update(editModal.id, {
        name: name.trim(),
        levelNumber,
        category: formCategory,
        minSalary,
        maxSalary,
      });
      setEditModal(null);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationTypeLevels.failedUpdate");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteSubmitting(true);
    setError("");
    try {
      await consultationTypeLevelsApi.delete(pendingDelete.id);
      setPendingDelete(null);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationTypeLevels.failedDelete");
      setError(msg);
      setPendingDelete(null);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const formInvalid =
    !name.trim() || minSalary < 0 || maxSalary < 0 || minSalary > maxSalary;

  return (
    <>
      <PageMeta
        title={t("consultationTypeLevels.metaTitle")}
        description={t("consultationTypeLevels.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("consultationTypeLevels.pageTitle")} />
      <div className="min-w-0 max-w-full rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("consultationTypeLevels.heading")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("consultationTypeLevels.subheading")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    category === c
                      ? "bg-brand-600 text-white dark:bg-brand-500"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {t(`consultationTypeLevels.categoryLabels.${c}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex w-full flex-shrink-0 flex-wrap items-center gap-3 sm:w-auto">
            <Button
              variant="primary"
              size="md"
              startIcon={<PlusIcon className="h-4 w-4" />}
              onClick={openAdd}
              disabled={loading}
              className="w-full rounded-xl shadow-sm transition-all duration-200 hover:shadow-md sm:w-auto"
            >
              {t("consultationTypeLevels.addLevel")}
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
              {t("consultationTypeLevels.loading")}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                <table className="min-w-[640px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        {t("consultationTypeLevels.name")}
                      </th>
                      <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        {t("consultationTypeLevels.levelNumber")}
                      </th>
                      <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        {t("consultationTypeLevels.minSalary")}
                      </th>
                      <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        {t("consultationTypeLevels.maxSalary")}
                      </th>
                      <th className="whitespace-nowrap py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                        {t("consultationTypeLevels.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {list
                      .sort(
                        (a, b) =>
                          a.levelNumber - b.levelNumber || a.id - b.id
                      )
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 font-medium text-gray-800 dark:text-white/90">
                            {item.name}
                          </td>
                          <td className="py-3 text-gray-600 dark:text-gray-400">
                            {item.levelNumber}
                          </td>
                          <td className="py-3 text-gray-600 dark:text-gray-400">
                            {item.minSalary}
                          </td>
                          <td className="py-3 text-gray-600 dark:text-gray-400">
                            {item.maxSalary}
                          </td>
                          <td className="whitespace-nowrap py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => void openDetail(item)}
                                disabled={loadingDetail}
                                className={actionIconButtonClass}
                                title={t("common.actions.view")}
                                aria-label={t("common.actions.view")}
                              >
                                <ViewIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void openEdit(item)}
                                disabled={loadingDetail}
                                className={actionIconButtonClass}
                                title={t("common.actions.edit")}
                                aria-label={t("common.actions.edit")}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(item)}
                                className={actionIconButtonClass}
                                title={t("consultationTypeLevels.remove")}
                                aria-label={t("consultationTypeLevels.remove")}
                              >
                                <TrashBinIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {list.length === 0 && (
                  <p className="py-6 text-center text-gray-500 dark:text-gray-400">
                    {t("consultationTypeLevels.emptyState")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {addModal && (
        <Modal
          isOpen
          onClose={() => !submitting && setAddModal(false)}
          title={t("consultationTypeLevels.addModalTitle")}
          className="w-full max-w-lg"
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.name")}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("consultationTypeLevels.namePlaceholder")}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.levelNumber")}
              </span>
              <input
                type="number"
                min={0}
                value={levelNumber}
                onChange={(e) => setLevelNumber(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.category")}
              </span>
              <select
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(e.target.value as ConsultationTypeLevelCategory)
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`consultationTypeLevels.categoryLabels.${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.minSalary")}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={minSalary}
                onChange={(e) => setMinSalary(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.maxSalary")}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={maxSalary}
                onChange={(e) => setMaxSalary(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            {minSalary > maxSalary && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("consultationTypeLevels.salaryRangeHint")}
              </p>
            )}
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
                disabled={submitting || formInvalid}
                onClick={() => void handleAdd()}
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? t("supervisor.saving") : t("consultationTypeLevels.add")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editModal && (
        <Modal
          isOpen
          onClose={() => !submitting && setEditModal(null)}
          title={t("consultationTypeLevels.editModalTitle")}
          className="w-full max-w-lg"
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("consultationTypeLevels.idLabel", { id: editModal.id })}
            </p>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.name")}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.levelNumber")}
              </span>
              <input
                type="number"
                min={0}
                value={levelNumber}
                onChange={(e) => setLevelNumber(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.category")}
              </span>
              <select
                value={formCategory}
                onChange={(e) =>
                  setFormCategory(e.target.value as ConsultationTypeLevelCategory)
                }
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`consultationTypeLevels.categoryLabels.${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.minSalary")}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={minSalary}
                onChange={(e) => setMinSalary(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationTypeLevels.maxSalary")}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={maxSalary}
                onChange={(e) => setMaxSalary(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            {minSalary > maxSalary && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("consultationTypeLevels.salaryRangeHint")}
              </p>
            )}
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
                disabled={submitting || formInvalid}
                onClick={() => void handleUpdate()}
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? t("supervisor.saving") : t("common.actions.save")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={detailItem != null}
        onClose={() => !loadingDetail && setDetailItem(null)}
        title={detailItem?.name ?? t("consultationTypeLevels.detailTitle")}
        className="w-full max-w-lg overflow-hidden"
      >
        {detailItem && (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("consultationTypeLevels.detailSubtitle")}
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              <span className="tabular-nums">{t("consultationTypeLevels.idLabel", { id: detailItem.id })}</span>
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50/90 to-white px-4 py-4 dark:border-gray-700 dark:from-gray-800/50 dark:to-gray-900/30">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("consultationTypeLevels.detailLevelStat")}
                </p>
                <p className="mt-0.5 text-3xl font-bold tabular-nums leading-none text-gray-900 dark:text-white">
                  {detailItem.levelNumber}
                </p>
              </div>
              <span
                className={
                  detailItem.category === "DOCTOR"
                    ? "inline-flex shrink-0 items-center rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                    : "inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                }
              >
                {t(`consultationTypeLevels.categoryLabels.${detailItem.category}`)}
              </span>
            </div>

            <div className="rounded-xl border border-brand-200/80 bg-gradient-to-br from-brand-50/95 via-white to-white p-5 shadow-sm dark:border-brand-900/45 dark:from-brand-950/25 dark:via-gray-900/40 dark:to-gray-900/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-800 dark:text-brand-200">
                {t("consultationTypeLevels.detailSalaryBand")}
              </p>
              <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-stretch sm:gap-0">
                <div className="flex-1 sm:border-r sm:border-brand-200/60 sm:pr-6 dark:sm:border-brand-900/40">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("consultationTypeLevels.minSalary")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
                    {formatSalaryAmount(detailItem.minSalary)}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center justify-center px-2 sm:flex" aria-hidden>
                  <span className="text-2xl font-light text-brand-300 dark:text-brand-700">|</span>
                </div>
                <div className="flex-1 sm:pl-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("consultationTypeLevels.maxSalary")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
                    {formatSalaryAmount(detailItem.maxSalary)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 dark:hover:bg-brand-500"
              >
                {t("common.actions.close")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={pendingDelete != null}
        onClose={() => !deleteSubmitting && setPendingDelete(null)}
        title={t("consultationTypeLevels.removeModalTitle")}
        className="w-full max-w-lg"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("consultationTypeLevels.removeConfirm", {
              name: pendingDelete?.name ?? "",
            })}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => !deleteSubmitting && setPendingDelete(null)}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={deleteSubmitting}
              onClick={() => void handleConfirmDelete()}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteSubmitting
                ? t("consultationTypeLevels.removing")
                : t("consultationTypeLevels.removeConfirmButton")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
