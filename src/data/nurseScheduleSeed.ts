import {
  addDays,
  addHours,
  addMinutes,
  format,
  isAfter,
  startOfDay,
} from "date-fns";

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

function overlapsRange(aStart: Date, aEnd: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return aStart < rangeEnd && aEnd > rangeStart;
}

function buildEventsForServiceRequest(request: ServiceRequestRecord): ScheduleEventRecord[] {
  const start = startOfDay(new Date(request.startDate));
  const end = startOfDay(new Date(request.endDate));
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);

  const events: ScheduleEventRecord[] = [];

  for (let day = 0; day < totalDays; day += 1) {
    const dayBase = addDays(start, day);

    request.assignedNurseIds.forEach((nurseId, nurseIndex) => {
      const nurse = nurseById(nurseId);
      if (!nurse) return;

      const shiftStart = addHours(addMinutes(dayBase, nurseIndex * 30), 7);
      const shiftMid = addHours(shiftStart, 4);
      const breakStart = addHours(shiftMid, 1);
      const breakEnd = addMinutes(breakStart, 30);
      const handoverStart = addHours(shiftMid, 2);
      const handoverEnd = addHours(handoverStart, 1);

      events.push(
        {
          id: `${request.id}-${nurseId}-${day}-visit`,
          requestId: request.id,
          nurseId,
          nurseName: nurse.name,
          title: `${nurse.name.split(" ")[0]} ? Home visit`,
          start: shiftStart.toISOString(),
          end: shiftMid.toISOString(),
          type: "visit",
        },
        {
          id: `${request.id}-${nurseId}-${day}-break`,
          requestId: request.id,
          nurseId,
          nurseName: nurse.name,
          title: `${nurse.name.split(" ")[0]} ? Break`,
          start: breakStart.toISOString(),
          end: breakEnd.toISOString(),
          type: "break",
        },
        {
          id: `${request.id}-${nurseId}-${day}-handover`,
          requestId: request.id,
          nurseId,
          nurseName: nurse.name,
          title: `${nurse.name.split(" ")[0]} ? Handover`,
          start: handoverStart.toISOString(),
          end: handoverEnd.toISOString(),
          type: "training",
        }
      );
    });
  }

  return events.filter((e) => !isAfter(new Date(e.start), new Date(request.endDate)));
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

export function shiftCapacityForSlotHours(slotHours: number): number {
  if (slotHours === 12) return 2;
  if (slotHours === 8) return 3;
  return 8;
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
    return overlapsRange(s, end, rangeStart, rangeEnd);
  });
}

export function parseEventRange(e: ScheduleEventRecord): { start: Date; end: Date } {
  return { start: new Date(e.start), end: new Date(e.end) };
}
