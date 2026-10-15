/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLocation, useNavigate } from "react-router";
import clsx from "clsx";
import { CalendarRange, CheckCircle2, ChevronRight, Inbox, ShieldAlert } from "lucide-react";
import { providerApi } from "../api";
import { fmtDate, fmtTime, taka, today } from "../format";
import { useAction, useApi } from "../hooks";
import { Card, Notice, Screen, Section, Stars, StatusBadge, useToast } from "../ui";
import { MiniBars } from "../shared";

export default function ProviderHome() {
  const navigate = useNavigate();
  const justSubmitted = Boolean((useLocation().state as { justSubmitted?: boolean } | null)?.justSubmitted);
  const toast = useToast();
  const { run } = useAction();
  const me = useApi(() => providerApi.get("/providers/me"), []);
  const jobs = useApi(() => providerApi.get<{ data: any[] }>("/service-requests/provider/my-requests"), []);
  const shifts = useApi(() => providerApi.get<any[]>("/providers/me/long-term-shifts"), []);
  const stats = useApi(() => providerApi.get("/providers/me/service-analytics"), []);
  const wallet = useApi(() => providerApi.get("/financial/wallet/me"), []);

  const d = me.data;
  const incoming = (jobs.data?.data ?? []).filter((j) => j.status === "PENDING");
  const active = (jobs.data?.data ?? []).filter((j) => ["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS", "PAYMENT_PENDING"].includes(j.status));
  const todayShifts = (shifts.data ?? []).filter((s) => s.date === today() && s.confirmed && s.status !== "CANCELLED");
  const proposed = (shifts.data ?? []).filter((s) => !s.confirmed && ["SCHEDULE_PROPOSED", "CHANGE_REQUESTED", "PAYMENT_PENDING"].includes(s.opportunityStatus));

  const toggle = () => run(() => providerApi.patch("/providers/me/availability", { acceptingRequests: !d.acceptingRequests }), (m) => toast(m, "err"));

  return (
    <Screen>
      {justSubmitted && d?.verification.underReview && (
        <Card className="mb-4 border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <CheckCircle2 size={18} className="text-brand-600" /> Submitted for review
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Caregiver BD will check your documents and certificates, usually within 1–2 working days. You'll get a notification for each decision. Explore the app in the meantime.
          </p>
        </Card>
      )}
      {d && d.status !== "ACTIVE" && !(justSubmitted && d.verification.underReview) && (
        <Card className="mb-4 border-amber-300 dark:border-amber-900" onClick={() => navigate("/app/provider/verification")}>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <ShieldAlert size={16} className="text-amber-500" />
            {d.status !== "PENDING"
              ? `Profile ${String(d.status).toLowerCase()}`
              : d.verification.rejectedCount > 0
                ? "Action needed"
                : d.verification.underReview
                  ? "Verification in review"
                  : "Complete your verification"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {d.status !== "PENDING"
              ? "Contact Caregiver BD support to reactivate your profile."
              : d.verification.rejectedCount > 0
                ? `${d.verification.rejectedCount} item(s) rejected by admin. Replace them and submit again.`
                : d.verification.underReview
                  ? `${d.verification.requiredDocumentsApproved + d.verification.requiredCertificationsApproved} of ${d.verification.documentsRequired + d.verification.certificationsRequired} items approved so far. You can take jobs once admin activates your profile.`
                  : "Add your documents and certificates, then submit them for admin review."}
          </p>
          <p className="mt-2 text-xs font-semibold text-brand-600">{d.verification.underReview ? "See status →" : "Open verification →"}</p>
        </Card>
      )}

      {d && (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.acceptingRequests ? "You are online" : "You are offline"}</p>
              <p className="text-xs text-gray-500">{d.acceptingRequests ? "Patients can find and book you" : "Hidden from search; you can't accept new requests"}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={d.acceptingRequests}
              aria-label="Accepting requests"
              onClick={toggle}
              className={clsx("relative h-7 w-12 shrink-0 rounded-full transition", d.acceptingRequests ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700")}
            >
              <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition", d.acceptingRequests ? "left-[22px]" : "left-0.5")} />
            </button>
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card className="p-3" onClick={() => navigate("/app/provider/jobs")}>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{incoming.length}</p>
          <p className="text-[11px] text-gray-500">New requests</p>
        </Card>
        <Card className="p-3" onClick={() => navigate("/app/provider/wallet")}>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{taka(wallet.data?.availableToWithdraw)}</p>
          <p className="text-[11px] text-gray-500">Available</p>
        </Card>
        <Card className="p-3" onClick={() => navigate("/app/provider/reviews")}>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{d ? Number(d.averageRating).toFixed(1) : "—"}</p>
          <p className="text-[11px] text-gray-500">Rating</p>
        </Card>
      </div>

      {incoming.length > 0 && (
        <Section title="New requests">
          <div className="grid gap-2">
            {incoming.map((j) => (
              <Card key={j.id} onClick={() => navigate(`/app/provider/jobs/${j.id}`)} className="border-amber-300 dark:border-amber-900">
                <div className="flex items-center gap-2">
                  <Inbox size={16} className="text-amber-500" />
                  <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">{j.patientName}</p>
                  <p className="text-sm font-semibold">{taka(j.fee)}</p>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {fmtDate(j.scheduledDate)} · {fmtTime(j.scheduledTime)} · {j.address}
                </p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {(todayShifts.length > 0 || active.length > 0) && (
        <Section title="Today & upcoming">
          <div className="grid gap-2">
            {todayShifts.map((s) => (
              <Card key={`s${s.slotId}`} onClick={() => navigate(`/app/provider/shifts/${s.slotId}`)}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.patientName}</p>
                  <StatusBadge status={s.status} label={s.status === "ACCEPTED" ? "Today" : undefined} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Long-term · {fmtTime(s.startTime)}–{fmtTime(s.endTime)} · {s.address}
                </p>
              </Card>
            ))}
            {active.map((j) => (
              <Card key={j.id} onClick={() => navigate(`/app/provider/jobs/${j.id}`)}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{j.patientName}</p>
                  <StatusBadge status={j.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {fmtDate(j.scheduledDate)} · {fmtTime(j.scheduledTime)} · {j.address}
                </p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {proposed.length > 0 && (
        <Notice tone="blue">
          <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => navigate("/app/provider/shifts")}>
            <CalendarRange size={16} />
            <span className="flex-1">{proposed.length} long-term shifts proposed to a patient, waiting for their payment.</span>
            <ChevronRight size={16} />
          </button>
        </Notice>
      )}

      {stats.data && (
        <Section title="Last 7 days" className="mt-4">
          <Card>
            <div className="mb-3 grid grid-cols-3 text-center">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{stats.data.totalRequests}</p>
                <p className="text-[11px] text-gray-500">Requests (30d)</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{stats.data.booked}</p>
                <p className="text-[11px] text-gray-500">Booked</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{stats.data.done}</p>
                <p className="text-[11px] text-gray-500">Done</p>
              </div>
            </div>
            <MiniBars values={stats.data.last7Days.map((x: any) => x.booked)} labels={stats.data.last7Days.map((x: any) => x.day)} height={60} />
          </Card>
        </Section>
      )}

      {d && (
        <p className="mt-2 text-center text-xs text-gray-400">
          <Stars value={d.averageRating} count={d.totalReviews} /> · {d.employmentType === "SALARIED" ? "Salaried" : "Independent"} · {d.levelName ?? "No level yet"}
        </p>
      )}
    </Screen>
  );
}
