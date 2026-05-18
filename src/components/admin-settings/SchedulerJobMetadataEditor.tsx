import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { inputClass, labelClass } from "./shared";
import { numMeta, strMeta } from "./configFieldHelpers";

type FieldDef =
  | { kind: "number"; key: string; labelKey: string; min?: number; hintKey?: string }
  | { kind: "text"; key: string; labelKey: string; hintKey?: string; placeholder?: string };

const JOB_FIELDS: Record<string, FieldDef[]> = {
  REFUND_RECONCILE: [
    { kind: "number", key: "batchSize", labelKey: "batchSize", min: 1 },
    { kind: "number", key: "escalationAfterDays", labelKey: "escalationAfterDays", min: 1 },
  ],
  PAYMENT_TIMEOUT: [
    { kind: "number", key: "timeoutMinutes", labelKey: "timeoutMinutes", min: 1 },
    { kind: "number", key: "maxRowsPerRun", labelKey: "maxRowsPerRun", min: 1 },
    {
      kind: "text",
      key: "eligibleStatuses",
      labelKey: "eligibleStatuses",
      placeholder: "PAYMENT_PENDING, SCHEDULE_PROPOSED",
    },
  ],
  PROVIDER_ACCEPT_TIMEOUT: [
    { kind: "number", key: "expiryAfterMinutes", labelKey: "expiryAfterMinutes", min: 1 },
    { kind: "number", key: "maxRowsPerRun", labelKey: "maxRowsPerRun", min: 1 },
    { kind: "text", key: "eligibleStatuses", labelKey: "eligibleStatuses", placeholder: "REQUESTED" },
  ],
  PROVIDER_ACCEPT_REMINDER: [
    { kind: "number", key: "reminderBeforeMinutes", labelKey: "reminderBeforeMinutes", min: 1 },
    { kind: "number", key: "expiryAfterMinutes", labelKey: "expiryAfterMinutes", min: 1 },
    { kind: "number", key: "maxRowsPerRun", labelKey: "maxRowsPerRun", min: 1 },
    { kind: "text", key: "eligibleStatuses", labelKey: "eligibleStatuses", placeholder: "REQUESTED" },
  ],
  PATIENT_PAYMENT_REMINDER: [
    { kind: "number", key: "reminderBeforeMinutes", labelKey: "reminderBeforeMinutes", min: 1 },
    { kind: "number", key: "timeoutMinutes", labelKey: "timeoutMinutes", min: 1 },
    { kind: "number", key: "maxRowsPerRun", labelKey: "maxRowsPerRun", min: 1 },
  ],
  MEDICINE_REMINDER: [
    { kind: "number", key: "lookaheadMinutes", labelKey: "lookaheadMinutes", min: 1 },
    { kind: "number", key: "maxRowsPerRun", labelKey: "maxRowsPerRun", min: 1 },
  ],
};

function parseMetadataJson(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function metadataToFormState(jobKey: string, meta: Record<string, unknown>): Record<string, string> {
  const fields = JOB_FIELDS[jobKey] ?? [];
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (f.key === "eligibleStatuses" && Array.isArray(meta.eligibleStatuses)) {
      out[f.key] = (meta.eligibleStatuses as string[]).join(", ");
    } else if (f.kind === "number") {
      out[f.key] = String(numMeta(meta, f.key, 0));
    } else {
      out[f.key] = strMeta(meta, f.key);
    }
  }
  return out;
}

function formStateToMetadata(jobKey: string, form: Record<string, string>): Record<string, unknown> {
  const fields = JOB_FIELDS[jobKey] ?? [];
  const meta: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = form[f.key]?.trim() ?? "";
    if (!raw) continue;
    if (f.key === "eligibleStatuses") {
      meta[f.key] = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (f.kind === "number") {
      meta[f.key] = parseInt(raw, 10);
    } else {
      meta[f.key] = raw;
    }
  }
  return meta;
}

export function SchedulerJobMetadataEditor({
  jobKey,
  metadataJson,
  onMetadataJsonChange,
}: {
  jobKey: string;
  metadataJson: string;
  onMetadataJsonChange: (json: string) => void;
}) {
  const { t } = useTranslation();
  const fields = JOB_FIELDS[jobKey];
  const [advanced, setAdvanced] = useState(false);

  const parsed = useMemo(() => parseMetadataJson(metadataJson), [metadataJson]);
  const [form, setForm] = useState<Record<string, string>>(() =>
    parsed ? metadataToFormState(jobKey, parsed) : {},
  );

  useEffect(() => {
    const p = parseMetadataJson(metadataJson);
    if (p) setForm(metadataToFormState(jobKey, p));
  }, [jobKey, metadataJson]);

  if (!fields?.length) {
    return (
      <label className="block">
        <span className={labelClass}>{t("systemConfig.scheduler.metadataJson")}</span>
        <textarea
          value={metadataJson}
          onChange={(e) => onMetadataJsonChange(e.target.value)}
          rows={8}
          spellCheck={false}
          className={`${inputClass} mt-1 font-mono text-xs`}
        />
      </label>
    );
  }

  const syncFormToJson = (nextForm: Record<string, string>) => {
    setForm(nextForm);
    onMetadataJsonChange(JSON.stringify(formStateToMetadata(jobKey, nextForm), null, 2));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={labelClass}>{t("systemConfig.scheduler.jobParameters")}</span>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          {advanced ? t("systemConfig.scheduler.simpleForm") : t("systemConfig.scheduler.advancedJson")}
        </button>
      </div>

      {advanced ? (
        <textarea
          value={metadataJson}
          onChange={(e) => onMetadataJsonChange(e.target.value)}
          rows={10}
          spellCheck={false}
          className={`${inputClass} font-mono text-xs`}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="block sm:col-span-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t(`systemConfig.scheduler.fields.${field.labelKey}`)}
              </span>
              <input
                type={field.kind === "number" ? "number" : "text"}
                min={field.kind === "number" ? field.min : undefined}
                value={form[field.key] ?? ""}
                placeholder={"placeholder" in field ? field.placeholder : undefined}
                onChange={(e) => syncFormToJson({ ...form, [field.key]: e.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {t(`systemConfig.scheduler.metadataHint.${jobKey}`, {
          defaultValue: t("systemConfig.scheduler.metadataHintDefault"),
        })}
      </p>
    </div>
  );
}
