import { useTranslation } from "react-i18next";
import Badge from "../ui/badge/Badge";
import type { BillingMode } from "../../types/providerBilling";

const MODE_BADGE_COLOR: Record<BillingMode, "success" | "info" | "light"> = {
  CONSULTATION: "info",
  SHIFT_BASED: "success",
  NOT_CONFIGURED: "light",
};

export function BillingModeBadge({ mode }: { mode: BillingMode }) {
  const { t } = useTranslation();

  return (
    <Badge size="sm" color={MODE_BADGE_COLOR[mode]}>
      {t(`providerBilling.mode.${mode}`)}
    </Badge>
  );
}
