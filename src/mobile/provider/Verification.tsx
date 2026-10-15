/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { Award, Check, FileText, Lock, Paperclip, Send, Trash2, Upload } from "lucide-react";
import { providerApi } from "../api";
import { fmtDate, fmtDateTime } from "../format";
import { useApi } from "../hooks";
import { Badge, Button, Card, Field, Input, Loading, Notice, Screen, Section, Select, StatusBadge, useToast } from "../ui";
import { fileToDataUrl } from "../files";

type StagedCert = { code: string; name: string; number: string; file: File };

const STATUS_HINT: Record<string, string> = {
  PENDING: "Under review",
  APPROVED: "Verified by admin",
  REJECTED: "Rejected, choose a new file",
};

function usePreview(file: File | null | undefined) {
  const url = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

function Thumb({ file, saved }: { file?: File | null; saved?: any }) {
  const preview = usePreview(file);
  const savedImage = !file && saved && (saved.mimeType?.startsWith("image/") || String(saved.filePath ?? saved.documentUrl ?? "").startsWith("data:image/"));
  const src = preview ?? (savedImage ? saved.filePath ?? saved.documentUrl : null);
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <FileText size={20} />}
    </div>
  );
}

/** Hidden file input + button; resets its value so the same file can be picked again. */
function FilePicker({ label, onPick, variant = "secondary" }: { label: string; onPick: (f: File) => void; variant?: "primary" | "secondary" | "ghost" }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
      <Button size="sm" variant={variant} onClick={() => ref.current?.click()}>
        <Paperclip size={14} /> {label}
      </Button>
    </>
  );
}

function ItemStatus({ staged, saved }: { staged: boolean; saved?: any }) {
  if (staged) return <Badge tone="blue">Ready to submit</Badge>;
  if (saved) return <StatusBadge status={saved.status} label={saved.status === "PENDING" ? "In review" : undefined} />;
  return <Badge tone="gray">Not added</Badge>;
}

type Step = { label: string; detail: string; state: "done" | "current" | "todo" | "warn" };

function Steps({ steps }: { steps: Step[] }) {
  const dot: Record<Step["state"], string> = {
    done: "bg-brand-500 text-white",
    current: "bg-blue-500 text-white",
    warn: "bg-red-500 text-white",
    todo: "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <Card className="mb-5">
      <ol className="grid gap-3">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", dot[s.state])}>
              {s.state === "done" ? <Check size={14} /> : s.state === "warn" ? "!" : i + 1}
            </span>
            <div className="min-w-0">
              <p className={clsx("text-sm font-semibold", s.state === "todo" ? "text-gray-400" : "text-gray-900 dark:text-white")}>{s.label}</p>
              <p className={clsx("text-xs", s.state === "warn" ? "text-red-500" : "text-gray-500")}>{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function Verification() {
  const navigate = useNavigate();
  const toast = useToast();
  const me = useApi(() => providerApi.get("/providers/me"), []);
  const docs = useApi(() => providerApi.get("/verification-documents"), []);
  const certs = useApi(() => providerApi.get("/providers/me/certifications"), []);
  const [stagedDocs, setStagedDocs] = useState<Record<number, File>>({});
  const [stagedCerts, setStagedCerts] = useState<StagedCert[]>([]);
  const [certForm, setCertForm] = useState<{ code: string; number: string; file: File | null }>({ code: "", number: "", file: null });
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (!me.data || !docs.data || !certs.data) return <Screen title="Verification" back="/app/provider/profile"><Loading /></Screen>;

  const p = me.data;
  const v = p.verification;
  const pending = p.status === "PENDING";
  const submittedBefore = Boolean(v.submittedForReviewAt);
  // Before the first submit everything is editable; afterwards only rejected items can be replaced.
  const editable = (saved?: any) => pending && !v.underReview && saved?.status !== "APPROVED" && (!submittedBefore || !saved || saved.status === "REJECTED");

  const requirements: any[] = docs.data.requirements;
  const certTypes: any[] = certs.data.types;
  const savedCerts: any[] = certs.data.certifications;
  const savedCertOf = (code: string) => savedCerts.find((c) => c.certificationTypeCode === code);
  const ok = (x?: any) => Boolean(x) && x.status !== "REJECTED";

  const docReady = (r: any) => Boolean(stagedDocs[r.id]) || ok(r.uploadedDocument);
  const certReady = (t: any) => stagedCerts.some((c) => c.code === t.code) || ok(savedCertOf(t.code));
  const reqDocs = requirements.filter((r) => r.isRequired);
  const reqCerts = certTypes.filter((t) => t.isRequired);
  const docsReady = reqDocs.filter(docReady).length;
  const certsReady = reqCerts.filter(certReady).length;
  const allReady = docsReady === reqDocs.length && certsReady === reqCerts.length;
  const stagedCount = Object.keys(stagedDocs).length + stagedCerts.length;
  const rejected = [...requirements.map((r) => r.uploadedDocument), ...savedCerts].filter((x) => x?.status === "REJECTED");
  // Rejected items that have not been given a new file yet.
  const unresolved = [
    ...requirements.filter((r) => r.uploadedDocument?.status === "REJECTED" && !stagedDocs[r.id]),
    ...savedCerts.filter((c) => c.status === "REJECTED" && !stagedCerts.some((s) => s.code === c.certificationTypeCode)),
  ];
  const canSubmit = pending && !v.underReview && allReady && unresolved.length === 0 && (stagedCount > 0 || !submittedBefore);
  const addableCerts = certTypes.filter((t) => editable(savedCertOf(t.code)) && !stagedCerts.some((c) => c.code === t.code) && !ok(savedCertOf(t.code)));

  const steps: Step[] = [
    { label: "Add required documents", detail: `${docsReady} of ${reqDocs.length} ready`, state: !pending || docsReady === reqDocs.length ? "done" : "current" },
    {
      label: "Add certifications",
      detail: reqCerts.length ? `${certsReady} of ${reqCerts.length} required ready` : "None required for your service",
      state: !pending || certsReady === reqCerts.length ? "done" : docsReady === reqDocs.length ? "current" : "todo",
    },
    {
      label: "Submit & admin review",
      detail: !pending
        ? "Documents and certificates verified"
        : rejected.length
          ? `${rejected.length} item${rejected.length > 1 ? "s" : ""} rejected. Replace and submit again.`
          : v.underReview
            ? `Submitted ${fmtDateTime(v.submittedForReviewAt)} · ${v.requiredDocumentsApproved + v.requiredCertificationsApproved} of ${v.documentsRequired + v.certificationsRequired} approved`
            : "Submit everything with the button below",
      state: !pending ? "done" : rejected.length ? "warn" : v.underReview ? "current" : "todo",
    },
    {
      label: "Profile activated",
      detail: p.status === "ACTIVE" ? "You can go online and take jobs" : pending ? "Admin activates you after approving everything" : `Profile ${String(p.status).toLowerCase()}`,
      state: p.status === "ACTIVE" ? "done" : pending ? "todo" : "warn",
    },
  ];

  const addCert = (e: FormEvent) => {
    e.preventDefault();
    const t = certTypes.find((x) => x.code === certForm.code);
    if (!t || !certForm.number.trim()) return;
    if (!certForm.file) return toast("Attach a photo or PDF of the certificate", "err");
    setStagedCerts((xs) => [...xs, { code: t.code, name: t.name, number: certForm.number.trim(), file: certForm.file! }]);
    setCertForm({ code: "", number: "", file: null });
  };

  const submit = async () => {
    try {
      const docEntries = Object.entries(stagedDocs);
      let i = 0;
      const total = docEntries.length + stagedCerts.length;
      for (const [reqId, file] of docEntries) {
        setSubmitting(`Uploading ${++i} of ${total}…`);
        const { dataUrl, mimeType } = await fileToDataUrl(file);
        await providerApi.post("/verification-documents/upload", { verificationRequirementId: Number(reqId), fileName: file.name, fileUrl: dataUrl, mimeType });
        setStagedDocs((s) => {
          const next = { ...s };
          delete next[Number(reqId)];
          return next;
        });
      }
      for (const c of stagedCerts) {
        setSubmitting(`Uploading ${++i} of ${total}…`);
        const { dataUrl } = await fileToDataUrl(c.file);
        await providerApi.post("/providers/me/certifications", { certificationTypeCode: c.code, certificationNumber: c.number, documentUrl: dataUrl, fileName: c.file.name });
        setStagedCerts((xs) => xs.filter((x) => x.code !== c.code));
      }
      setSubmitting("Submitting…");
      await providerApi.post("/providers/me/submit-for-review");
      toast("Submitted! Caregiver BD will review your documents.");
      navigate("/app/provider", { state: { justSubmitted: true } });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not submit", "err");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Screen
      title="Verification"
      back="/app/provider/profile"
      footer={
        pending && !v.underReview ? (
          <div>
            <p className="mb-2 text-center text-xs text-gray-500">
              {allReady
                ? unresolved.length
                  ? "Replace the rejected items to continue"
                  : "Everything is ready. Admin reviews it after you submit."
                : `${docsReady + certsReady} of ${reqDocs.length + reqCerts.length} required items ready`}
            </p>
            <Button className="w-full" disabled={!canSubmit} busy={Boolean(submitting)} onClick={submit}>
              <Send size={16} /> {submitting ?? (submittedBefore ? "Resubmit for review" : "Submit for review")}
            </Button>
          </div>
        ) : undefined
      }
    >
      <Steps steps={steps} />

      {v.underReview && (
        <div className="mb-4">
          <Notice tone="blue">
            <span className="flex gap-2">
              <Lock size={16} className="mt-0.5 shrink-0" />
              Submitted for review. Files are locked while Caregiver BD checks them; you'll get a notification for each decision. Meanwhile you can explore the app.
            </span>
          </Notice>
        </div>
      )}
      {p.status === "ACTIVE" && (
        <div className="mb-4">
          <Notice tone="brand">Verified and active. Next: go online from Home. {p.category === "CAREGIVER" ? "Admin assigns long-term shifts; they appear under Shifts." : "Keep your schedule open so patients can book you."}</Notice>
        </div>
      )}

      <Section title={`Documents for ${docs.data.consultationTypeName ?? "your service"}`}>
        <div className="grid gap-2">
          {requirements.map((r) => {
            const saved = r.uploadedDocument;
            const staged = stagedDocs[r.id];
            const canChange = editable(saved);
            return (
              <Card key={r.id} className={clsx("p-3", saved?.status === "REJECTED" && !staged && "border-red-300 dark:border-red-900")}>
                <div className="flex items-start gap-3">
                  <Thumb file={staged} saved={saved} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {r.label} {r.isRequired ? <span className="text-red-500">*</span> : <span className="text-xs font-normal text-gray-400">(optional)</span>}
                      </p>
                      <ItemStatus staged={Boolean(staged)} saved={saved} />
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {staged ? staged.name : saved ? `${saved.fileName ?? "Uploaded"} · ${fmtDate(saved.createdAt)}` : "No file chosen"}
                    </p>
                    {!staged && saved && <p className="text-[11px] text-gray-400">{STATUS_HINT[saved.status] ?? ""}</p>}
                    {!staged && saved?.adminComment && <p className="mt-1 text-xs text-red-500">Admin: {saved.adminComment}</p>}
                    {canChange && (
                      <div className="mt-2 flex gap-2">
                        <FilePicker label={staged || saved ? "Change file" : "Choose file"} variant={staged || saved ? "secondary" : "primary"} onPick={(f) => setStagedDocs((s) => ({ ...s, [r.id]: f }))} />
                        {staged && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setStagedDocs((s) => {
                                const next = { ...s };
                                delete next[r.id];
                                return next;
                              })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {(certTypes.length > 0 || savedCerts.length > 0) && (
        <Section title="Certifications">
          <div className="mb-3 grid gap-2">
            {certTypes.map((t) => {
              const saved = savedCertOf(t.code);
              const staged = stagedCerts.find((c) => c.code === t.code);
              if (!saved && !staged && !t.isRequired) return null;
              return (
                <Card key={t.code} className={clsx("p-3", !saved && !staged && "border-dashed", saved?.status === "REJECTED" && !staged && "border-red-300 dark:border-red-900")}>
                  <div className="flex items-start gap-3">
                    {staged || saved ? <Thumb file={staged?.file} saved={saved} /> : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300 dark:bg-gray-800">
                        <Award size={20} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {t.name} {t.isRequired && <span className="text-red-500">*</span>}
                        </p>
                        <ItemStatus staged={Boolean(staged)} saved={saved} />
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {staged ? `${staged.number} · ${staged.file.name}` : saved ? `${saved.certificationNumber}${saved.fileName ? ` · ${saved.fileName}` : ""}` : "Add it with the form below"}
                      </p>
                      {!staged && saved && <p className="text-[11px] text-gray-400">{STATUS_HINT[saved.status] ?? ""}</p>}
                      {!staged && saved?.adminComment && <p className="mt-1 text-xs text-red-500">Admin: {saved.adminComment}</p>}
                      {staged && (
                        <Button size="sm" variant="ghost" className="mt-1" onClick={() => setStagedCerts((xs) => xs.filter((x) => x.code !== t.code))}>
                          <Trash2 size={14} /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {addableCerts.length > 0 && (
            <Card>
              <form onSubmit={addCert}>
                <Field label="Add a certification">
                  <Select value={certForm.code} onChange={(e) => setCertForm({ ...certForm, code: e.target.value })} required>
                    <option value="">Select type</option>
                    {addableCerts.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                        {t.isRequired ? " (required)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Certificate number">
                  <Input value={certForm.number} onChange={(e) => setCertForm({ ...certForm, number: e.target.value })} required />
                </Field>
                <div className="mb-3 flex items-center gap-2">
                  <FilePicker label={certForm.file ? "Change file" : "Attach certificate"} onPick={(f) => setCertForm({ ...certForm, file: f })} />
                  <span className="min-w-0 truncate text-xs text-gray-500">{certForm.file?.name ?? "Photo or PDF"}</span>
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  <Upload size={14} /> Add to submission
                </Button>
              </form>
            </Card>
          )}
        </Section>
      )}
    </Screen>
  );
}
