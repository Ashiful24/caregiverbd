/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type FormEvent } from "react";
import { Droplets, Footprints, HeartPulse, Plus, Syringe } from "lucide-react";
import { patientApi } from "../api";
import { fmtDate, today } from "../format";
import { useAction, useApi } from "../hooks";
import { Button, Card, ErrorBox, Field, Input, Loading, Screen, Section, Sheet, useToast } from "../ui";
import { MiniBars } from "../shared";

export default function Health() {
  const toast = useToast();
  const { busy, run } = useAction();
  const { data, error, loading, reload } = useApi(() => patientApi.get("/patient-vitals/me/range"), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ recordedAt: today(), bloodPressureSystolic: "", bloodPressureDiastolic: "", bloodSugar: "", steps: "", waterIntake: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => patientApi.post("/patient-vitals", form), (m) => toast(m, "err"));
    if (ok) {
      toast("Vitals saved");
      setOpen(false);
    }
  };

  const last = (h: any[]) => h[h.length - 1];
  const labels = (h: any[]) => h.slice(-7).map((x) => fmtDate(x.date, { day: "numeric" }));

  return (
    <Screen
      title="My health"
      subtitle="Last 30 days"
     
      right={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Record
        </Button>
      }
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Card>
              <HeartPulse size={18} className="text-red-500" />
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                {last(data.bloodPressure.history)?.systolic ?? "—"}/{last(data.bloodPressure.history)?.diastolic ?? "—"}
              </p>
              <p className="text-xs text-gray-500">Blood pressure · avg {data.bloodPressure.avg.systolic ?? "—"}/{data.bloodPressure.avg.diastolic ?? "—"}</p>
            </Card>
            <Card>
              <Syringe size={18} className="text-violet-500" />
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{last(data.bloodSugar.history)?.value ?? "—"}</p>
              <p className="text-xs text-gray-500">Sugar mmol/L · avg {data.bloodSugar.avg ?? "—"}</p>
            </Card>
            <Card>
              <Footprints size={18} className="text-brand-600" />
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{(last(data.steps.history)?.value ?? 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Steps · avg {Math.round(data.steps.avg ?? 0).toLocaleString()}</p>
            </Card>
            <Card>
              <Droplets size={18} className="text-blue-500" />
              <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{last(data.waterIntake.history)?.value ?? "—"} L</p>
              <p className="text-xs text-gray-500">Water · avg {data.waterIntake.avg ?? "—"} L</p>
            </Card>
          </div>
          <Section title="Systolic pressure (last 7 records)">
            <Card>
              <MiniBars values={data.bloodPressure.history.slice(-7).map((x: any) => x.systolic)} labels={labels(data.bloodPressure.history)} color="#ef4444" />
            </Card>
          </Section>
          <Section title="Blood sugar">
            <Card>
              <MiniBars values={data.bloodSugar.history.slice(-7).map((x: any) => x.value)} labels={labels(data.bloodSugar.history)} color="#8b5cf6" />
            </Card>
          </Section>
          <Section title="Steps">
            <Card>
              <MiniBars values={data.steps.history.slice(-7).map((x: any) => x.value)} labels={labels(data.steps.history)} />
            </Card>
          </Section>
        </>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Record vitals">
        <form onSubmit={save}>
          <Field label="Date" hint="Saving again for the same day updates that day">
            <Input type="date" max={today()} value={form.recordedAt} onChange={set("recordedAt")} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Systolic">
              <Input type="number" inputMode="numeric" value={form.bloodPressureSystolic} onChange={set("bloodPressureSystolic")} placeholder="120" />
            </Field>
            <Field label="Diastolic">
              <Input type="number" inputMode="numeric" value={form.bloodPressureDiastolic} onChange={set("bloodPressureDiastolic")} placeholder="80" />
            </Field>
            <Field label="Sugar (mmol/L)">
              <Input type="number" step="0.1" value={form.bloodSugar} onChange={set("bloodSugar")} placeholder="5.6" />
            </Field>
            <Field label="Steps">
              <Input type="number" value={form.steps} onChange={set("steps")} placeholder="4000" />
            </Field>
          </div>
          <Field label="Water (litres)">
            <Input type="number" step="0.25" value={form.waterIntake} onChange={set("waterIntake")} placeholder="2" />
          </Field>
          <Button type="submit" busy={busy} className="w-full">
            Save
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
