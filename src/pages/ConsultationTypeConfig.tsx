import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Button from "../components/ui/button/Button";
import { Modal } from "../components/ui/modal";
import {
  consultationTypesApi,
  verificationDocumentTypesApi,
  type ConsultationTypeServiceItem,
  type ConsultationTypeVerificationRequirementItem,
  type VerificationDocumentTypeItem,
} from "../services/api";
import { PencilIcon, PlusIcon, TrashBinIcon } from "../icons";

export default function ConsultationTypeConfig() {
  const { id } = useParams<{ id: string }>();
  const typeId = id != null ? parseInt(id, 10) : NaN;
  const isValidId = Number.isInteger(typeId) && typeId > 0;

  const [typeName, setTypeName] = useState<string>("");
  const [services, setServices] = useState<ConsultationTypeServiceItem[]>([]);
  const [requirements, setRequirements] = useState<
    ConsultationTypeVerificationRequirementItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [serviceModal, setServiceModal] = useState<
    { mode: "add" } | { mode: "edit"; item: ConsultationTypeServiceItem } | null
  >(null);
  const [reqModal, setReqModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; item: ConsultationTypeVerificationRequirementItem }
    | null
  >(null);
  const [serviceLabel, setServiceLabel] = useState("");
  const [serviceDisplayOrder, setServiceDisplayOrder] = useState(0);
  const [documentTypes, setDocumentTypes] = useState<VerificationDocumentTypeItem[]>([]);
  const [reqDocumentType, setReqDocumentType] = useState("");
  const [reqIsRequired, setReqIsRequired] = useState(true);
  const [reqDisplayOrder, setReqDisplayOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);

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
      setTypeName(findName(tree) || `Type #${typeId}`);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setRequirements(Array.isArray(reqsRes.data) ? reqsRes.data : []);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to load.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [typeId, isValidId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddService = async () => {
    if (!isValidId) return;
    setSubmitting(true);
    try {
      await consultationTypesApi.createService(typeId, {
        label: serviceLabel.trim(),
        displayOrder: serviceDisplayOrder,
      });
      setServiceModal(null);
      setServiceLabel("");
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
        label: serviceLabel.trim(),
        displayOrder: serviceDisplayOrder,
      });
      setServiceModal(null);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    if (!window.confirm("Remove this checklist service?")) return;
    try {
      await consultationTypesApi.deleteService(typeId, serviceId);
      await fetchData();
    } catch {
      setError("Failed to delete service.");
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

  const handleDeleteReq = async (reqId: number) => {
    if (!window.confirm("Remove this verification requirement?")) return;
    try {
      await consultationTypesApi.deleteVerificationRequirement(typeId, reqId);
      await fetchData();
    } catch {
      setError("Failed to delete requirement.");
    }
  };

  if (!isValidId) {
    return (
      <>
        <PageBreadcrumb pageTitle="Consultation type config" />
        <p className="text-gray-500 dark:text-gray-400">Invalid type ID.</p>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={`Config: ${typeName} | Hope - BMQAS`}
        description="Manage checklist services and verification requirements for this consultation type"
      />
      <PageBreadcrumb pageTitle={`Config: ${typeName || `Type #${typeId}`}`} />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {typeName || `Type #${typeId}`}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <Link to="/consultation-types" className="text-brand-600 hover:underline dark:text-brand-400">
                ← Back to tree
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
            Loading…
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Checklist services */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Checklist services
              </h4>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Items providers can offer or exclude for this consultation type.
              </p>
              <ul className="space-y-2">
                {services
                  .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
                  .map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {s.label}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setServiceModal({ mode: "edit", item: s });
                            setServiceLabel(s.label);
                            setServiceDisplayOrder(s.displayOrder);
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteService(s.id)}
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
                  setServiceLabel("");
                  setServiceDisplayOrder(services.length);
                }}
              >
                Add service
              </Button>
            </div>

            {/* Verification requirements */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Verification requirements
              </h4>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                Verification document types required for this consultation type. Types are managed under Document Types in the sidebar.
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
                            Required
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
                          onClick={() => handleDeleteReq(r.id)}
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
                Add requirement
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
          title={serviceModal.mode === "add" ? "Add checklist service" : "Edit service"}
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Label</span>
              <input
                type="text"
                value={serviceLabel}
                onChange={(e) => setServiceLabel(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder="e.g. Vital signs check"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Display order</span>
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
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !serviceLabel.trim()}
                onClick={serviceModal.mode === "add" ? handleAddService : handleEditService}
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Verification requirement add/edit modal */}
      {reqModal && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setReqModal(null)}
          title={
            reqModal.mode === "add"
              ? "Add verification requirement"
              : "Edit requirement"
          }
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Verification document type (from Document Types entity)</span>
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
              <input
                type="checkbox"
                checked={reqIsRequired}
                onChange={(e) => setReqIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Display order</span>
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
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={reqModal.mode === "add" ? handleAddReq : handleEditReq}
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
