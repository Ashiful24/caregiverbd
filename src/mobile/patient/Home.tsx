/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate } from "react-router";
import { Baby, BedDouble, CalendarClock, ChevronRight, HeartHandshake, HeartPulse, Search, Stethoscope } from "lucide-react";
import { patientApi } from "../api";
import { fmtDate, fmtTime, taka } from "../format";
import { useApi } from "../hooks";
import { Card, Empty, Loading, Notice, Screen, Section, StatusBadge } from "../ui";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  DOCTOR: <Stethoscope size={20} />,
  NURSING_CARE: <HeartPulse size={20} />,
  CAREGIVER: <HeartHandshake size={20} />,
  PHYSIOTHERAPY: <BedDouble size={20} />,
};

export default function PatientHome() {
  const navigate = useNavigate();
  const me = useApi(() => patientApi.get("/patients/me"), []);
  const types = useApi(() => patientApi.get<any[]>("/consultation-types"), []);
  const requests = useApi(() => patientApi.get<{ data: any[] }>("/service-requests/patient/my-requests"), []);
  const lto = useApi(() => patientApi.get<any[]>("/long-term-opportunities/patient/my"), []);

  const activeVisits = (requests.data?.data ?? []).filter((r) => ["PENDING", "ACCEPTED", "ON_THE_WAY", "IN_PROGRESS", "PAYMENT_PENDING"].includes(r.status));
  const activeLto = (lto.data ?? []).filter((l) => !["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(l.status));
  const inactive = me.data && me.data.status !== "ACTIVE";

  return (
    <Screen>
      {inactive && (
        <div className="mb-4">
          <Notice tone="amber">Your profile is {String(me.data.status).toLowerCase()}. Admin needs to activate it before you can book services.</Notice>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/app/patient/search")}
        className="mb-4 flex h-12 w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 text-left text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-900"
      >
        <Search size={18} /> Search doctors, nurses, caregivers…
      </button>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => navigate("/app/patient/search")} className="rounded-2xl bg-brand-500 p-4 text-left text-white">
          <Stethoscope size={22} />
          <p className="mt-3 font-semibold">Home visit</p>
          <p className="text-xs text-white/80">Book a doctor or nurse by slot</p>
        </button>
        <button type="button" onClick={() => navigate("/app/patient/long-term/new")} className="rounded-2xl bg-gray-900 p-4 text-left text-white dark:bg-gray-800">
          <CalendarClock size={22} />
          <p className="mt-3 font-semibold">Long-term care</p>
          <p className="text-xs text-white/70">Daily nurse / caregiver shifts</p>
        </button>
      </div>

      {(activeLto.length > 0 || activeVisits.length > 0) && (
        <Section title="In progress" action={<button type="button" className="text-xs font-semibold text-brand-600" onClick={() => navigate("/app/patient/requests")}>See all</button>}>
          <div className="grid gap-2">
            {activeLto.map((l) => (
              <Card key={`l${l.id}`} onClick={() => navigate(`/app/patient/long-term/${l.id}`)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{l.consultationTypeName}</p>
                  <StatusBadge status={l.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {l.requestNo} · {fmtDate(l.startDate)} – {fmtDate(l.endDate)} · {l.shiftDurationHours}h shifts
                </p>
                {l.status === "SCHEDULE_PROPOSED" && <p className="mt-2 text-xs font-semibold text-blue-600">Schedule ready, review and accept →</p>}
                {l.status === "PAYMENT_PENDING" && <p className="mt-2 text-xs font-semibold text-amber-600">Pay {taka(l.payableAmount)} to confirm →</p>}
              </Card>
            ))}
            {activeVisits.map((r) => (
              <Card key={r.id} onClick={() => navigate(`/app/patient/requests/${r.id}`)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.providerName ?? "Open request"}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {r.consultationTypeName} · {fmtDate(r.scheduledDate)} {fmtTime(r.scheduledTime)}
                </p>
                {r.status === "ON_THE_WAY" && r.startOtp && <p className="mt-2 text-xs font-semibold text-violet-600">Start OTP: {r.startOtp}</p>}
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title="Services">
        {types.loading && !types.data ? (
          <Loading />
        ) : (
          <div className="grid gap-3">
            {(types.data ?? []).map((root) => (
              <Card key={root.id}>
                <div className="mb-2 flex items-center gap-2 text-brand-600">
                  {TYPE_ICONS[root.code] ?? <Baby size={20} />}
                  <p className="font-semibold text-gray-900 dark:text-white">{root.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(root.children.length ? root.children : [root]).map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/app/patient/search?type=${c.id}`)}
                      className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 dark:bg-gray-800 dark:text-gray-200"
                    >
                      {c.name} <ChevronRight size={12} />
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {!activeVisits.length && !activeLto.length && !requests.loading && (
        <Empty title="No active bookings" text="Book a home visit or request long-term care to get started." />
      )}
    </Screen>
  );
}
