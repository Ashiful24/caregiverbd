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
  certificationTypesApi,
  serviceChecklistGroupsApi,
  type ServiceCategoryChecklistItem,
  type ServiceCategoryChecklistType,
  type ServiceChecklistGroupItem,
  type ConsultationTypeVerificationRequirementItem,
  type ConsultationTypeCertificationRequirementItem,
  type VerificationDocumentTypeItem,
  type CertificationTypeItem,
} from "../services/api";
import { PencilIcon, PlusIcon, TrashBinIcon } from "../icons";

function resolveServiceText(
  item: ServiceCategoryChecklistItem,
  field: "name" | "description",
  lang: "en" | "bn"
): string {
  if (field === "name") {
    return lang === "bn"
      ? (item.nameBn?.trim() || item.name || "")
      : (item.name || item.nameBn || "");
  }
  return lang === "bn"
    ? (item.descriptionBn?.trim() || item.description || "")
    : (item.description || item.descriptionBn || "");
}

export default function ConsultationTypeConfig() {
  const { t, i18n } = useTranslation();
  const apiLang: "en" | "bn" = i18n.language?.startsWith("bn") ? "bn" : "en";
  const { id } = useParams<{ id: string }>();
  const typeId = id != null ? parseInt(id, 10) : NaN;
  const isValidId = Number.isInteger(typeId) && typeId > 0;

  const [typeName, setTypeName] = useState<string>("");
  const [services, setServices] = useState<ServiceCategoryChecklistItem[]>([]);
  const [requirements, setRequirements] = useState<
    ConsultationTypeVerificationRequirementItem[]
  >([]);
  const [certRequirements, setCertRequirements] = useState<
    ConsultationTypeCertificationRequirementItem[]
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
  const [certModal, setCertModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; item: ConsultationTypeCertificationRequirementItem }
    | null
  >(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceNameBn, setServiceNameBn] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDescriptionBn, setServiceDescriptionBn] = useState("");
  const [serviceFormLoading, setServiceFormLoading] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceCategoryChecklistType>("CHECKLIST");
  const [serviceGroupId, setServiceGroupId] = useState<number | "">("");
  const [checklistGroups, setChecklistGroups] = useState<ServiceChecklistGroupItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [serviceIsActive, setServiceIsActive] = useState(true);
  const [serviceDisplayOrder, setServiceDisplayOrder] = useState(0);
  const [documentTypes, setDocumentTypes] = useState<VerificationDocumentTypeItem[]>([]);
  const [certificationTypes, setCertificationTypes] = useState<CertificationTypeItem[]>([]);
  const [reqDocumentType, setReqDocumentType] = useState("");
  const [certTypeId, setCertTypeId] = useState<number | "">("");
  const [reqIsRequired, setReqIsRequired] = useState(true);
  const [certIsRequired, setCertIsRequired] = useState(true);
  const [reqDisplayOrder, setReqDisplayOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "service"; id: number }
    | { type: "requirement"; id: number }
    | { type: "certification"; id: number }
    | null
  >(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isValidId) return;
    setLoading(true);
    setError("");
    try {
      const [treeRes, servicesRes, reqsRes, certReqsRes, docTypesRes, certTypesRes] =
        await Promise.all([
        consultationTypesApi.getAll({ lang: apiLang }),
        consultationTypesApi.getServices(typeId, { lang: apiLang }),
        consultationTypesApi.getVerificationRequirements(typeId),
        consultationTypesApi.getCertificationRequirements(typeId),
        verificationDocumentTypesApi.list({ activeOnly: true, lang: apiLang }),
        certificationTypesApi.list({ activeOnly: true, lang: apiLang }),
      ]);
      const docTypes = Array.isArray(docTypesRes?.data) ? docTypesRes.data : Array.isArray(docTypesRes) ? docTypesRes : [];
      const certTypes = Array.isArray(certTypesRes?.data)
        ? certTypesRes.data
        : Array.isArray(certTypesRes)
          ? certTypesRes
          : [];
      setDocumentTypes(docTypes);
      setCertificationTypes(certTypes);
      if (docTypes.length > 0 && !reqDocumentType) setReqDocumentType(docTypes[0].code);
      if (certTypes.length > 0 && certTypeId === "") setCertTypeId(certTypes[0].id);
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
      const servicesRaw = servicesRes?.data ?? servicesRes;
      setServices(Array.isArray(servicesRaw) ? servicesRaw : []);
      const reqsRaw = reqsRes?.data ?? reqsRes;
      setRequirements(Array.isArray(reqsRaw) ? reqsRaw : []);
      const certReqsRaw = certReqsRes?.data ?? certReqsRes;
      setCertRequirements(Array.isArray(certReqsRaw) ? certReqsRaw : []);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("consultationConfig.failedToLoad");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [typeId, isValidId, t, apiLang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadChecklistGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await serviceChecklistGroupsApi.list({ lang: apiLang });
      const data = res?.data ?? res;
      const groups = Array.isArray(data) ? data : [];
      setChecklistGroups(groups);
      return groups;
    } catch {
      setChecklistGroups([]);
      return [];
    } finally {
      setGroupsLoading(false);
    }
  }, [apiLang]);

  useEffect(() => {
    if (!serviceModal) return;
    void loadChecklistGroups();
  }, [serviceModal, loadChecklistGroups]);

  const banglaRequired = apiLang === "bn";

  const buildServicePayload = () => {
    const base = {
      name: serviceName.trim(),
      nameBn: serviceNameBn.trim() || undefined,
      description: serviceDescription.trim() || null,
      descriptionBn: serviceDescriptionBn.trim() || null,
      type: serviceType,
      isActive: serviceIsActive,
      displayOrder: serviceDisplayOrder,
    };
    if (serviceType === "CHECKLIST" && serviceGroupId !== "") {
      return { ...base, groupId: serviceGroupId };
    }
    return base;
  };

  const resetServiceForm = () => {
    setServiceName("");
    setServiceNameBn("");
    setServiceDescription("");
    setServiceDescriptionBn("");
    setServiceType("CHECKLIST");
    setServiceGroupId("");
    setServiceIsActive(true);
    setServiceDisplayOrder(0);
    setServiceFormLoading(false);
  };

  const loadServiceFormForEdit = useCallback(
    async (item: ServiceCategoryChecklistItem) => {
      if (!isValidId) return;
      setServiceFormLoading(true);
      try {
        const [enRes, bnRes] = await Promise.all([
          consultationTypesApi.getServices(typeId, { lang: "en" }),
          consultationTypesApi.getServices(typeId, { lang: "bn" }),
        ]);
        const enList = (() => {
          const raw = enRes?.data ?? enRes;
          return Array.isArray(raw) ? raw : [];
        })();
        const bnList = (() => {
          const raw = bnRes?.data ?? bnRes;
          return Array.isArray(raw) ? raw : [];
        })();
        const en = enList.find((s) => s.id === item.id);
        const bn = bnList.find((s) => s.id === item.id);
        setServiceName(en?.name ?? item.name);
        setServiceDescription(en?.description ?? "");
        setServiceNameBn(bn?.nameBn ?? bn?.name ?? "");
        setServiceDescriptionBn(bn?.descriptionBn ?? bn?.description ?? "");
      } catch {
        setServiceName(item.name);
        setServiceDescription(item.description ?? "");
        setServiceNameBn(item.nameBn ?? "");
        setServiceDescriptionBn(item.descriptionBn ?? "");
      } finally {
        setServiceFormLoading(false);
      }
    },
    [isValidId, typeId]
  );

  const serviceFormInvalid =
    !serviceName.trim() ||
    (banglaRequired && !serviceNameBn.trim()) ||
    (serviceType === "CHECKLIST" && (serviceGroupId === "" || groupsLoading));

  const handleAddService = async () => {
    if (!isValidId || serviceFormInvalid) return;
    setSubmitting(true);
    try {
      await consultationTypesApi.createService(typeId, buildServicePayload());
      setServiceModal(null);
      resetServiceForm();
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditService = async () => {
    if (!serviceModal || serviceModal.mode !== "edit" || serviceFormInvalid) return;
    setSubmitting(true);
    try {
      await consultationTypesApi.updateService(typeId, serviceModal.item.id, buildServicePayload());
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
      } else if (pendingDelete.type === "requirement") {
        await consultationTypesApi.deleteVerificationRequirement(typeId, pendingDelete.id);
      } else {
        await consultationTypesApi.deleteCertificationRequirement(typeId, pendingDelete.id);
      }
      setPendingDelete(null);
      await fetchData();
    } catch {
      setError(
        pendingDelete.type === "service"
          ? t("consultationConfig.failedDeleteService")
          : pendingDelete.type === "requirement"
            ? t("consultationConfig.failedDeleteRequirement")
            : t("consultationConfig.failedDeleteCertification")
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

  const handleAddCert = async () => {
    if (!isValidId || certTypeId === "") return;
    setSubmitting(true);
    try {
      await consultationTypesApi.createCertificationRequirement(typeId, {
        certificationTypeId: certTypeId,
        isRequired: certIsRequired,
      });
      setCertModal(null);
      setCertTypeId(certificationTypes[0]?.id ?? "");
      setCertIsRequired(true);
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCert = async () => {
    if (!certModal || certModal.mode !== "edit") return;
    setSubmitting(true);
    try {
      await consultationTypesApi.updateCertificationRequirement(typeId, certModal.item.id, {
        isRequired: certIsRequired,
      });
      setCertModal(null);
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
        title={`${t("consultationConfig.configPrefix")}: ${typeName} | Caregiver BD`}
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
                  .map((s) => {
                    const displayName = resolveServiceText(s, "name", apiLang);
                    const displayDescription = resolveServiceText(s, "description", apiLang);
                    return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-800 dark:text-white/90" dir="auto">
                            {displayName}
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
                        {displayDescription && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2" dir="auto">
                            {displayDescription}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setServiceModal({ mode: "edit", item: s });
                            setServiceName(s.name);
                            setServiceNameBn("");
                            setServiceDescription(s.description ?? "");
                            setServiceDescriptionBn("");
                            setServiceType(s.type ?? "CHECKLIST");
                            setServiceGroupId(
                              s.type === "CHECKLIST" && s.groupId != null ? s.groupId : ""
                            );
                            setServiceIsActive(s.isActive);
                            setServiceDisplayOrder(s.displayOrder);
                            void loadServiceFormForEdit(s);
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
                    );
                  })}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                startIcon={<PlusIcon className="h-4 w-4" />}
                onClick={async () => {
                  setServiceModal({ mode: "add" });
                  resetServiceForm();
                  setServiceDisplayOrder(services.length);
                  const groups = await loadChecklistGroups();
                  if (groups.length > 0) {
                    setServiceGroupId(groups[0].id);
                  }
                }}
              >
                {t("consultationConfig.addService")}
              </Button>
            </div>

            <div className="space-y-8">
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

            {/* Certification requirements */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("consultationConfig.certificationRequirements")}
              </h4>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                {t("consultationConfig.certificationHelp")}
              </p>
              <ul className="space-y-2">
                {certRequirements
                  .sort((a, b) => a.id - b.id)
                  .map((r) => {
                    const typeItem = certificationTypes.find((ct) => ct.id === r.certificationTypeId);
                    const typeLabel = typeItem?.name ?? `#${r.certificationTypeId}`;
                    return (
                      <li
                        key={r.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
                      >
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {typeLabel}
                          {typeItem?.code ? (
                            <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                              ({typeItem.code})
                            </span>
                          ) : null}
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
                              setCertModal({ mode: "edit", item: r });
                              setCertTypeId(r.certificationTypeId);
                              setCertIsRequired(r.isRequired);
                            }}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ type: "certification", id: r.id })}
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
                  setCertModal({ mode: "add" });
                  setCertTypeId(certificationTypes[0]?.id ?? "");
                  setCertIsRequired(true);
                }}
                disabled={certificationTypes.length === 0}
              >
                {t("consultationConfig.addCertificationRequirement")}
              </Button>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Service add/edit modal */}
      {serviceModal && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setServiceModal(null)}
          showCloseButton
          className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-hidden p-0 sm:p-0"
        >
          <div className="flex max-h-[min(90vh,720px)] flex-col">
            <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6 dark:border-gray-800">
              <h3 className="pr-10 text-xl font-semibold text-gray-900 dark:text-white/90">
                {serviceModal.mode === "add"
                  ? t("consultationConfig.addChecklistService")
                  : t("consultationConfig.editService")}
              </h3>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
                <div className="space-y-3">
                  {serviceFormLoading ? (
                    <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {t("consultationConfig.loadingForm")}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {banglaRequired
                          ? t("consultationConfig.formIntroBn")
                          : t("consultationConfig.formIntroEn")}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                        {t("consultationConfig.sectionEnglish")}
                      </p>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t("consultationConfig.nameEn")}
                        </span>
                        <input
                          type="text"
                          value={serviceName}
                          onChange={(e) => setServiceName(e.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                          placeholder={t("consultationConfig.serviceItemNamePlaceholder")}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t("consultationConfig.descriptionEn")}
                        </span>
                        <textarea
                          value={serviceDescription}
                          onChange={(e) => setServiceDescription(e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                          placeholder={t("consultationConfig.serviceItemDescriptionPlaceholder")}
                        />
                      </label>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                        {t("consultationConfig.sectionBangla")}
                      </p>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t("consultationConfig.nameBn")}
                          {!banglaRequired && (
                            <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">
                              ({t("consultationConfig.optional")})
                            </span>
                          )}
                        </span>
                        <input
                          type="text"
                          value={serviceNameBn}
                          onChange={(e) => setServiceNameBn(e.target.value)}
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                          placeholder={t("consultationConfig.nameBnPlaceholder")}
                          dir="auto"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {t("consultationConfig.descriptionBn")}
                          <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">
                            ({t("consultationConfig.optional")})
                          </span>
                        </span>
                        <textarea
                          value={serviceDescriptionBn}
                          onChange={(e) => setServiceDescriptionBn(e.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                          placeholder={t("consultationConfig.descriptionBnPlaceholder")}
                          dir="auto"
                        />
                      </label>
                    </>
                  )}
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("consultationConfig.serviceItemType")}
                    </span>
                    <ThemedSelect
                      value={serviceType}
                      onChange={(e) => {
                        const next = e.target.value as ServiceCategoryChecklistType;
                        setServiceType(next);
                        if (next === "VITALS") {
                          setServiceGroupId("");
                        } else if (serviceGroupId === "" && checklistGroups.length > 0) {
                          setServiceGroupId(checklistGroups[0].id);
                        }
                      }}
                      className="mt-1"
                    >
                      <option value="CHECKLIST">{t("consultationConfig.serviceTypeChecklist")}</option>
                      <option value="VITALS">{t("consultationConfig.serviceTypeVitals")}</option>
                    </ThemedSelect>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {t("consultationConfig.serviceItemTypeHelp")}
                    </span>
                  </label>
                  {serviceType === "CHECKLIST" && (
                    <label className="block">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {t("consultationConfig.serviceItemGroup")}
                      </span>
                      <ThemedSelect
                        value={serviceGroupId === "" ? "" : String(serviceGroupId)}
                        onChange={(e) =>
                          setServiceGroupId(e.target.value ? parseInt(e.target.value, 10) : "")
                        }
                        disabled={groupsLoading || checklistGroups.length === 0}
                        className="mt-1"
                      >
                        <option value="">
                          {groupsLoading
                            ? t("consultationConfig.serviceItemGroupLoading")
                            : t("consultationConfig.serviceItemGroupPlaceholder")}
                        </option>
                        {checklistGroups
                          .sort((a, b) => a.id - b.id)
                          .map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                      </ThemedSelect>
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={serviceIsActive}
                      onChange={setServiceIsActive}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("consultationConfig.serviceItemActive")}
                    </span>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("consultationConfig.displayOrder")}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={serviceDisplayOrder}
                      onChange={(e) => setServiceDisplayOrder(parseInt(e.target.value, 10) || 0)}
                      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </label>
                </div>
              </div>

              <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => !submitting && setServiceModal(null)}
                    disabled={submitting}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {t("common.actions.cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={submitting || serviceFormInvalid || serviceFormLoading}
                    onClick={serviceModal.mode === "add" ? handleAddService : handleEditService}
                    className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {submitting ? t("supervisor.saving") : t("common.actions.save")}
                  </button>
                </div>
              </div>
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
              : pendingDelete?.type === "certification"
                ? t("consultationConfig.removeCertificationConfirm")
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

      {/* Certification requirement add/edit modal */}
      {certModal && (
        <Modal
          isOpen={true}
          onClose={() => !submitting && setCertModal(null)}
          title={
            certModal.mode === "add"
              ? t("consultationConfig.addCertificationRequirement")
              : t("consultationConfig.editCertificationRequirement")
          }
          className="w-full max-w-lg"
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("consultationConfig.certificationType")}
              </span>
              <select
                value={certTypeId}
                onChange={(e) => setCertTypeId(e.target.value ? parseInt(e.target.value, 10) : "")}
                disabled={certModal.mode === "edit"}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 disabled:opacity-70"
              >
                {certificationTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name} ({ct.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={certIsRequired}
                onChange={setCertIsRequired}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t("consultationConfig.required")}
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !submitting && setCertModal(null)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting || certTypeId === ""}
                onClick={certModal.mode === "add" ? handleAddCert : handleEditCert}
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
