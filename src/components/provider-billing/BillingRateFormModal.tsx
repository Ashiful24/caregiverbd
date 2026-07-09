import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import ThemedSelect from "../form/ThemedSelect";
import { inputClass, labelClass } from "../admin-settings/shared";
import type { BillingRateTier, BillingRateType } from "../../types/providerBilling";
import { validateBillingAmount } from "../../utils/providerBilling";

export function BillingRateFormModal({
  isOpen,
  onClose,
  mode,
  availableTypes,
  initialRate,
  submitting,
  error,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  availableTypes: BillingRateType[];
  initialRate?: BillingRateTier | null;
  submitting: boolean;
  error?: string;
  onSubmit: (values: { type: BillingRateType; amount: number }) => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<BillingRateType>("HOURLY");
  const [amount, setAmount] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && initialRate) {
      setType(initialRate.type);
      setAmount(initialRate.amount);
    } else {
      setType(availableTypes[0] ?? "HOURLY");
      setAmount("");
    }
    setValidationError(null);
  }, [isOpen, mode, initialRate, availableTypes]);

  const handleSubmit = () => {
    const amountError = validateBillingAmount(amount);
    if (amountError) {
      setValidationError(amountError);
      return;
    }
    if (mode === "create" && !type) {
      setValidationError("providerBilling.validation.typeRequired");
      return;
    }
    setValidationError(null);
    onSubmit({ type, amount: Number(amount) });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {mode === "create" ? t("providerBilling.addRate") : t("providerBilling.editRate")}
        </h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className={labelClass}>{t("providerBilling.billingType")}</label>
            {mode === "edit" ? (
              <p className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
                {t(`providerBilling.types.${type}`)}
              </p>
            ) : (
              <ThemedSelect
                value={type}
                onChange={(e) => setType(e.target.value as BillingRateType)}
                className="mt-1"
                disabled={availableTypes.length === 0}
              >
                {availableTypes.map((option) => (
                  <option key={option} value={option}>
                    {t(`providerBilling.types.${option}`)}
                  </option>
                ))}
              </ThemedSelect>
            )}
          </div>

          <div>
            <label className={labelClass}>{t("providerBilling.amount")}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="500"
            />
          </div>

          {validationError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{t(validationError)}</p>
          ) : null}
          {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t("common.actions.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (mode === "create" && availableTypes.length === 0)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
          >
            {submitting ? t("systemConfig.loading") : t("common.actions.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
