import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
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

function statusLabel(status: SupervisorFullDetails["status"]) {
  return status.replace(/_/g, " ");
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
  if (!supervisor) return null;

  const genderLabel =
    {
      female: "Female",
      male: "Male",
      other: "Other",
      prefer_not_to_say: "Prefer not to say",
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
          <h3 className="pr-10 text-xl font-semibold text-gray-900 dark:text-white/90">Supervisor details</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{supervisor.name}</p>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-4">
          {profileLoading ? (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
              Loading profile from GET /users/:id…
            </p>
          ) : null}
          <Section title="Basic information">
            {supervisor.userId != null ? (
              <Item label="User ID" value={String(supervisor.userId)} />
            ) : null}
            {supervisor.username ? <Item label="Username" value={supervisor.username} /> : null}
            <Item label="Full name" value={supervisor.name} />
            <Item label="Email" value={supervisor.email} />
            <Item label="Phone" value={supervisor.phone} />
            <Item
              label="Date of birth"
              value={
                supervisor.dateOfBirth
                  ? format(parseISO(supervisor.dateOfBirth), "d MMM yyyy")
                  : ""
              }
            />
            <Item label="Gender" value={genderLabel} />
          </Section>

          <Section title="Professional information">
            <Item label="Designation" value={supervisor.designation} />
            <Item label="Department" value={supervisor.department} />
            <Item label="Years of experience" value={String(supervisor.yearsOfExperience)} />
            <Item
              label="Joining date"
              value={supervisor.joinedAt ? format(parseISO(supervisor.joinedAt), "d MMM yyyy") : ""}
            />
            <Item label="Region (coverage)" value={supervisor.region} />
            <Item label="Team size" value={String(supervisor.teamSize)} />
          </Section>

          <Section title="Account information">
            <Item label="Status" value={statusLabel(supervisor.status)} />
            <Item label="Password" value="•••••••• (hidden)" />
          </Section>

          <Section title="Address information">
            <Item label="Address line" value={supervisor.addressLine} />
            <div className="sm:col-span-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">City</dt>
              <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">{supervisor.city || "—"}</dd>
            </div>
            <Item label="Area / location" value={supervisor.areaLocation} />
          </Section>

          <Section title="Optional">
            <Item label="National ID (NID)" value={supervisor.nationalId} />
            <Item label="Emergency contact" value={supervisor.emergencyContact} />
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Notes / remarks
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
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
