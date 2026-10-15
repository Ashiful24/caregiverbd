/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import { Ban, Plus, Trash2 } from "lucide-react";
import { getSession, providerApi } from "../api";
import { addDays, fmtDate, fmtTime, today } from "../format";
import { useAction, useApi } from "../hooks";
import { Button, Card, Chip, ErrorBox, Field, Input, Loading, Notice, Screen, Sheet, StatusBadge, useToast } from "../ui";

export default function Schedule() {
  const toast = useToast();
  const { busy, run } = useAction();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i));
  const [day, setDay] = useState(days[0]);
  const { data, error, loading, reload } = useApi(() => providerApi.get<any[]>("/providers/me/schedule", { startDate: days[0], endDate: days[13] }), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: days[0], startTime: "09:00", endTime: "12:00" });
  const caregiver = getSession("PROVIDER")?.providerCategory === "CAREGIVER";

  const slots = useMemo(() => (data ?? []).filter((s) => s.date === day), [data, day]);
  const countFor = (d: string) => (data ?? []).filter((s) => s.date === d && s.status === "AVAILABLE").length;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => providerApi.put("/providers/me/schedule", { slots: [form] }), (m) => toast(m, "err"));
    if (ok) {
      toast("Slot added");
      setDay(form.date);
      setOpen(false);
    }
  };

  return (
    <Screen
      title="My schedule"
      subtitle="Slots patients can book"
      back={caregiver ? "/app/provider/profile" : undefined}
      right={
        <Button size="sm" onClick={() => { setForm((f) => ({ ...f, date: day })); setOpen(true); }}>
          <Plus size={14} /> Slot
        </Button>
      }
    >
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {days.map((d, i) => (
          <Chip key={d} active={day === d} onClick={() => setDay(d)}>
            <span className="block">{i === 0 ? "Today" : fmtDate(d, { weekday: "short" })}</span>
            <span className="block text-[10px] opacity-80">
              {fmtDate(d, { day: "numeric", month: "short" })} · {countFor(d)} free
            </span>
          </Chip>
        ))}
      </div>
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !slots.length ? (
        <Notice tone="gray">No slots on {fmtDate(day)}. Add one so patients can book you.</Notice>
      ) : (
        <div className="grid gap-2">
          {slots.map((s) => (
            <Card key={s.id} className={clsx(s.status === "BLOCKED" && "opacity-60")}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                  </p>
                  <StatusBadge status={s.status} />
                </div>
                {s.status !== "BOOKED" && (
                  <>
                    <button
                      type="button"
                      aria-label={s.status === "BLOCKED" ? "Unblock slot" : "Block slot"}
                      onClick={() => run(() => providerApi.patch(`/providers/me/schedule/slots/${s.id}/block`, { blocked: s.status !== "BLOCKED" }), (m) => toast(m, "err"))}
                      className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <Ban size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete slot"
                      onClick={() => run(() => providerApi.del("/providers/me/schedule/slots", { ids: String(s.id) }), (m) => toast(m, "err"))}
                      className="rounded-full p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add a slot">
        <form onSubmit={add}>
          <Field label="Date">
            <Input type="date" min={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
            </Field>
            <Field label="To">
              <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
            </Field>
          </div>
          <p className="mb-3 text-xs text-gray-500">Slots can't overlap. Booked slots stay locked until the service ends.</p>
          <Button type="submit" busy={busy} className="w-full">
            Add slot
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
