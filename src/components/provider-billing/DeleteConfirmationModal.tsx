import { ConfirmModal } from "../ui/confirm-modal";
import { useTranslation } from "react-i18next";
import type { BillingRateTier } from "../../types/providerBilling";

export function DeleteConfirmationModal({
  isOpen,
  rate,
  submitting,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  rate: BillingRateTier | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("providerBilling.deleteTitle")}
      message={
        rate
          ? t("providerBilling.deleteMessage", {
              type: t(`providerBilling.types.${rate.type}`),
              amount: rate.amount,
            })
          : ""
      }
      confirmLabel={t("common.actions.delete")}
      confirmVariant="danger"
      cancelLabel={t("common.actions.cancel")}
      closeOnConfirm={!submitting}
      onConfirm={onConfirm}
    />
  );
}
