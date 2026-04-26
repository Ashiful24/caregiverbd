import type { NurseRecord, ScheduleEventRecord } from "../data/nurseScheduleSeed";
import { filterAvailableNursesLocal, getNurses } from "../data/nurseScheduleSeed";
import { serviceRequestScheduleApi } from "./api";

function normalizeNurseRows(data: unknown): NurseRecord[] {
  const raw = Array.isArray(data) ? data : (data as { nurses?: unknown })?.nurses;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ""),
      name: String(r.name ?? ""),
      unit: String(r.unit ?? ""),
    }))
    .filter((n) => n.id && n.name);
}

/**
 * Fetches nurses available for [rangeStart, rangeEnd). Tries the admin API first, then applies
 * local overlap rules against `existingEvents`; on failure, uses all demo nurses + local filter.
 */
export async function fetchAvailableNursesForAssignment(
  requestId: string,
  rangeStart: Date,
  rangeEnd: Date,
  existingEvents: ScheduleEventRecord[],
  signal?: AbortSignal
): Promise<NurseRecord[]> {
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  try {
    const res = await serviceRequestScheduleApi.getAvailableNurses(
      requestId,
      { startDate: startIso, endDate: endIso },
      signal
    );
    const fromApi = normalizeNurseRows(res.data);
    if (fromApi.length === 0) return [];
    return filterAvailableNursesLocal(fromApi, existingEvents, rangeStart, rangeEnd);
  } catch {
    return filterAvailableNursesLocal(getNurses(), existingEvents, rangeStart, rangeEnd);
  }
}
