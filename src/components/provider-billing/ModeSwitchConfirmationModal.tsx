import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import { formatDate } from "../../utils/format";
import type { BillingModeConflictData, BillingRateTier } from "../../types/providerBilling";

export function ModeSwitchConfirmationModal({
  isOpen,
  conflict,
  fallbackRates = [],
  submitting,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  conflict: BillingModeConflictData | null;
  fallbackRates?: BillingRateTier[];
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  const ratesToShow =
    (conflict?.conflictingRates?.length ?? 0) > 0
      ? conflict!.conflictingRates
      : fallbackRates;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("providerBilling.modeSwitchTitle")}
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("providerBilling.modeSwitchMessage")}
        </p>

        {(ratesToShow.length ?? 0) > 0 ? (
          <ul className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
            {ratesToShow.map((rate) => (
              <li key={rate.id} className="text-amber-900 dark:text-amber-100">
                {t(`providerBilling.types.${rate.type}`)} — ৳{rate.amount} ({formatDate(rate.validFrom)})
              </li>
            ))}
          </ul>
        ) : null}

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
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? t("systemConfig.loading") : t("providerBilling.confirmSwitch")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
