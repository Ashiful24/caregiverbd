import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { bn } from "date-fns/locale/bn";
import { enUS } from "date-fns/locale/en-US";
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { AngleLeftIcon, AngleRightIcon, TimeIcon } from "../../icons";
import {
  parseEventRange,
  rangesOverlap,
  type ScheduleEventRecord,
} from "../../data/nurseScheduleSeed";
import {
  adminLongTermOpportunitiesApi,
  normalizeServiceRequestFeeEstimate,
  providersApi,
  serviceRequestsApi,
  type ProviderListItem,
} from "../../services/api";
import { buildEventsFromScheduleDetails } from "../../utils/longTermScheduleEvents";
import { useAuth } from "../../context/AuthContext";
import { useUnsavedDraftNavigationGuard } from "../../hooks/useUnsavedDraftNavigationGuard";
import { ConfirmModal } from "../ui/confirm-modal";
import { ScheduleMonthView } from "./ScheduleMonthView";
import { ScheduleWeekView } from "./ScheduleWeekView";
import { ScheduleDayView } from "./ScheduleDayView";

export type ScheduleViewMode = "month" | "week" | "day";

export const SCHEDULE_SHIFT_HOURS_OPTIONS = [4, 8, 12, 24] as const;
export type ScheduleShiftHours = (typeof SCHEDULE_SHIFT_HOURS_OPTIONS)[number];

function isScheduleShiftHours(value: number): value is ScheduleShiftHours {
  return (SCHEDULE_SHIFT_HOURS_OPTIONS as readonly number[]).includes(value);
}

function resolveDefaultShiftHours(value?: number | null): ScheduleShiftHours {
  if (value != null && isScheduleShiftHours(value)) return value;
  return 8;
}

type Props = {
  requestId: string;
  title: string;
  subtitle: string;
  requestStartDate: string;
  requestEndDate: string;
  baseServiceAmount?: string | number | null;
  consultationTypeId?: number | null;
  defaultShiftDurationHours?: number | null;
  initialEvents?: ScheduleEventRecord[];
  /** After create, parent can persist schedule-details payload (request row + initialEvents). */
  onScheduleDetailsSynced?: (scheduleDetailsPayload: unknown) => void;
};

type ModalDraft = {
  startDateStr: string;
  startHour: number;
  endDateStr: string;
  endHour: number;
};

function parseRequestBoundary(value: string, mode: "start" | "end"): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return new Date();
  if (dateOnly) {
    if (mode === "start") d.setHours(0, 0, 0, 0);
    else d.setHours(23, 59, 59, 999);
  }
  return d;
}

function combineDateHour(dateStr: string, hour: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

const modalTimeInputClass =
  "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:border-dashed disabled:border-gray-400 disabled:bg-gray-200/90 disabled:text-gray-500 disabled:opacity-100 dark:disabled:border-gray-500 dark:disabled:bg-gray-800/90 dark:disabled:text-gray-400";

function eventOverlapsNurse(
  events: ScheduleEventRecord[],
  nurseId: string,
  start: Date,
  end: Date,
  excludeId?: string
): boolean {
  return events.some((e) => {
    if (e.id === excludeId) return false;
    if (e.nurseId !== nurseId) return false;
    const { start: s, end: ed } = parseEventRange(e);
    return rangesOverlap(start, end, s, ed);
  });
}

function parseFeeFromLabel(feeLabel?: string): number {
  if (!feeLabel?.trim()) return 0;
  const n = Number(feeLabel.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function applyShiftToModalDraft(draft: ModalDraft, shiftHours: number): ModalDraft {
  const start = combineDateHour(draft.startDateStr, draft.startHour);
  const end = addHours(start, shiftHours);
  return {
    ...draft,
    endDateStr: format(end, "yyyy-MM-dd"),
    endHour: end.getHours(),
  };
}

function eventToProviderSlot(event: ScheduleEventRecord): {
  providerId: number;
  date: string;
  startTime: string;
  endTime: string;
} {
  const { start, end } = parseEventRange(event);
  return {
    providerId: Number(event.nurseId),
    date: format(start, "yyyy-MM-dd"),
    startTime: format(start, "HH:mm"),
    endTime: format(end, "HH:mm"),
  };
}

export function ScheduleCalendar({
  requestId,
  title,
  subtitle,
  requestStartDate,
  requestEndDate,
  baseServiceAmount,
  consultationTypeId: requestConsultationTypeId,
  defaultShiftDurationHours,
  initialEvents = [],
  onScheduleDetailsSynced,
}: Props) {
  const { t, i18n } = useTranslation();
  const dateLoc = i18n.language?.startsWith("bn") ? bn : enUS;

  const formatDurationLabel = (start: Date, end: Date): string => {
    const mins = differenceInMinutes(end, start);
    if (mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hAbbr = t("scheduleCalendar.hoursAbbr");
    const mAbbr = t("scheduleCalendar.minutesAbbr");
    if (m === 0) return `${h}${hAbbr}`;
    return `${h}${hAbbr} ${m}${mAbbr}`;
  };

  const hourOptions = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        value: hour,
        label: format(new Date(2000, 0, 1, hour, 0, 0, 0), "h:mm a", { locale: dateLoc }),
      })),
    [dateLoc]
  );

  const { user } = useAuth();
  const currentRole = String(user?.role ?? "").toUpperCase();
  const supervisorId =
    currentRole === "SUPERVISOR" && Number.isFinite(Number(user?.id)) && Number(user?.id) > 0
      ? Number(user?.id)
      : undefined;

  const [view, setView] = useState<ScheduleViewMode>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<ScheduleEventRecord[]>(initialEvents);
  const [pendingEvents, setPendingEvents] = useState<ScheduleEventRecord[]>([]);
  const [modalDraft, setModalDraft] = useState<ModalDraft | null>(null);
  const [selectedNurseId, setSelectedNurseId] = useState<number | null>(null);
  const [nurses, setNurses] = useState<ProviderListItem[]>([]);
  const [nursesLoading, setNursesLoading] = useState(false);
  const [availabilityLoadingId, setAvailabilityLoadingId] = useState<number | null>(null);
  const [availabilityByNurse, setAvailabilityByNurse] = useState<Record<number, string[]>>({});
  const [availabilityErrorByNurse, setAvailabilityErrorByNurse] = useState<Record<number, string>>(
    {}
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [locallyAddedAmount, setLocallyAddedAmount] = useState(0);
  const [removeTarget, setRemoveTarget] = useState<ScheduleEventRecord | null>(null);
  const [removingEvent, setRemovingEvent] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [selectedShiftHours, setSelectedShiftHours] = useState<ScheduleShiftHours>(() =>
    resolveDefaultShiftHours(defaultShiftDurationHours)
  );
  const [feeEstimateAmount, setFeeEstimateAmount] = useState<number | null>(null);
  const [feeEstimateLoading, setFeeEstimateLoading] = useState(false);
  const [feeEstimateError, setFeeEstimateError] = useState<string | null>(null);
  const isScheduleModalOpen = modalDraft != null;

  const requestStart = useMemo(
    () => parseRequestBoundary(requestStartDate, "start"),
    [requestStartDate]
  );
  const requestEnd = useMemo(
    () => parseRequestBoundary(requestEndDate, "end"),
    [requestEndDate]
  );

  useEffect(() => {
    setEvents(initialEvents);
    setPendingEvents([]);
    setLocallyAddedAmount(0);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, [initialEvents, requestId]);

  const displayEvents = useMemo(
    () => [...events, ...pendingEvents],
    [events, pendingEvents]
  );

  const hasPendingDrafts = pendingEvents.length > 0;
  const { dialogOpen: leaveDialogOpen, cancelLeave, confirmLeave } =
    useUnsavedDraftNavigationGuard(hasPendingDrafts);

  const discardPendingDrafts = useCallback(() => {
    setPendingEvents([]);
    setLocallyAddedAmount(0);
    setSubmitError(null);
    setSubmitSuccess(false);
  }, []);

  const parseMoney = (v: unknown): number => {
    const raw = String(v ?? "").trim();
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const formatMoney = (v: number): string =>
    `${v.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: 2,
    })} ৳`;

  const extractApiErrorMessage = (err: unknown): string | null => {
    if (!err || typeof err !== "object") return null;
    const e = err as Record<string, unknown>;
    const response = e.response && typeof e.response === "object" ? (e.response as Record<string, unknown>) : null;
    const data = response?.data && typeof response.data === "object" ? (response.data as Record<string, unknown>) : null;
    const candidates = [data?.message, e.message];
    for (const candidate of candidates) {
      const msg = String(candidate ?? "").trim();
      if (msg) return msg;
    }
    return null;
  };

  const dayInRange = useCallback(
    (day: Date) => {
      const d = startOfDay(day);
      return !isBefore(d, startOfDay(requestStart)) && !isAfter(d, startOfDay(requestEnd));
    },
    [requestStart, requestEnd]
  );

  const computedRange = useMemo(() => {
    if (!modalDraft) return null;
    const start = combineDateHour(modalDraft.startDateStr, modalDraft.startHour);
    const end = combineDateHour(modalDraft.endDateStr, modalDraft.endHour);
    return { start, end };
  }, [modalDraft]);

  const selectedNurse = nurses.find((n) => n.id === selectedNurseId) ?? null;

  const resolvedConsultationTypeId = useMemo(() => {
    const fromProvider = selectedNurse?.consultationTypeId;
    if (fromProvider != null && fromProvider > 0) return fromProvider;
    if (requestConsultationTypeId != null && requestConsultationTypeId > 0) {
      return requestConsultationTypeId;
    }
    return null;
  }, [selectedNurse?.consultationTypeId, requestConsultationTypeId]);

  const selectedServiceFee = feeEstimateAmount ?? 0;
  const totalServiceAmount = parseMoney(baseServiceAmount) + locallyAddedAmount;

  const computedEndPreview = useMemo(() => {
    if (!modalDraft) return null;
    const end = combineDateHour(modalDraft.endDateStr, modalDraft.endHour);
    return format(end, "PPp", { locale: dateLoc });
  }, [modalDraft, dateLoc]);

  const rangeValidForSave = useMemo(() => {
    if (!computedRange) return false;
    const { start, end } = computedRange;
    const durationMins = differenceInMinutes(end, start);
    if (durationMins !== selectedShiftHours * 60) return false;
    if (start.getTime() < requestStart.getTime() || end.getTime() > requestEnd.getTime()) return false;
    return true;
  }, [computedRange, requestStart, requestEnd, selectedShiftHours]);

  const canSaveEvent =
    Boolean(selectedNurseId) &&
    rangeValidForSave &&
    !savingEvent &&
    !feeEstimateLoading &&
    feeEstimateAmount != null &&
    !feeEstimateError;

  useEffect(() => {
    if (!isScheduleModalOpen) {
      setNurses([]);
      setNursesLoading(false);
      return;
    }

    const ac = new AbortController();
    setNursesLoading(true);
    providersApi
      .getList(
        {
          page: 1,
          limit: 10,
          ...(supervisorId != null ? { supervisorId } : {}),
        },
        { signal: ac.signal }
      )
      .then((res) => {
        const payload = res.data as { providers?: ProviderListItem[] } | null;
        const list = Array.isArray(payload?.providers) ? payload.providers : [];
        setNurses(list);
        setSelectedNurseId((prev) => (prev != null && list.some((n) => n.id === prev) ? prev : null));
      })
      .catch(() => {
        setNurses([]);
      })
      .finally(() => {
        setNursesLoading(false);
      });

    return () => ac.abort();
  }, [isScheduleModalOpen, supervisorId]);

  useEffect(() => {
    if (!isScheduleModalOpen || !selectedNurseId) {
      setFeeEstimateAmount(null);
      setFeeEstimateError(null);
      setFeeEstimateLoading(false);
      return;
    }

    if (!resolvedConsultationTypeId) {
      setFeeEstimateAmount(null);
      setFeeEstimateError(t("scheduleCalendar.errMissingConsultationType"));
      setFeeEstimateLoading(false);
      return;
    }

    const ac = new AbortController();
    setFeeEstimateLoading(true);
    setFeeEstimateError(null);

    void serviceRequestsApi
      .getShortTermFeeEstimate(
        {
          providerId: selectedNurseId,
          shiftDuration: selectedShiftHours,
          consultationTypeId: resolvedConsultationTypeId,
        },
        { signal: ac.signal }
      )
      .then((res) => {
        const normalized = normalizeServiceRequestFeeEstimate(res.data);
        if (!normalized?.subTotal) {
          setFeeEstimateAmount(null);
          setFeeEstimateError(t("scheduleCalendar.feeEstimateFailed"));
          return;
        }
        const fee = parseMoney(normalized.subTotal);
        setFeeEstimateAmount(Number.isFinite(fee) ? fee : null);
        if (!Number.isFinite(fee)) {
          setFeeEstimateError(t("scheduleCalendar.feeEstimateFailed"));
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setFeeEstimateAmount(null);
        setFeeEstimateError(
          extractApiErrorMessage(err) ?? t("scheduleCalendar.feeEstimateFailed")
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setFeeEstimateLoading(false);
      });

    return () => ac.abort();
  }, [
    isScheduleModalOpen,
    selectedNurseId,
    selectedShiftHours,
    resolvedConsultationTypeId,
    t,
  ]);

  const closeModal = () => {
    setModalDraft(null);
    setSelectedNurseId(null);
    setSelectedShiftHours(resolveDefaultShiftHours(defaultShiftDurationHours));
    setFeeEstimateAmount(null);
    setFeeEstimateError(null);
    setFeeEstimateLoading(false);
    setFormError(null);
    setNurses([]);
    setAvailabilityByNurse({});
    setAvailabilityErrorByNurse({});
    setAvailabilityLoadingId(null);
  };

  const handleOpenRemove = (event: ScheduleEventRecord) => {
    setRemoveTarget(event);
    setRemoveReason("");
    setRemoveError(null);
  };

  const handleCloseRemove = () => {
    setRemoveTarget(null);
    setRemovingEvent(false);
    setRemoveReason("");
    setRemoveError(null);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;

    if (removeTarget.pending) {
      const removedAmount = parseFeeFromLabel(removeTarget.feeLabel);
      setPendingEvents((prev) => prev.filter((e) => e.id !== removeTarget.id));
      if (removedAmount > 0) {
        setLocallyAddedAmount((prev) => Math.max(0, prev - removedAmount));
      }
      handleCloseRemove();
      return;
    }

    if (!removeTarget.scheduleSlotId) {
      setRemoveError(t("scheduleCalendar.errMissingSlot"));
      return;
    }
    setRemovingEvent(true);
    setRemoveError(null);
    try {
      await adminLongTermOpportunitiesApi.rejectScheduleSlot(
        requestId,
        removeTarget.scheduleSlotId,
        { reason: removeReason.trim() || t("scheduleCalendar.defaultRemoveReason") }
      );
      setEvents((prev) => prev.filter((e) => e.id !== removeTarget.id));
      handleCloseRemove();
    } catch (err: unknown) {
      setRemoveError(extractApiErrorMessage(err) ?? t("scheduleCalendar.errRemove"));
    } finally {
      setRemovingEvent(false);
    }
  };

  const syncEventsFromScheduleDetails = async () => {
    const nurseFallback = t("scheduleCalendar.nurseFallback");
    const detailsRes = await adminLongTermOpportunitiesApi.getScheduleDetails(requestId);
    const raw = detailsRes.data;
    if (raw != null && typeof raw === "object") {
      const fresh = buildEventsFromScheduleDetails(raw, requestId, nurseFallback);
      setEvents(fresh);
      onScheduleDetailsSynced?.(raw);
    }
  };

  const submitPendingSchedule = async () => {
    if (pendingEvents.length === 0) return;
    setSubmittingSchedule(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const slots = pendingEvents.map(eventToProviderSlot);
      await adminLongTermOpportunitiesApi.createProviderSchedule(requestId, { slots });
      setPendingEvents([]);
      setLocallyAddedAmount(0);
      await syncEventsFromScheduleDetails();
      setSubmitSuccess(true);
    } catch (err: unknown) {
      setSubmitError(extractApiErrorMessage(err) ?? t("scheduleCalendar.errSubmit"));
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const openModalFromHour = (day: Date, hour24: number) => {
    if (!dayInRange(day)) return;
    const shift = resolveDefaultShiftHours(defaultShiftDurationHours);
    const start = addHours(startOfDay(day), hour24);
    setFormError(null);
    setSelectedShiftHours(shift);
    setFeeEstimateAmount(null);
    setFeeEstimateError(null);
    setModalDraft(
      applyShiftToModalDraft(
        {
          startDateStr: format(start, "yyyy-MM-dd"),
          startHour: hour24,
          endDateStr: format(start, "yyyy-MM-dd"),
          endHour: hour24,
        },
        shift
      )
    );
    setSelectedNurseId(null);
  };

  const openModalFromDay = (day: Date) => {
    if (!dayInRange(day)) return;
    const shift = resolveDefaultShiftHours(defaultShiftDurationHours);
    const start = addHours(startOfDay(day), 9);
    setFormError(null);
    setSelectedShiftHours(shift);
    setFeeEstimateAmount(null);
    setFeeEstimateError(null);
    setModalDraft(
      applyShiftToModalDraft(
        {
          startDateStr: format(start, "yyyy-MM-dd"),
          startHour: 9,
          endDateStr: format(start, "yyyy-MM-dd"),
          endHour: 9,
        },
        shift
      )
    );
    setSelectedNurseId(null);
  };

  const patchDraft = (partial: Partial<ModalDraft>) => {
    setModalDraft((d) =>
      d ? applyShiftToModalDraft({ ...d, ...partial }, selectedShiftHours) : d
    );
    setFormError(null);
  };

  const handleShiftHoursChange = (hours: ScheduleShiftHours) => {
    setSelectedShiftHours(hours);
    setModalDraft((d) => (d ? applyShiftToModalDraft(d, hours) : d));
    setFormError(null);
  };

  const providerLabel = (p: ProviderListItem): string => {
    const full = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
    if (full) return full;
    return (
      p.name?.trim() ||
      p.fullName?.trim() ||
      p.providerName?.trim() ||
      p.email ||
      p.username ||
      t("scheduleCalendar.nurseFallback")
    );
  };

  const handleCheckAvailability = async (providerId: number) => {
    if (!modalDraft?.startDateStr) return;
    setAvailabilityLoadingId(providerId);
    setAvailabilityErrorByNurse((prev) => ({ ...prev, [providerId]: "" }));
    try {
      const startTime = format(
        combineDateHour(modalDraft.startDateStr, modalDraft.startHour),
        "HH:mm"
      );
      const res = await providersApi.getAvailability(providerId, modalDraft.startDateStr, {
        time: startTime,
        shiftDuration: selectedShiftHours,
      });
      const data = res.data as unknown;
      const slotsRaw =
        Array.isArray(data)
          ? data
          : data && typeof data === "object"
            ? ((data as Record<string, unknown>).slots ??
              (data as Record<string, unknown>).availableSlots ??
              (data as Record<string, unknown>).data)
            : null;
      const slots = Array.isArray(slotsRaw)
        ? slotsRaw
            .map((x) => {
              if (x && typeof x === "object") {
                const o = x as Record<string, unknown>;
                const from = String(o.from ?? "").trim();
                const to = String(o.to ?? "").trim();
                if (from && to) return `${from} - ${to}`;
                if (from) return from;
                if (to) return to;
                return "";
              }
              const s = String(x ?? "").trim();
              return s;
            })
            .filter((x) => x.length > 0)
        : [];
      setAvailabilityByNurse((prev) => ({ ...prev, [providerId]: slots }));
      if (slots.length === 0) {
        setAvailabilityErrorByNurse((prev) => ({
          ...prev,
          [providerId]: t("scheduleCalendar.noSlotsForDate"),
        }));
      }
    } catch {
      setAvailabilityByNurse((prev) => ({ ...prev, [providerId]: [] }));
      setAvailabilityErrorByNurse((prev) => ({
        ...prev,
        [providerId]: t("scheduleCalendar.failedAvailability"),
      }));
    } finally {
      setAvailabilityLoadingId(null);
    }
  };

  const saveEvent = async () => {
    if (!modalDraft || !computedRange || !selectedNurseId) return;
    const { start, end } = computedRange;
    if (!isScheduleShiftHours(selectedShiftHours)) {
      setFormError(t("scheduleCalendar.errSelectShift"));
      return;
    }
    if (differenceInMinutes(end, start) !== selectedShiftHours * 60) {
      setFormError(t("scheduleCalendar.errSelectShift"));
      return;
    }
    if (start.getTime() < requestStart.getTime() || end.getTime() > requestEnd.getTime()) {
      setFormError(t("scheduleCalendar.errWindow"));
      return;
    }
    const nurse = nurses.find((n) => n.id === selectedNurseId);
    if (!nurse) {
      setFormError(t("scheduleCalendar.errSelectNurse"));
      return;
    }
    if (feeEstimateLoading || feeEstimateAmount == null) {
      setFormError(t("scheduleCalendar.errFeeEstimateRequired"));
      return;
    }
    const nurseId = String(nurse.id);
    const eventAmount = feeEstimateAmount;
    if (eventOverlapsNurse(displayEvents, nurseId, start, end)) {
      setFormError(t("scheduleCalendar.errOverlap"));
      return;
    }
    setSavingEvent(true);
    setFormError(null);
    setSubmitSuccess(false);
    try {
      const newEvent: ScheduleEventRecord = {
        id: `pending-${requestId}-${Date.now()}`,
        requestId,
        nurseId,
        nurseName: providerLabel(nurse),
        title: providerLabel(nurse),
        feeLabel: eventAmount > 0 ? formatMoney(eventAmount) : undefined,
        start: start.toISOString(),
        end: end.toISOString(),
        type: "visit",
        pending: true,
      };
      setPendingEvents((prev) => [...prev, newEvent]);
      if (eventAmount > 0) {
        setLocallyAddedAmount((prev) => prev + eventAmount);
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(extractApiErrorMessage(err) ?? t("scheduleCalendar.errCreate"));
    } finally {
      setSavingEvent(false);
    }
  };

  const rangeTitle = useMemo(() => {
    if (view === "month") return format(anchor, "MMMM yyyy", { locale: dateLoc });
    if (view === "week") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = addDays(ws, 6);
      return `${format(ws, "MMM d", { locale: dateLoc })} – ${format(we, "MMM d, yyyy", { locale: dateLoc })}`;
    }
    return format(anchor, "EEEE, MMM d, yyyy", { locale: dateLoc });
  }, [view, anchor, dateLoc]);

  const visibleMonth = view === "month" ? anchor : startOfMonth(anchor);

  const durationLabel = computedRange ? formatDurationLabel(computedRange.start, computedRange.end) : "—";

  const goPrev = () => {
    if (view === "month") setAnchor((d) => subMonths(d, 1));
    else if (view === "week") setAnchor((d) => subWeeks(d, 1));
    else setAnchor((d) => subDays(d, 1));
  };

  const goNext = () => {
    if (view === "month") setAnchor((d) => addMonths(d, 1));
    else if (view === "week") setAnchor((d) => addWeeks(d, 1));
    else setAnchor((d) => addDays(d, 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">
            {t("scheduleCalendar.serviceAmount", { amount: formatMoney(totalServiceAmount) })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800/80">
            {(["month", "week", "day"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  view === mode
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {mode === "month"
                  ? t("scheduleCalendar.viewMonth")
                  : mode === "week"
                    ? t("scheduleCalendar.viewWeek")
                    : t("scheduleCalendar.viewDay")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 dark:border-gray-700 dark:bg-gray-900/40">
            <button
              type="button"
              onClick={goPrev}
              className="inline-flex size-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={t("scheduleCalendar.ariaPrevious")}
            >
              <AngleLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchor(startOfDay(new Date()))}
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/40"
            >
              {t("scheduleCalendar.today")}
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex size-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={t("scheduleCalendar.ariaNext")}
            >
              <AngleRightIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-gray-300 bg-white pt-3 shadow-sm dark:border-gray-600 dark:bg-gray-900/30 sm:pt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 pb-3 dark:border-gray-600">
          <p className="text-base font-semibold text-gray-900 dark:text-white">{rangeTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("scheduleCalendar.clickHourHint")}</p>
        </div>

        {view === "month" && (
          <ScheduleMonthView
            visibleMonth={visibleMonth}
            events={displayEvents}
            dayInRange={dayInRange}
            onSelectDay={openModalFromDay}
            onEventClick={handleOpenRemove}
          />
        )}
        {view === "week" && (
          <ScheduleWeekView
            weekAnchor={anchor}
            events={displayEvents}
            dayInRange={dayInRange}
            onSelectHour={openModalFromHour}
            onEventClick={handleOpenRemove}
          />
        )}
        {view === "day" && (
          <ScheduleDayView
            day={anchor}
            events={displayEvents}
            dayInRange={dayInRange}
            onSelectHour={openModalFromHour}
            onEventClick={handleOpenRemove}
          />
        )}
      </div>

      {pendingEvents.length > 0 && (
        <div className="sticky bottom-4 z-10 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg dark:border-amber-800/60 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {t("scheduleCalendar.pendingBanner", { count: pendingEvents.length })}
            </p>
            {submitError ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{submitError}</p>
            ) : null}
            {submitSuccess ? (
              <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                {t("scheduleCalendar.submitSuccess")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={submittingSchedule}
            onClick={() => void submitPendingSchedule()}
            className="shrink-0 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submittingSchedule
              ? t("scheduleCalendar.submittingSchedule")
              : t("scheduleCalendar.submitSchedule")}
          </button>
        </div>
      )}

      {modalDraft && computedRange && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("scheduleCalendar.scheduleVisit")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("scheduleCalendar.scheduleVisitHelp")}
            </p>
            <p className="mt-2 text-sm font-medium text-brand-700 dark:text-brand-400">
              {!selectedNurse
                ? t("scheduleCalendar.selectProviderForTotal")
                : feeEstimateLoading
                  ? t("scheduleCalendar.feeEstimateLoading")
                  : feeEstimateError
                    ? feeEstimateError
                    : feeEstimateAmount != null
                      ? t("scheduleCalendar.subTotalLine", {
                          hours: String(selectedShiftHours),
                          total: formatMoney(selectedServiceFee),
                        })
                      : t("scheduleCalendar.selectProviderForTotal")}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("scheduleCalendar.shiftDuration")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_SHIFT_HOURS_OPTIONS.map((hours) => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => handleShiftHoursChange(hours)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedShiftHours === hours
                          ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-100"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      }`}
                    >
                      {t("scheduleCalendar.shiftHoursOption", { hours: String(hours) })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <TimeIcon className="size-5 shrink-0 text-gray-400" aria-hidden />
                <input
                  type="date"
                  value={modalDraft.startDateStr}
                  onChange={(e) => patchDraft({ startDateStr: e.target.value })}
                  className={modalTimeInputClass}
                />
                <select
                  value={modalDraft.startHour}
                  onChange={(e) => patchDraft({ startHour: Number(e.target.value) })}
                  className={modalTimeInputClass}
                >
                  {hourOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {durationLabel}
                  {computedEndPreview
                    ? ` · ${t("scheduleCalendar.shiftEndPreview", { end: computedEndPreview })}`
                    : null}
                </span>
              </div>

              {/* <div className="flex flex-wrap items-center gap-2">
                <TaskIcon className="size-5 shrink-0 text-gray-400" aria-hidden />
                <select
                  disabled
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  value="none"
                >
                  <option value="none">Does not repeat</option>
                </select>
              </div> */}
            </div>

            {!rangeValidForSave && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
                {t("scheduleCalendar.rangeInvalidHint", {
                  start: format(requestStart, "P", { locale: dateLoc }),
                  end: format(requestEnd, "P", { locale: dateLoc }),
                })}
              </p>
            )}

            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("scheduleCalendar.nurseList")}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentRole === "SUPERVISOR"
                  ? t("scheduleCalendar.nurseListSupervisor")
                  : t("scheduleCalendar.nurseListAll")}
              </p>

              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {nursesLoading && (
                  <p className="text-sm text-gray-500">{t("scheduleCalendar.loadingShort")}</p>
                )}
                {!nursesLoading && nurses.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t("scheduleCalendar.noNurses")}</p>
                )}
                {!nursesLoading &&
                  nurses.map((nurse) => (
                    <div
                      key={nurse.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        selectedNurseId === nurse.id
                          ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="schedule-nurse"
                            checked={selectedNurseId === nurse.id}
                            onChange={() => setSelectedNurseId(nurse.id)}
                            className="sr-only"
                          />
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                              selectedNurseId === nurse.id
                                ? "border-white bg-brand-500"
                                : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
                            }`}
                            aria-hidden
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                selectedNurseId === nurse.id ? "bg-white" : "bg-transparent"
                              }`}
                            />
                          </span>
                          <span className="text-gray-800 dark:text-gray-200">
                            {providerLabel(nurse)}
                            <span className="ml-1 text-gray-500">
                              (
                              {nurse.consultationTypeName ??
                                nurse.username ??
                                t("scheduleCalendar.nurseFallback")}
                              )
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleCheckAvailability(nurse.id)}
                          disabled={availabilityLoadingId === nurse.id}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          {availabilityLoadingId === nurse.id
                            ? t("scheduleCalendar.checking")
                            : t("scheduleCalendar.availabilityCheck")}
                        </button>
                      </div>

                      {availabilityErrorByNurse[nurse.id] ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                          {availabilityErrorByNurse[nurse.id]}
                        </p>
                      ) : null}

                      {availabilityByNurse[nurse.id]?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {availabilityByNurse[nurse.id].map((slot) => (
                            <span
                              key={`${nurse.id}-${slot}`}
                              className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            >
                              {slot}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t("scheduleCalendar.cancel")}
              </button>
              <button
                type="button"
                disabled={!canSaveEvent}
                onClick={() => void saveEvent()}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEvent ? t("scheduleCalendar.creating") : t("scheduleCalendar.createEvent")}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {removeTarget.pending
                ? t("scheduleCalendar.removePendingTitle")
                : t("scheduleCalendar.removeSlotTitle")}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {removeTarget.pending
                ? t("scheduleCalendar.removePendingConfirm")
                : t("scheduleCalendar.removeSlotConfirm")}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {removeTarget.title} ({format(parseEventRange(removeTarget).start, "PPp", { locale: dateLoc })}{" "}
              - {format(parseEventRange(removeTarget).end, "p", { locale: dateLoc })})
            </p>
            {!removeTarget.pending ? (
              <label className="mt-3 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("scheduleCalendar.reason")}
                <input
                  type="text"
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  placeholder={t("scheduleCalendar.optionalReasonPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </label>
            ) : null}
            {removeError ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{removeError}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={handleCloseRemove}
                disabled={removingEvent}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t("scheduleCalendar.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemove()}
                disabled={removingEvent}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removingEvent ? t("scheduleCalendar.removing") : t("scheduleCalendar.remove")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={leaveDialogOpen}
        onClose={cancelLeave}
        title={t("scheduleCalendar.leaveDraftTitle")}
        message={t("scheduleCalendar.leaveDraftMessage", { count: pendingEvents.length })}
        cancelLabel={t("scheduleCalendar.leaveDraftStay")}
        confirmLabel={t("scheduleCalendar.leaveDraftLeave")}
        confirmVariant="danger"
        onConfirm={() => {
          confirmLeave(discardPendingDrafts);
        }}
      />
    </div>
  );
}
