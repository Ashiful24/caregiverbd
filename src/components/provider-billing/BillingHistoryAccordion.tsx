import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { formatDate } from "../../utils/format";
import type { BillingRateTier } from "../../types/providerBilling";

export function BillingHistoryAccordion({
  history,
  loading,
}: {
  history: BillingRateTier[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 dark:text-white/90"
      >
        <span>
          {t("providerBilling.historyTitle")}
          {!loading && history.length > 0 ? ` (${history.length})` : ""}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("systemConfig.loading")}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("providerBilling.emptyHistory")}</p>
          ) : (
            <div className="max-h-56 overflow-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="py-2 pr-3">{t("providerBilling.colType")}</th>
                    <th className="py-2 pr-3">{t("providerBilling.colAmount")}</th>
                    <th className="py-2 pr-3">{t("providerBilling.colValidFrom")}</th>
                    <th className="py-2">{t("providerBilling.colValidTo")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((rate) => (
                    <tr key={rate.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3">{t(`providerBilling.types.${rate.type}`)}</td>
                      <td className="py-2 pr-3 font-medium">৳{rate.amount}</td>
                      <td className="py-2 pr-3">{formatDate(rate.validFrom)}</td>
                      <td className="py-2">{rate.validTo ? formatDate(rate.validTo) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
