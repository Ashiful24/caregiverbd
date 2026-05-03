import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import type { SupervisorFullDetails } from "../../data/supervisorSeed";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-gray-100 pb-4 last:border-0 dark:border-gray-800">
      <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white/90">{title}</h4>
      <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:col-span-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">{value || "—"}</dd>
    </div>
  );
}

export interface SupervisorViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  supervisor: SupervisorFullDetails | null;
  /** True while GET /users/:id is in flight (view opened with userId). */
  profileLoading?: boolean;
}

export function SupervisorViewModal({
  isOpen,
  onClose,
  supervisor,
  profileLoading = false,
}: SupervisorViewModalProps) {
  const { t } = useTranslation();
  if (!supervisor) return null;

  const genderLabel =
    {
      female: t("supervisor.genderFemale"),
      male: t("supervisor.genderMale"),
      other: t("supervisor.genderOther"),
      prefer_not_to_say: t("supervisor.genderPreferNotToSay"),
    }[supervisor.gender] ?? supervisor.gender;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton
      className="max-h-[min(90vh,880px)] w-full max-w-3xl overflow-hidden p-0 sm:p-0"
    >
      <div className="flex max-h-[min(90vh,880px)] flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6 dark:border-gray-800">
          <h3 className="pr-10 text-xl font-semibold text-gray-900 dark:text-white/90">{t("supervisor.detailsTitle")}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{supervisor.name}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-4">
          {profileLoading ? (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
              {t("supervisor.loadingProfile")}
            </p>
          ) : null}
          <Section title={t("supervisor.basicInfo")}>
            {supervisor.userId != null ? (
              <Item label={t("supervisor.userId")} value={String(supervisor.userId)} />
            ) : null}
            {supervisor.username ? <Item label={t("supervisor.username")} value={supervisor.username} /> : null}
            <Item label={t("supervisor.fullName")} value={supervisor.name} />
            <Item label={t("supervisor.email")} value={supervisor.email} />
            <Item label={t("supervisor.phone")} value={supervisor.phone} />
            <Item
              label={t("supervisor.dateOfBirth")}
              value={
                supervisor.dateOfBirth
                  ? format(parseISO(supervisor.dateOfBirth), "d MMM yyyy")
                  : ""
              }
            />
            <Item label={t("supervisor.gender")} value={genderLabel} />
          </Section>

          <Section title={t("supervisor.professionalInfo")}>
            <Item label={t("supervisor.designation")} value={supervisor.designation} />
            <Item label={t("supervisor.department")} value={supervisor.department} />
            <Item label={t("supervisor.yearsOfExperience")} value={String(supervisor.yearsOfExperience)} />
            <Item
              label={t("supervisor.joiningDate")}
              value={supervisor.joinedAt ? format(parseISO(supervisor.joinedAt), "d MMM yyyy") : ""}
            />
            <Item label={t("supervisor.regionCoverage")} value={supervisor.region} />
            <Item label={t("supervisor.teamSize")} value={String(supervisor.teamSize)} />
          </Section>

          <Section title={t("supervisor.accountInfo")}>
            <Item label={t("dashboard.status")} value={supervisor.status} />
            <Item label={t("supervisor.password")} value={t("supervisor.hiddenPassword")} />
          </Section>

          <Section title={t("supervisor.addressInfo")}>
            <Item label={t("supervisor.addressLine")} value={supervisor.addressLine} />
            <div className="sm:col-span-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t("supervisor.city")}</dt>
              <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">{supervisor.city || "—"}</dd>
            </div>
            <Item label={t("supervisor.areaLocation")} value={supervisor.areaLocation} />
          </Section>

          <Section title={t("supervisor.optional")}>
            <Item label={t("supervisor.nationalId")} value={supervisor.nationalId} />
            <Item label={t("supervisor.emergencyContact")} value={supervisor.emergencyContact} />
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("supervisor.notesRemarks")}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                {supervisor.notes || "—"}
              </dd>
            </div>
          </Section>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {t("common.actions.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
