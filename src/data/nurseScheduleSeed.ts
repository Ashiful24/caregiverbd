import { format } from "date-fns";

export type NurseRecord = {
  id: string;
  name: string;
  unit: string;
};

export type ServiceRequestRecord = {
  id: string;
  requestNo: string;
  patientName: string;
  location: string;
  startDate: string;
  endDate: string;
  requestedSlotHours: 4 | 8 | 12;
  status: "ASSIGNED" | "ACCEPTED";
  assignedNurseIds: string[];
};

export type ScheduleEventType = "visit" | "break" | "training" | "on_call";

export type ScheduleEventRecord = {
  id: string;
  requestId: string;
  nurseId: string;
  nurseName: string;
  title: string;
  start: string;
  end: string;
  type: ScheduleEventType;
};

const NURSES: NurseRecord[] = [
  { id: "n1", name: "Sarah Mitchell", unit: "ICU" },
  { id: "n2", name: "James Okonkwo", unit: "Pediatrics" },
  { id: "n3", name: "Elena Vasquez", unit: "Emergency" },
  { id: "n4", name: "David Chen", unit: "Surgery" },
  { id: "n5", name: "Amira Hassan", unit: "ICU" },
];

const SERVICE_REQUESTS: ServiceRequestRecord[] = [
  {
    id: "sr-101",
    requestNo: "SR-101",
    patientName: "Fatema Akter",
    location: "Banani, Dhaka",
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-04-10T23:59:59.999Z",
    requestedSlotHours: 12,
    status: "ASSIGNED",
    assignedNurseIds: ["n1", "n5"],
  },
  {
    id: "sr-102",
    requestNo: "SR-102",
    patientName: "Md. Rahman",
    location: "Dhanmondi, Dhaka",
    startDate: "2026-04-03T00:00:00.000Z",
    endDate: "2026-04-08T23:59:59.999Z",
    requestedSlotHours: 8,
    status: "ASSIGNED",
    assignedNurseIds: ["n2"],
  },
  {
    id: "sr-103",
    requestNo: "SR-103",
    patientName: "Nusrat Jahan",
    location: "Bashundhara, Dhaka",
    startDate: "2026-04-05T00:00:00.000Z",
    endDate: "2026-04-15T23:59:59.999Z",
    requestedSlotHours: 4,
    status: "ASSIGNED",
    assignedNurseIds: ["n3", "n4"],
  },
  {
    id: "sr-104",
    requestNo: "SR-104",
    patientName: "Harun Or Rashid",
    location: "Uttara, Dhaka",
    startDate: "2026-04-09T00:00:00.000Z",
    endDate: "2026-04-20T23:59:59.999Z",
    requestedSlotHours: 12,
    status: "ACCEPTED",
    assignedNurseIds: ["n2", "n5"],
  },
];

function nurseById(id: string): NurseRecord | undefined {
  return NURSES.find((n) => n.id === id);
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Demo seed no longer fabricates per-day visits; calendar events come from admin scheduling UI. */
function buildEventsForServiceRequest(_request: ServiceRequestRecord): ScheduleEventRecord[] {
  return [];
}

/**
 * Nurses available for a time window on this request, excluding those already booked in `existingEvents`.
 * Used when the availability API is unavailable or as a secondary filter.
 */
export function filterAvailableNursesLocal(
  nurses: NurseRecord[],
  existingEvents: ScheduleEventRecord[],
  rangeStart: Date,
  rangeEnd: Date
): NurseRecord[] {
  return nurses.filter((n) => {
    const busy = existingEvents.some((e) => {
      if (e.nurseId !== n.id) return false;
      const { start, end } = parseEventRange(e);
      return rangesOverlap(rangeStart, rangeEnd, start, end);
    });
    return !busy;
  });
}

export function getNurses(): NurseRecord[] {
  return NURSES;
}

export function getServiceRequests(): ServiceRequestRecord[] {
  return SERVICE_REQUESTS;
}

export function getServiceRequestById(id: string): ServiceRequestRecord | undefined {
  return SERVICE_REQUESTS.find((r) => r.id === id);
}

export function getAssignedNurseNames(request: ServiceRequestRecord): string[] {
  return request.assignedNurseIds
    .map((id) => nurseById(id)?.name)
    .filter((name): name is string => Boolean(name));
}

export function formatRequestWindow(request: ServiceRequestRecord): string {
  return `${format(new Date(request.startDate), "d MMM yyyy")} - ${format(new Date(request.endDate), "d MMM yyyy")}`;
}

export function getEventsForServiceRequestInRange(
  requestId: string,
  rangeStart: Date,
  rangeEnd: Date
): ScheduleEventRecord[] {
  const request = getServiceRequestById(requestId);
  if (!request) return [];

  return buildEventsForServiceRequest(request).filter((e) => {
    const s = new Date(e.start);
    const end = new Date(e.end);
    return rangesOverlap(s, end, rangeStart, rangeEnd);
  });
}

export function parseEventRange(e: ScheduleEventRecord): { start: Date; end: Date } {
  return { start: new Date(e.start), end: new Date(e.end) };
}
