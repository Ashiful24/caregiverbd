import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import Label from "../form/Label";
import type { SupervisorFullDetails } from "../../data/supervisorSeed";
import {
  authApi,
  adminUsersApi,
  userApi,
  normalizeUserByIdResponse,
  type RegisterSupervisorResponse,
} from "../../services/api";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

const emptyForm = (): FormState => ({
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
});

function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const t = name.trim();
  if (!t) return { firstName: "", lastName: "" };
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t, lastName: "" };
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() };
}

function supervisorToForm(s: SupervisorFullDetails): FormState {
  const { firstName: f0, lastName: l0 } = splitDisplayName(s.name);
  return {
    firstName: (s.firstName ?? f0).trim(),
    lastName: (s.lastName ?? l0).trim(),
    email: s.email,
    username: s.username ?? "",
    password: "",
    confirmPassword: "",
  };
}

function extractRegisteredUser(data: unknown): RegisterSupervisorResponse | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.user && typeof d.user === "object") {
    return d.user as RegisterSupervisorResponse;
  }
  return data as RegisterSupervisorResponse;
}

function supervisorFromRegister(
  raw: RegisterSupervisorResponse,
  fallbackId: string
): SupervisorFullDetails {
  const id = raw.id != null ? String(raw.id) : fallbackId;
  const first = raw.firstName?.trim() ?? "";
  const last = raw.lastName?.trim() ?? "";
  return {
    id,
    userId: typeof raw.id === "number" ? raw.id : undefined,
    username: raw.username,
    firstName: first,
    lastName: last,
    name: [first, last].filter(Boolean).join(" ") || raw.email || "Supervisor",
    email: raw.email ?? "",
    phone: "—",
    region: "—",
    status: "ACTIVE",
    joinedAt: new Date().toISOString().slice(0, 10),
    teamSize: 0,
    dateOfBirth: "",
    gender: "",
    designation: "Supervisor",
    department: "",
    yearsOfExperience: 0,
    addressLine: "",
    city: "",
    areaLocation: "",
    nationalId: "",
    emergencyContact: "",
    notes: "",
  };
}

function mergeLocalEdit(
  form: FormState,
  base: SupervisorFullDetails,
  /** When true, keep existing username (edit flow does not change username). */
  preserveUsername: boolean
): SupervisorFullDetails {
  const first = form.firstName.trim();
  const last = form.lastName.trim();
  return {
    ...base,
    firstName: first,
    lastName: last,
    name: [first, last].filter(Boolean).join(" ") || base.name,
    email: form.email.trim(),
    username: preserveUsername ? (base.username ?? "").trim() : form.username.trim(),
  };
}

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  editSupervisor: SupervisorFullDetails | null;
  onCreated: (record: SupervisorFullDetails) => void;
  onUpdated: (record: SupervisorFullDetails) => void;
};

export function SupervisorCreateModal({
  isOpen,
  onClose,
  mode,
  editSupervisor,
  onCreated,
  onUpdated,
}: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);

    if (mode === "create") {
      setForm(emptyForm());
      setPrefillLoading(false);
      setPrefillNotice(null);
      return;
    }

    if (mode === "edit" && editSupervisor) {
      if (editSupervisor.userId == null) {
        setForm(supervisorToForm(editSupervisor));
        setPrefillLoading(false);
        setPrefillNotice(null);
        return;
      }

      let cancelled = false;
      setPrefillLoading(true);
      setPrefillNotice(null);
      setForm(supervisorToForm(editSupervisor));

      userApi
        .getProfile(String(editSupervisor.userId))
        .then((res) => {
          if (cancelled) return;
          const u = normalizeUserByIdResponse(res.data);
          if (!u) {
            setPrefillNotice(t("supervisor.prefillParseFailed"));
            return;
          }
          setForm({
            firstName: u.firstName?.trim() ?? u.first_name?.trim() ?? "",
            lastName: u.lastName?.trim() ?? u.last_name?.trim() ?? "",
            email: u.email?.trim() ?? "",
            username: u.username?.trim() ?? "",
            password: "",
            confirmPassword: "",
          });
        })
        .catch(() => {
          if (cancelled) return;
          setPrefillNotice(t("supervisor.prefillLoadFailed"));
        })
        .finally(() => {
          if (!cancelled) setPrefillLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, mode, editSupervisor?.id, editSupervisor?.userId, t]);

  const patch = useCallback((partial: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
    setError(null);
  }, []);

  const handleClose = () => {
    setForm(emptyForm());
    setError(null);
    setSubmitting(false);
    setPrefillLoading(false);
    setPrefillNotice(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const editing = mode === "edit" && editSupervisor;
    const pwd = form.password;
    const pwd2 = form.confirmPassword;
    const wantsPassword = Boolean(pwd || pwd2);
    if (wantsPassword && pwd !== pwd2) {
      setError(t("supervisor.passwordMismatch"));
      return;
    }
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();
    const username = form.username.trim();
    if (!firstName || !lastName || !email) {
      setError(t("supervisor.requiredFields"));
      return;
    }
    if (!editing && !username) {
      setError(t("supervisor.usernameRequiredNew"));
      return;
    }
    if (!editing && !pwd) {
      setError(t("supervisor.passwordRequiredNew"));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      if (!editing) {
        const res = await authApi.registerSupervisor({
          email,
          username,
          password: pwd,
          firstName,
          lastName,
          role: "SUPERVISOR",
        });
        const userPayload = extractRegisteredUser(res.data) ?? (res.data as RegisterSupervisorResponse);
        const record = supervisorFromRegister(userPayload, `sup-${Date.now()}`);
        onCreated(record);
        handleClose();
        return;
      }

      if (editSupervisor.userId != null) {
        const uid = String(editSupervisor.userId);
        await userApi.updateProfile(uid, {
          firstName,
          lastName,
          email,
        });
        if (pwd) {
          await adminUsersApi.updatePassword(uid, { newPassword: pwd });
        }
        onUpdated(
          mergeLocalEdit(
            form,
            {
              ...editSupervisor,
              userId: editSupervisor.userId,
            },
            true
          )
        );
      } else {
        onUpdated(mergeLocalEdit(form, editSupervisor, true));
      }
      handleClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("supervisor.requestFailed");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isEdit = mode === "edit";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton
      className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-hidden p-0 sm:p-0"
    >
      <div className="flex max-h-[min(90vh,720px)] flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6 dark:border-gray-800">
          <h3 className="pr-10 text-xl font-semibold text-gray-900 dark:text-white/90">
            {isEdit ? t("supervisor.editModalTitle") : t("supervisor.createModalTitle")}
          </h3>
          {/* <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isEdit
              ? "Prefilled from GET /users/:id when available. Update fields and optionally password."
              : "Registers via POST /users/register with role SUPERVISOR."}
          </p> */}
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
            {prefillLoading ? (
              <p className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
                {t("supervisor.prefillLoading")}
              </p>
            ) : null}
            {prefillNotice ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                {prefillNotice}
              </p>
            ) : null}
            <div className="grid gap-4">
              <div>
                <Label htmlFor="sup-firstName">{t("supervisor.firstName")}</Label>
                <input
                  id="sup-firstName"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => patch({ firstName: e.target.value })}
                  className={inputClass}
                  placeholder={t("supervisor.firstNamePlaceholder")}
                  autoComplete="given-name"
                  required
                  disabled={isEdit && prefillLoading}
                />
              </div>
              <div>
                <Label htmlFor="sup-lastName">{t("supervisor.lastName")}</Label>
                <input
                  id="sup-lastName"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => patch({ lastName: e.target.value })}
                  className={inputClass}
                  placeholder={t("supervisor.lastNamePlaceholder")}
                  autoComplete="family-name"
                  required
                  disabled={isEdit && prefillLoading}
                />
              </div>
              <div>
                <Label htmlFor="sup-email">{t("supervisor.email")}</Label>
                <input
                  id="sup-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  className={inputClass}
                  placeholder={t("supervisor.emailPlaceholder")}
                  autoComplete="email"
                  required
                  disabled={isEdit && prefillLoading}
                />
              </div>
              {!isEdit ? (
                <div>
                  <Label htmlFor="sup-username">{t("supervisor.username")}</Label>
                  <input
                    id="sup-username"
                    type="text"
                    value={form.username}
                    onChange={(e) => patch({ username: e.target.value })}
                    className={inputClass}
                    placeholder={t("supervisor.usernamePlaceholder")}
                    autoComplete="username"
                    required
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="sup-password">{t("supervisor.password")}</Label>
                <input
                  id="sup-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => patch({ password: e.target.value })}
                  className={inputClass}
                  placeholder={isEdit ? t("supervisor.keepCurrentPassword") : "••••••••"}
                  autoComplete={isEdit ? "new-password" : "new-password"}
                />
              </div>
              <div>
                <Label htmlFor="sup-confirm">{t("supervisor.confirmPassword")}</Label>
                <input
                  id="sup-confirm"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => patch({ confirmPassword: e.target.value })}
                  className={inputClass}
                  placeholder={isEdit ? t("supervisor.keepCurrentPassword") : "••••••••"}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || (isEdit && prefillLoading)}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting
                  ? t("supervisor.saving")
                  : isEdit
                  ? t("common.actions.saveChanges")
                  : t("supervisor.createSupervisor")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}
