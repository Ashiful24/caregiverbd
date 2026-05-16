import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Clock,
  CreditCard,
  HeartPulse,
  Pencil,
  Play,
  RefreshCw,
  Timer,
} from "lucide-react";
import Badge from "../ui/badge/Badge";
import { Modal } from "../ui/modal";
import {
  adminCancellationApi,
  adminSchedulerApi,
  type RefundReconcileResult,
  type SchedulerJobItem,
} from "../../services/api";
import { formatDateTime } from "../../utils/format";
import { formatIntervalMinutes, numMeta } from "./configFieldHelpers";
import { SchedulerJobMetadataEditor } from "./SchedulerJobMetadataEditor";
import {
  SettingsAlert,
  SettingsToolbar,
  StatChip,
  PanelLoading,
  PanelEmpty,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
} from "./shared";

type JobFormState = {
  runEveryMinutes: string;
  isEnabled: boolean;
  description: string;
  metadataJson: string;
};

const JOB_ICONS: Record<string, typeof Clock> = {
  REFUND_RECONCILE: CreditCard,
  PAYMENT_TIMEOUT: Timer,
  PROVIDER_ACCEPT_TIMEOUT: Clock,
  PROVIDER_ACCEPT_REMINDER: Clock,
  PATIENT_PAYMENT_REMINDER: CreditCard,
  MEDICINE_REMINDER: HeartPulse,
};

function defaultMetadataForJob(jobKey: string): Record<string, unknown> {
  switch (jobKey) {
    case "REFUND_RECONCILE":
      return { batchSize: 50, escalationAfterDays: 7 };
    case "PAYMENT_TIMEOUT":
      return {
        timeoutMinutes: 30,
        maxRowsPerRun: 200,
        eligibleStatuses: ["PAYMENT_PENDING", "SCHEDULE_PROPOSED"],
      };
    case "PROVIDER_ACCEPT_TIMEOUT":
      return { expiryAfterMinutes: 60, maxRowsPerRun: 200, eligibleStatuses: ["REQUESTED"] };
    case "PROVIDER_ACCEPT_REMINDER":
      return {
        reminderBeforeMinutes: 15,
        expiryAfterMinutes: 60,
        maxRowsPerRun: 200,
        eligibleStatuses: ["REQUESTED"],
      };
    case "PATIENT_PAYMENT_REMINDER":
      return { reminderBeforeMinutes: 10, timeoutMinutes: 30, maxRowsPerRun: 200 };
    case "MEDICINE_REMINDER":
      return { lookaheadMinutes: 60, maxRowsPerRun: 200 };
    default:
      return {};
  }
}

function jobFormFromItem(job: SchedulerJobItem): JobFormState {
  const meta = job.metadata ?? defaultMetadataForJob(job.jobKey);
  return {
    runEveryMinutes: String(job.runEveryMinutes),
    isEnabled: job.isEnabled,
    description: job.description ?? "",
    metadataJson: JSON.stringify(meta, null, 2),
  };
}

function metadataSummary(job: SchedulerJobItem, t: TFunction): string[] {
  const m = job.metadata ?? {};
  switch (job.jobKey) {
    case "REFUND_RECONCILE":
      return [
        `${t("systemConfig.scheduler.fields.batchSize")}: ${numMeta(m, "batchSize", 50)}`,
        `${t("systemConfig.scheduler.fields.escalationAfterDays")}: ${numMeta(m, "escalationAfterDays", 7)}d`,
      ];
    case "PAYMENT_TIMEOUT":
      return [
        `${t("systemConfig.scheduler.fields.timeoutMinutes")}: ${numMeta(m, "timeoutMinutes", 30)}`,
        `${t("systemConfig.scheduler.fields.maxRowsPerRun")}: ${numMeta(m, "maxRowsPerRun", 200)}`,
      ];
    default:
      return Object.entries(m)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
}

export function SchedulerJobsPanel() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<SchedulerJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<SchedulerJobItem | null>(null);
  const [form, setForm] = useState<JobFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<RefundReconcileResult | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminSchedulerApi.listJobs();
      const data = res?.data ?? res;
      const list = Array.isArray(data) ? data : [];
      setJobs(list.sort((a, b) => a.jobKey.localeCompare(b.jobKey)));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("systemConfig.scheduler.failedLoad");
      setError(msg);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const stats = useMemo(() => {
    const enabled = jobs.filter((j) => j.isEnabled).length;
    return { total: jobs.length, enabled, paused: jobs.length - enabled };
  }, [jobs]);

  const openEdit = (job: SchedulerJobItem) => {
    setEditing(job);
    setForm(jobFormFromItem(job));
    setSuccess("");
  };

  const handleSave = async () => {
    if (!editing || !form) return;
    const minutes = parseInt(form.runEveryMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1) {
      setError(t("systemConfig.scheduler.invalidInterval"));
      return;
    }
    let metadata: Record<string, unknown>;
    try {
      metadata = JSON.parse(form.metadataJson) as Record<string, unknown>;
    } catch {
      setError(t("systemConfig.scheduler.invalidMetadata"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await adminSchedulerApi.updateJob(editing.id, {
        runEveryMinutes: minutes,
        isEnabled: form.isEnabled,
        description: form.description.trim() || undefined,
        metadata,
      });
      setEditing(null);
      setForm(null);
      setSuccess(t("systemConfig.scheduler.saveSuccess"));
      await fetchJobs();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("systemConfig.scheduler.failedUpdate");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const runRefundReconcile = async () => {
    setReconciling(true);
    setError("");
    try {
      const res = await adminCancellationApi.reconcileRefunds();
      const data = (res as { data?: RefundReconcileResult }).data ?? res;
      setReconcileResult(data as RefundReconcileResult);
      setSuccess(t("systemConfig.scheduler.reconcileDone"));
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("systemConfig.scheduler.reconcileFailed");
      setError(msg);
    } finally {
      setReconciling(false);
    }
  };

  return (
    <>
      <SettingsAlert
        variant="info"
        title={t("systemConfig.scheduler.noticeTitle")}
        message={t("systemConfig.scheduler.noticeMessage")}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatChip label={t("systemConfig.scheduler.statsTotal")} value={stats.total} />
        <StatChip
          label={t("systemConfig.scheduler.statsEnabled")}
          value={stats.enabled}
          tone="positive"
        />
        <StatChip
          label={t("systemConfig.scheduler.statsPaused")}
          value={stats.paused}
          tone={stats.paused > 0 ? "warning" : "neutral"}
        />
      </div>

      <SettingsToolbar>
        <button
          type="button"
          onClick={() => void runRefundReconcile()}
          disabled={reconciling}
          className={btnPrimary()}
        >
          <Play className="h-4 w-4" />
          {reconciling
            ? t("systemConfig.scheduler.reconciling")
            : t("systemConfig.scheduler.runRefundReconcile")}
        </button>
        <button type="button" onClick={() => void fetchJobs()} className={btnSecondary()}>
          <RefreshCw className="h-4 w-4" />
          {t("systemConfig.scheduler.refresh")}
        </button>
      </SettingsToolbar>

      {success ? (
        <SettingsAlert
          variant="success"
          title={t("systemConfig.savedTitle")}
          message={success}
          onDismiss={() => setSuccess("")}
        />
      ) : null}

      {error ? (
        <SettingsAlert
          variant="error"
          title={t("systemConfig.errorTitle")}
          message={error}
          onDismiss={() => setError("")}
        />
      ) : null}

      {reconcileResult ? (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["scanned", reconcileResult.scanned],
              ["settled", reconcileResult.settled],
              ["failed", reconcileResult.failed],
              ["pending", reconcileResult.pending],
              ["escalated", reconcileResult.escalated],
            ] as const
          ).map(([key, val]) => (
            <StatChip
              key={key}
              label={t(`systemConfig.scheduler.reconcile.${key}`)}
              value={val}
              tone={key === "settled" ? "positive" : key === "failed" ? "warning" : "neutral"}
            />
          ))}
        </div>
      ) : null}

      {loading ? (
        <PanelLoading message={t("systemConfig.loading")} />
      ) : jobs.length === 0 ? (
        <PanelEmpty message={t("systemConfig.scheduler.noJobs")} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {jobs.map((job) => {
            const Icon = JOB_ICONS[job.jobKey] ?? Clock;
            const summary = metadataSummary(job, t);
            return (
              <article
                key={job.id}
                className={`relative overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md dark:bg-white/[0.02] ${
                  job.isEnabled
                    ? "border-gray-200 dark:border-gray-800"
                    : "border-dashed border-gray-300 opacity-90 dark:border-gray-700"
                }`}
              >
                <div
                  className={`absolute inset-y-0 left-0 w-1 ${
                    job.isEnabled ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  aria-hidden
                />
                <div className="p-5 pl-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t(`systemConfig.scheduler.jobs.${job.jobKey}`, {
                            defaultValue: job.jobKey,
                          })}
                        </h3>
                        <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                          {job.jobKey}
                        </p>
                      </div>
                    </div>
                    <Badge color={job.isEnabled ? "success" : "light"} size="sm">
                      {job.isEnabled
                        ? t("systemConfig.scheduler.enabled")
                        : t("systemConfig.scheduler.disabled")}
                    </Badge>
                  </div>

                  {job.description ? (
                    <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {job.description}
                    </p>
                  ) : null}

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">
                        {t("systemConfig.scheduler.runEvery")}
                      </dt>
                      <dd className="mt-0.5 font-medium text-gray-900 dark:text-white">
                        {formatIntervalMinutes(job.runEveryMinutes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">
                        {t("systemConfig.scheduler.nextRun")}
                      </dt>
                      <dd className="mt-0.5 text-gray-800 dark:text-gray-200">
                        {job.nextRunAt ? formatDateTime(job.nextRunAt) : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">
                        {t("systemConfig.scheduler.lastRun")}
                      </dt>
                      <dd className="mt-0.5 text-gray-800 dark:text-gray-200">
                        {job.lastRunAt ? formatDateTime(job.lastRunAt) : "—"}
                      </dd>
                    </div>
                  </dl>

                  {summary.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {summary.map((line) => (
                        <li
                          key={line}
                          className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <button type="button" onClick={() => openEdit(job)} className={btnGhost()}>
                      <Pencil className="h-4 w-4" />
                      {t("common.actions.edit")}
                    </button>
                    {job.jobKey === "REFUND_RECONCILE" ? (
                      <button
                        type="button"
                        disabled={reconciling}
                        onClick={() => void runRefundReconcile()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-200"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {t("systemConfig.scheduler.runNow")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && form ? (
        <Modal
          isOpen
          onClose={() => !submitting && setEditing(null)}
          title={t("systemConfig.scheduler.editTitle", {
            job: t(`systemConfig.scheduler.jobs.${editing.jobKey}`, {
              defaultValue: editing.jobKey,
            }),
          })}
        >
          <div className="space-y-5">
            <SettingsAlert
              variant="info"
              title={t("systemConfig.scheduler.noticeTitle")}
              message={t("systemConfig.scheduler.editHint")}
            />

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t("systemConfig.scheduler.jobEnabled")}
              </span>
            </label>

            <label className="block">
              <span className={labelClass}>{t("systemConfig.scheduler.runEveryMinutes")}</span>
              <input
                type="number"
                min={1}
                value={form.runEveryMinutes}
                onChange={(e) => setForm({ ...form, runEveryMinutes: e.target.value })}
                className={`${inputClass} mt-1 max-w-[12rem]`}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("systemConfig.scheduler.intervalHint")}
              </p>
            </label>

            <label className="block">
              <span className={labelClass}>{t("systemConfig.description")}</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className={`${inputClass} mt-1`}
              />
            </label>

            <SchedulerJobMetadataEditor
              jobKey={editing.jobKey}
              metadataJson={form.metadataJson}
              onMetadataJsonChange={(json) => setForm({ ...form, metadataJson: json })}
            />

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => !submitting && setEditing(null)}
                className={btnSecondary()}
              >
                {t("common.actions.cancel")}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSave()}
                className={btnPrimary()}
              >
                {submitting ? t("supervisor.saving") : t("common.actions.save")}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
