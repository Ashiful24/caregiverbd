import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { BillingModeBadge } from "./BillingModeBadge";
import { BillingRateTable } from "./BillingRateTable";
import { BillingRateFormModal } from "./BillingRateFormModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { ModeSwitchConfirmationModal } from "./ModeSwitchConfirmationModal";
import { BillingHistoryAccordion } from "./BillingHistoryAccordion";
import { SettingsAlert, PanelLoading } from "../admin-settings/shared";
import {
  useProviderBillingHistory,
  useProviderBillingMutations,
  useProviderBillingRates,
} from "../../hooks/provider-billing/useProviderBilling";
import type { BillingModeConflictData, BillingRateTier } from "../../types/providerBilling";
import {
  detectBillingMode,
  getCreatableBillingTypes,
  getApiErrorMessage,
  isDuplicateBillingTypeError,
  parseBillingModeConflict,
} from "../../utils/providerBilling";

type ToastState = { variant: "success" | "error"; message: string } | null;

export function BillingTab({ providerId }: { providerId: number }) {
  const { t } = useTranslation();
  const [toast, setToast] = useState<ToastState>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingRate, setEditingRate] = useState<BillingRateTier | null>(null);
  const [deleteRate, setDeleteRate] = useState<BillingRateTier | null>(null);
  const [formError, setFormError] = useState("");
  const [modeSwitchConflict, setModeSwitchConflict] = useState<BillingModeConflictData | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{ type: BillingRateTier["type"]; amount: number } | null>(null);

  const ratesQuery = useProviderBillingRates(providerId);
  const historyQuery = useProviderBillingHistory(providerId);
  const { createMutation, createWithConfirmMutation, updateMutation, deleteMutation } =
    useProviderBillingMutations(providerId);

  const activeRates = ratesQuery.data ?? [];
  const billingMode = useMemo(() => detectBillingMode(activeRates), [activeRates]);
  const creatableTypes = useMemo(
    () => getCreatableBillingTypes(billingMode, activeRates),
    [billingMode, activeRates]
  );

  const showToast = useCallback((variant: "success" | "error", message: string) => {
    setToast({ variant, message });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const openCreate = () => {
    setFormMode("create");
    setEditingRate(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (rate: BillingRateTier) => {
    setFormMode("edit");
    setEditingRate(rate);
    setFormError("");
    setFormOpen(true);
  };

  const handleCreate = async (values: { type: BillingRateTier["type"]; amount: number }) => {
    setFormError("");
    try {
      await createMutation.mutateAsync({ type: values.type, amount: values.amount });
      setFormOpen(false);
      showToast("success", t("providerBilling.toast.created"));
    } catch (error) {
      if (isDuplicateBillingTypeError(error)) {
        showToast("error", t("providerBilling.toast.duplicateType"));
        return;
      }
      const conflict = parseBillingModeConflict(error);
      if (conflict) {
        setPendingCreate(values);
        setModeSwitchConflict(conflict);
        setFormOpen(false);
        return;
      }
      setFormError(getApiErrorMessage(error, t("providerBilling.toast.createFailed")));
    }
  };

  const handleModeSwitchConfirm = async () => {
    if (!pendingCreate) return;
    try {
      await createWithConfirmMutation.mutateAsync({
        type: pendingCreate.type,
        amount: pendingCreate.amount,
      });
      setModeSwitchConflict(null);
      setPendingCreate(null);
      setFormOpen(false);
      showToast("success", t("providerBilling.toast.created"));
    } catch (error) {
      showToast("error", getApiErrorMessage(error, t("providerBilling.toast.createFailed")));
    }
  };

  const handleUpdate = async (values: { type: BillingRateTier["type"]; amount: number }) => {
    if (!editingRate) return;
    setFormError("");
    try {
      await updateMutation.mutateAsync({
        rateId: editingRate.id,
        payload: { amount: values.amount },
      });
      setFormOpen(false);
      setEditingRate(null);
      showToast("success", t("providerBilling.toast.updated"));
    } catch (error) {
      setFormError(getApiErrorMessage(error, t("providerBilling.toast.updateFailed")));
    }
  };

  const handleDelete = async () => {
    if (!deleteRate) return;
    try {
      await deleteMutation.mutateAsync(deleteRate.id);
      setDeleteRate(null);
      showToast("success", t("providerBilling.toast.deleted"));
    } catch (error) {
      showToast("error", getApiErrorMessage(error, t("providerBilling.toast.deleteFailed")));
    }
  };

  const formSubmitting =
    createMutation.isPending || createWithConfirmMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      {toast ? (
        <SettingsAlert
          variant={toast.variant === "success" ? "success" : "error"}
          title={toast.variant === "success" ? t("systemConfig.savedTitle") : t("systemConfig.errorTitle")}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {ratesQuery.isError ? (
        <SettingsAlert
          variant="error"
          title={t("systemConfig.errorTitle")}
          message={getApiErrorMessage(ratesQuery.error, t("providerBilling.loadFailed"))}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {t("providerBilling.modeLabel")}
          </h4>
          <BillingModeBadge mode={billingMode} />
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={ratesQuery.isLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
        >
          <Plus className="h-4 w-4" />
          {t("providerBilling.addRate")}
        </button>
      </div>

      {billingMode === "CONSULTATION" && activeRates.length > 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("providerBilling.consultationModeHint")}</p>
      ) : billingMode === "SHIFT_BASED" && activeRates.length > 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("providerBilling.shiftModeHint")}</p>
      ) : null}

      {ratesQuery.isLoading ? (
        <PanelLoading message={t("systemConfig.loading")} />
      ) : (
        <BillingRateTable rates={activeRates} onEdit={openEdit} onDelete={setDeleteRate} />
      )}

      <BillingHistoryAccordion history={historyQuery.data ?? []} loading={historyQuery.isLoading} />

      <BillingRateFormModal
        isOpen={formOpen}
        onClose={() => {
          if (!formSubmitting) setFormOpen(false);
        }}
        mode={formMode}
        availableTypes={creatableTypes}
        initialRate={editingRate}
        submitting={formSubmitting}
        error={formError}
        onSubmit={formMode === "create" ? handleCreate : handleUpdate}
      />

      <DeleteConfirmationModal
        isOpen={deleteRate !== null}
        rate={deleteRate}
        submitting={deleteMutation.isPending}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteRate(null);
        }}
        onConfirm={handleDelete}
      />

      <ModeSwitchConfirmationModal
        isOpen={modeSwitchConflict !== null}
        conflict={modeSwitchConflict}
        fallbackRates={activeRates}
        submitting={createWithConfirmMutation.isPending}
        onClose={() => {
          if (!createWithConfirmMutation.isPending) {
            setModeSwitchConflict(null);
            setPendingCreate(null);
          }
        }}
        onConfirm={handleModeSwitchConfirm}
      />
    </div>
  );
}
