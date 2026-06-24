import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Button from "../components/ui/button/Button";
import Label from "../components/form/Label";
import TextArea from "../components/form/input/TextArea";
import { Modal } from "../components/ui/modal";
import {
  serviceChecklistGroupsApi,
  type ServiceChecklistGroupItem,
  type ServiceChecklistGroupPayload,
} from "../services/api";
import { PencilIcon, PlusIcon, TrashBinIcon } from "../icons";

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30";

type VisibleFormState = {
  name: string;
  description: string;
};

const emptyVisibleForm = (): VisibleFormState => ({
  name: "",
  description: "",
});

function truncate(text: string, max = 60): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function toPayload(
  form: VisibleFormState,
  sibling: VisibleFormState,
  lang: "en" | "bn"
): ServiceChecklistGroupPayload {
  const name = form.name.trim();
  const description = form.description.trim();
  const siblingName = sibling.name.trim();
  const siblingDescription = sibling.description.trim();

  if (lang === "en") {
    return {
      name,
      description,
      nameBn: siblingName,
      descriptionBn: siblingDescription,
    };
  }

  // Bangla mode: form binds to name/description; mirror into nameBn/descriptionBn.
  // Keep existing English from sibling when editing; on create sibling is empty so
  // name and description receive the same Bangla values as nameBn/descriptionBn.
  return {
    name: siblingName || name,
    description: siblingDescription || description,
    nameBn: name,
    descriptionBn: description,
  };
}
export default function ServiceChecklistGroups() {
  const { t, i18n } = useTranslation();
  const apiLang: "en" | "bn" = i18n.resolvedLanguage === "bn" ? "bn" : "en";
  const [list, setList] = useState<ServiceChecklistGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formModal, setFormModal] = useState<
    { mode: "add" } | { mode: "edit"; item: ServiceChecklistGroupItem } | null
  >(null);
  const [form, setForm] = useState<VisibleFormState>(emptyVisibleForm);
  const [siblingForm, setSiblingForm] = useState<VisibleFormState>(emptyVisibleForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ServiceChecklistGroupItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await serviceChecklistGroupsApi.list({ lang: apiLang });
      const data = res?.data ?? res;
      setList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("serviceChecklistGroups.failedLoad");
      setError(msg);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [t, apiLang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadFormForEdit = useCallback(
    async (id: number, lang: "en" | "bn") => {
      setFormLoading(true);
      try {
        const siblingLang = lang === "en" ? "bn" : "en";
        const [currentRes, siblingRes] = await Promise.all([
          serviceChecklistGroupsApi.getById(id, { lang }),
          serviceChecklistGroupsApi.getById(id, { lang: siblingLang }),
        ]);
        const current = (currentRes?.data ?? currentRes) as ServiceChecklistGroupItem;
        const sibling = (siblingRes?.data ?? siblingRes) as ServiceChecklistGroupItem;
        setForm({
          name: current.name ?? "",
          description: current.description ?? "",
        });
        setSiblingForm({
          name: sibling.name ?? "",
          description: sibling.description ?? "",
        });
      } catch {
        setForm(emptyVisibleForm());
        setSiblingForm(emptyVisibleForm());
      } finally {
        setFormLoading(false);
      }
    },
    []
  );

  const openAdd = () => {
    setForm(emptyVisibleForm());
    setSiblingForm(emptyVisibleForm());
    setFormError(null);
    setFormModal({ mode: "add" });
  };

  const openEdit = (item: ServiceChecklistGroupItem) => {
    setFormError(null);
    setFormModal({ mode: "edit", item });
    void loadFormForEdit(item.id, apiLang);
  };

  useEffect(() => {
    if (formModal?.mode === "edit") {
      void loadFormForEdit(formModal.item.id, apiLang);
    }
  }, [apiLang, formModal, loadFormForEdit]);

  const closeFormModal = () => {
    if (submitting) return;
    setFormModal(null);
    setForm(emptyVisibleForm());
    setSiblingForm(emptyVisibleForm());
    setFormError(null);
    setFormLoading(false);
  };

  const formInvalid = !form.name.trim() || !form.description.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formModal || formInvalid) return;

    const payload = toPayload(form, siblingForm, apiLang);

    setSubmitting(true);
    setFormError(null);
    try {
      if (formModal.mode === "add") {
        await serviceChecklistGroupsApi.create(payload);
      } else {
        await serviceChecklistGroupsApi.update(formModal.item.id, payload);
      }
      closeFormModal();
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : formModal.mode === "add"
            ? t("serviceChecklistGroups.failedAdd")
            : t("serviceChecklistGroups.failedUpdate");
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteSubmitting(true);
    setError("");
    try {
      await serviceChecklistGroupsApi.delete(pendingDelete.id);
      setPendingDelete(null);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("serviceChecklistGroups.failedDelete");
      setError(msg);
      setPendingDelete(null);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const formTitle =
    formModal?.mode === "edit"
      ? t("serviceChecklistGroups.editModalTitle")
      : t("serviceChecklistGroups.addModalTitle");

  return (
    <>
      <PageMeta
        title={t("serviceChecklistGroups.metaTitle")}
        description={t("serviceChecklistGroups.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("serviceChecklistGroups.pageTitle")} />

      <div className="min-w-0 max-w-full rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {t("serviceChecklistGroups.heading")}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("serviceChecklistGroups.subheading")}
            </p>
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
              {t("serviceChecklistGroups.addGroup")}
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
              {t("serviceChecklistGroups.loading")}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                <table className="min-w-[600px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        {t("serviceChecklistGroups.colId")}
                      </th>
                      <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        {t("serviceChecklistGroups.colName")}
                      </th>
                      <th className="py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                        {t("serviceChecklistGroups.colDescription")}
                      </th>
                      <th className="whitespace-nowrap py-3 text-right font-medium text-gray-500 dark:text-gray-400">
                        {t("serviceChecklistGroups.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {list
                      .sort((a, b) => a.id - b.id)
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 text-gray-600 dark:text-gray-400">{item.id}</td>
                          <td className="py-3 font-medium text-gray-800 dark:text-white/90" dir="auto">
                            {item.name}
                          </td>
                          <td className="max-w-md py-3 text-gray-600 dark:text-gray-400" dir="auto">
                            {truncate(item.description)}
                          </td>
                          <td className="whitespace-nowrap py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                                aria-label={t("serviceChecklistGroups.editGroup")}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(item)}
                                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                aria-label={t("serviceChecklistGroups.deleteGroup")}
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
                    {t("serviceChecklistGroups.emptyState")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {formModal && (
        <Modal
          isOpen={true}
          onClose={closeFormModal}
          showCloseButton
          className="max-h-[min(90vh,720px)] w-full max-w-2xl overflow-hidden p-0 sm:p-0"
        >
          <div className="flex max-h-[min(90vh,720px)] flex-col">
            <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6 dark:border-gray-800">
              <h3 className="pr-10 text-xl font-semibold text-gray-900 dark:text-white/90">
                {formTitle}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {apiLang === "bn"
                  ? t("serviceChecklistGroups.formIntroBn")
                  : t("serviceChecklistGroups.formIntroEn")}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
                {formLoading ? (
                  <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t("serviceChecklistGroups.loading")}
                  </div>
                ) : (
                  <div className="grid gap-5">
                    <div>
                      <Label htmlFor="scg-name">{t("serviceChecklistGroups.colName")}</Label>
                      <input
                        id="scg-name"
                        type="text"
                        value={form.name}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, name: e.target.value }));
                          setFormError(null);
                        }}
                        className={inputClass}
                        placeholder={
                          apiLang === "bn"
                            ? t("serviceChecklistGroups.nameBnPlaceholder")
                            : t("serviceChecklistGroups.nameEnPlaceholder")
                        }
                        dir="auto"
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="scg-description">
                        {t("serviceChecklistGroups.colDescription")}
                      </Label>
                      <TextArea
                        id="scg-description"
                        rows={3}
                        value={form.description}
                        onChange={(value) => {
                          setForm((f) => ({ ...f, description: value }));
                          setFormError(null);
                        }}
                        placeholder={
                          apiLang === "bn"
                            ? t("serviceChecklistGroups.descriptionBnPlaceholder")
                            : t("serviceChecklistGroups.descriptionEnPlaceholder")
                        }
                      />
                    </div>
                  </div>
                )}

                {formError ? (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    {formError}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeFormModal}
                    disabled={submitting}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {t("common.actions.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || formInvalid || formLoading}
                    className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {submitting
                      ? t("supervisor.saving")
                      : formModal.mode === "add"
                        ? t("serviceChecklistGroups.add")
                        : t("common.actions.saveChanges")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          isOpen={true}
          onClose={() => !deleteSubmitting && setPendingDelete(null)}
          title={t("serviceChecklistGroups.deleteModalTitle")}
          className="w-full max-w-lg"
        >
          <div className="space-y-4 pt-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("serviceChecklistGroups.deleteConfirm", {
                name: pendingDelete.name,
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
                  ? t("serviceChecklistGroups.deleting")
                  : t("serviceChecklistGroups.deleteConfirmButton")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
