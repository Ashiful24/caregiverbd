import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import { formatDate } from "../../utils/format";
import type { BillingRateTier } from "../../types/providerBilling";

const thClass =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";
const tdClass = "px-3 py-3 text-sm text-gray-800 dark:text-white/90";

export function BillingRateTable({
  rates,
  onEdit,
  onDelete,
}: {
  rates: BillingRateTier[];
  onEdit: (rate: BillingRateTier) => void;
  onDelete: (rate: BillingRateTier) => void;
}) {
  const { t } = useTranslation();

  if (rates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {t("providerBilling.emptyRates")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Table>
        <TableHeader className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/40">
          <TableRow>
            <TableCell isHeader className={thClass}>
              {t("providerBilling.colType")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerBilling.colAmount")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerBilling.colValidFrom")}
            </TableCell>
            <TableCell isHeader className={`${thClass} text-right`}>
              {t("providerBilling.colActions")}
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rates.map((rate) => (
            <TableRow key={rate.id}>
              <TableCell className={tdClass}>{t(`providerBilling.types.${rate.type}`)}</TableCell>
              <TableCell className={`${tdClass} font-medium`}>৳{rate.amount}</TableCell>
              <TableCell className={tdClass}>{formatDate(rate.validFrom)}</TableCell>
              <TableCell className={`${tdClass} text-right`}>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(rate)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("common.actions.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(rate)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("common.actions.delete")}
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
