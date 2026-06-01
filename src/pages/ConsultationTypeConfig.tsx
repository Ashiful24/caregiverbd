import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Button from "../components/ui/button/Button";
import Checkbox from "../components/form/input/Checkbox";
import ThemedSelect from "../components/form/ThemedSelect";
import { Modal } from "../components/ui/modal";
import {
  consultationTypesApi,
  verificationDocumentTypesApi,
  type ServiceCategoryChecklistItem,
  type ServiceCategoryChecklistType,
  type ConsultationTypeVerificationRequirementItem,
  type VerificationDocumentTypeItem,
} from "../services/api";
import { PencilIcon, PlusIcon, TrashBinIcon } from "../icons";

export default function ConsultationTypeConfig() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const typeId = id != null ? parseInt(id, 10) : NaN;
  const isValidId = Number.isInteger(typeId) && typeId > 0;

  const [typeName, setTypeName] = useState<string>("");
  const [services, setServices] = useState<ServiceCategoryChecklistItem[]>([]);
  const [requirements, setRequirements] = useState<
    ConsultationTypeVerificationRequirementItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [serviceModal, setServiceModal] = useState<
    { mode: "add" } | { mode: "edit"; item: ServiceCategoryChecklistItem } | null
  >(null);
  const [reqModal, setReqModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; item: ConsultationTypeVerificationRequirementItem }
    | null
  >(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceType, setServiceType] = useState<ServiceCategoryChecklistType>("CHECKLIST");
  const [serviceIsActive, setServiceIsActive] = useState(true);
  const [serviceDisplayOrder, setServiceDisplayOrder] = useState(0);
  const [documentTypes, setDocumentTypes] = useState<VerificationDocumentTypeItem[]>([]);
  const [reqDocumentType, setReqDocumentType] = useState("");
  const [reqIsRequired, setReqIsRequired] = useState(true);
  const [reqDisplayOrder, setReqDisplayOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    { type: "service"; id: number } | { type: "requirement"; id: number } | null
  >(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isValidId) return;
    setLoading(true);
    setError("");
    try {
      const [treeRes, servicesRes, reqsRes, docTypesRes] = await Promise.all([
        consultationTypesApi.getAll(),
        consultationTypesApi.getServices(typeId),
        consultationTypesApi.getVerificationRequirements(typeId),
        verificationDocumentTypesApi.list({ activeOnly: true }),
      ]);
      const docTypes = Array.isArray(docTypesRes?.data) ? docTypesRes.data : Array.isArray(docTypesRes) ? docTypesRes : [];
      setDocumentTypes(docTypes);
      if (docTypes.length > 0 && !reqDocumentType) setReqDocumentType(docTypes[0].code);
      const tree = Array.isArray(treeRes.data) ? treeRes.data : [treeRes.data];
      const findName = (nodes: typeof tree): string => {
        for (const n of nodes) {
          if (n.id === typeId) return n.name ?? "";
          if (n.children?.length) {
            const found = findName(n.children);
            if (found) return found;
          }
        }
        return "";
      };
      setTypeName(findName(tree) || `${t("consultationConfig.typePrefix")} #${typeId}`);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setRequirements(Array.isArray(reqsRes.data) ? reqsRes.data : []);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationConfig.failedToLoad");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [typeId, isValidId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddService = async () => {
    if (!isValidId) return;
    setSubmitting(true);
    try {
      await consultationTypesApi.createService(typeId, {
        name: serviceName.trim(),
        description: serviceDescription.trim() || null,
        type: serviceType,
        isActive: serviceIsActive,
        displayOrder: serviceDisplayOrder,
      });
      setServiceModal(null);
      setServiceName("");
      setServiceDescription("");
      setServiceType("CHECKLIST");
      setServiceIsActive(true);
      setServiceDisplayOrder(0);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditService = async () => {
    if (!serviceModal || serviceModal.mode !== "edit") return;
    setSubmitting(true);
    try {
      await consultationTypesApi.updateService(typeId, serviceModal.item.id, {
        name: serviceName.trim(),
        description: serviceDescription.trim() || null,
        type: serviceType,
        isActive: serviceIsActive,
        displayOrder: serviceDisplayOrder,
      });
      setServiceModal(null);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteSubmitting(true);
    setError("");
    try {
      if (pendingDelete.type === "service") {
        await consultationTypesApi.deleteService(typeId, pendingDelete.id);
      } else {
        await consultationTypesApi.deleteVerificationRequirement(typeId, pendingDelete.id);
      }
      setPendingDelete(null);
      await fetchData();
    } catch {
      setError(
        pendingDelete.type === "service"
          ? t("consultationConfig.failedDeleteService")
          : t("consultationConfig.failedDeleteRequirement")
      );
      setPendingDelete(null);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleAddReq = async () => {
    if (!isValidId) return;
    setSubmitting(true);
    try {
      await consultationTypesApi.createVerificationRequirement(typeId, {
        documentType: reqDocumentType,
        isRequired: reqIsRequired,
        displayOrder: reqDisplayOrder,
      });
      setReqModal(null);
      setReqDocumentType(documentTypes[0]?.code ?? "");
      setReqIsRequired(true);
      setReqDisplayOrder(0);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReq = async () => {
    if (!reqModal || reqModal.mode !== "edit") return;
    setSubmitting(true);
    try {
      await consultationTypesApi.updateVerificationRequirement(
        typeId,
        reqModal.item.id,
        { isRequired: reqIsRequired, displayOrder: reqDisplayOrder }
      );
      setReqModal(null);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValidId) {
    return (
      <>
        <PageBreadcrumb pageTitle={t("consultationConfig.pageTitle")} />
        <p className="text-gray-500 dark:text-gray-400">{t("consultationConfig.invalidTypeId")}</p>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={`${t("consultationConfig.configPrefix")}: ${typeName} | Hope - BMQAS`}
        description={t("consultationConfig.metaDescription")}
      />
      <PageBreadcrumb pageTitle={`${t("consultationConfig.configPrefix")}: ${typeName || `${t("consultationConfig.typePrefix")} #${typeId}`}`} />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {typeName || `${t("consultationConfig.typePrefix")} #${typeId}`}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <Link to="/consultation-types" className="text-brand-600 hover:underline dark:text-brand-400">
                ← {t("consultationConfig.backToTree")}
              </Link>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("consultationConfig.loading")}
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Checklist services */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("consultationConfig.checklistServices")}
              </h4>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                {t("consultationConfig.checklistHelp")}
              </p>
              <ul className="space-y-2">
                {services
                  .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-800 dark:text-white/90">
                            {s.name}
                          </span>
                          {s.type === "VITALS" && (
                            <span className="rounded bg-blue-100 px-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                              {t("consultationConfig.serviceTypeVitals")}
                            </span>
                          )}
                          {!s.isActive && (
                            <span className="rounded bg-gray-200 px-1.5 text-xs text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                              {t("common.status.inactive")}
                            </span>
                          )}
                        </div>
                        {s.description && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setServiceModal({ mode: "edit", item: s });
                            setServiceName(s.name);
                            setServiceDescription(s.description ?? "");
                            setServiceType(s.type ?? "CHECKLIST");
                            setServiceIsActive(s.isActive);
                            setServiceDisplayOrder(s.displayOrder);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ type: "service", id: s.id })}
                          className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        >
                          <TrashBinIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                startIcon={<PlusIcon className="h-4 w-4" />}
                onClick={() => {
                  setServiceModal({ mode: "add" });
                  setServiceName("");
                  setServiceDescription("");
                  setServiceType("CHECKLIST");
                  setServiceIsActive(true);
                  setServiceDisplayOrder(services.length);
                }}
              >
                {t("consultationConfig.addService")}
              </Button>
            </div>

            {/* Verification requirements */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("consultationConfig.verificationRequirements")}
              </h4>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                {t("consultationConfig.verificationHelp")}
              </p>
              <ul className="space-y-2">
                {requirements
                  .sort(
                    (a, b) =>
                      a.displayOrder - b.displayOrder || a.id - b.id
                  )
                  .map((r) => {
                    const typeLabel = documentTypes.find((t) => t.code === r.documentType)?.label ?? r.documentType.replace(/_/g, " ");
                    return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {typeLabel}
                        {r.isRequired && (
                          <span className="ml-1.5 rounded bg-amber-100 px-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            {t("consultationConfig.required")}
                          </span>
                        )}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReqModal({ mode: "edit", item: r });
                            setReqDocumentType(r.documentType);
                            setReqIsRequired(r.isRequired);
                            setReqDisplayOrder(r.displayOrder);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ type: "requirement", id: r.id })}
                          className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        >
                          <TrashBinIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                    );
                  })}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                startIcon={<PlusIcon className="h-4 w-4" />}
                onClick={() => {
                  setReqModal({ mode: "add" });
                  setReqDocumentType(documentTypes[0]?.code ?? "");
                  setReqIsRequired(true);
                  setReqDisplayOrder(requirements.length);
                }}
              >
                {t("consultationConfig.addRequirement")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Service add/edit modal */}
      {serviceModal && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setServiceModal(null)}
          title={serviceModal.mode === "add" ? t("consultationConfig.addChecklistService") : t("consultationConfig.editService")}
          className="w-full max-w-lg"
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("consultationConfig.serviceItemName")}</span>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("consultationConfig.serviceItemNamePlaceholder")}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("consultationConfig.serviceItemDescription")}</span>
              <textarea
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("consultationConfig.serviceItemDescriptionPlaceholder")}
              />
            </label>
            <div className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("consultationConfig.serviceItemType")}</span>
              <ThemedSelect
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceCategoryChecklistType)}
                className="mt-1"
              >
                <option value="CHECKLIST">{t("consultationConfig.serviceTypeChecklist")}</option>
                <option value="VITALS">{t("consultationConfig.serviceTypeVitals")}</option>
              </ThemedSelect>
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                {t("consultationConfig.serviceItemTypeHelp")}
              </span>
            </div>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={serviceIsActive}
                onChange={setServiceIsActive}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("consultationConfig.serviceItemActive")}</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("consultationConfig.displayOrder")}</span>
              <input
                type="number"
                min={0}
                value={serviceDisplayOrder}
                onChange={(e) => setServiceDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !submitting && setServiceModal(null)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting || !serviceName.trim()}
                onClick={serviceModal.mode === "add" ? handleAddService : handleEditService}
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? t("supervisor.saving") : t("common.actions.save")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Remove checklist / requirement confirmation */}
      <Modal
        isOpen={pendingDelete != null}
        onClose={() => !deleteSubmitting && setPendingDelete(null)}
        title={t("consultationConfig.removeModalTitle")}
        className="w-full max-w-lg"
      >
        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {pendingDelete?.type === "requirement"
              ? t("consultationConfig.removeVerificationConfirm")
              : t("consultationConfig.removeChecklistConfirm")}
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
              {deleteSubmitting ? t("consultationConfig.removing") : t("consultationConfig.removeConfirmButton")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Verification requirement add/edit modal */}
      {reqModal && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setReqModal(null)}
          title={
            reqModal.mode === "add"
              ? t("consultationConfig.addVerificationRequirement")
              : t("consultationConfig.editRequirement")
          }
          className="w-full max-w-lg"
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("consultationConfig.verificationDocumentType")}</span>
              <select
                value={reqDocumentType}
                onChange={(e) => setReqDocumentType(e.target.value)}
                disabled={reqModal.mode === "edit"}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 disabled:opacity-70"
              >
                {documentTypes.map((t) => (
                  <option key={t.id} value={t.code}>
                    {t.label} ({t.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={reqIsRequired}
                onChange={setReqIsRequired}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("consultationConfig.required")}</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("consultationConfig.displayOrder")}</span>
              <input
                type="number"
                min={0}
                value={reqDisplayOrder}
                onChange={(e) => setReqDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !submitting && setReqModal(null)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={reqModal.mode === "add" ? handleAddReq : handleEditReq}
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
