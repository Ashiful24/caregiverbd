/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import clsx from "clsx";
import { Heart, MapPin, Moon, Radio, Search as SearchIcon, SearchX, SlidersHorizontal, Sun, Sunrise, X } from "lucide-react";
import { patientApi } from "../api";
import { addDays, fmtDate, fmtTime, taka, today } from "../format";
import { useApi } from "../hooks";
import { Avatar, Button, Card, Empty, ErrorBox, Loading, Screen, Sheet, Stars } from "../ui";

const FEE_UNIT: Record<string, string> = { CONSULTATION: "/visit", HOURLY: "/hour", SHIFT_8H: "/8h shift", SHIFT_12H: "/12h shift" };

type Sort = "nearest" | "rating" | "fee" | "experience";
type TimeOfDay = "" | "morning" | "afternoon" | "evening";
type Filters = { sort: Sort; radius: number; timeOfDay: TimeOfDay; gender: "" | "FEMALE" | "MALE"; minRating: number; onlineOnly: boolean };

const DEFAULTS: Filters = { sort: "nearest", radius: 20, timeOfDay: "", gender: "", minRating: 0, onlineOnly: false };

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "nearest", label: "Nearest" },
  { value: "rating", label: "Top rated" },
  { value: "fee", label: "Lowest fee" },
  { value: "experience", label: "Most experienced" },
];

const TIMES: Array<{ value: Exclude<TimeOfDay, "">; label: string; hint: string; icon: React.ReactNode; from: string; to: string }> = [
  { value: "morning", label: "Morning", hint: "6 AM – 12 PM", icon: <Sunrise size={18} />, from: "06:00", to: "12:00" },
  { value: "afternoon", label: "Afternoon", hint: "12 – 5 PM", icon: <Sun size={18} />, from: "12:00", to: "17:00" },
  { value: "evening", label: "Evening", hint: "5 – 11 PM", icon: <Moon size={18} />, from: "17:00", to: "23:59" },
];

const CATEGORY_LABEL: Record<string, string> = { DOCTOR: "Doctors", NURSING_CARE: "Nursing", CAREGIVER: "Caregivers", PHYSIOTHERAPY: "Physio" };

function inTime(slot: any, t: TimeOfDay) {
  if (!t) return true;
  const r = TIMES.find((x) => x.value === t)!;
  return slot.startTime >= r.from && slot.startTime < r.to;
}

/** Client-side refinements on top of the server search (which already handles type, date and radius). */
function applyFilters(rows: any[], f: Filters, q: string) {
  const needle = q.trim().toLowerCase();
  const out = rows
    .filter((p) => !needle || `${p.providerName} ${p.consultationTypeName}`.toLowerCase().includes(needle))
    .filter((p) => p.distance == null || p.distance <= f.radius)
    .filter((p) => !f.gender || p.gender === f.gender)
    .filter((p) => p.averageRating >= f.minRating)
    .filter((p) => !f.onlineOnly || p.isOnline)
    .map((p) => ({ ...p, matchingSlots: p.availableSlots.filter((s: any) => inTime(s, f.timeOfDay)) }))
    .filter((p) => !f.timeOfDay || p.matchingSlots.length > 0);
  const by: Record<Sort, (a: any, b: any) => number> = {
    nearest: (a, b) => (a.distance ?? 0) - (b.distance ?? 0),
    rating: (a, b) => b.averageRating - a.averageRating,
    fee: (a, b) => a.currentFee - b.currentFee,
    experience: (a, b) => b.experience - a.experience,
  };
  return out.sort(by[f.sort]);
}

function countActive(f: Filters) {
  return (
    Number(f.radius !== DEFAULTS.radius) +
    Number(Boolean(f.timeOfDay)) +
    Number(Boolean(f.gender)) +
    Number(f.minRating > 0) +
    Number(f.onlineOnly)
  );
}

function OptionGroup<T extends string | number>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: React.ReactNode }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "rounded-xl border px-3.5 py-2 text-sm font-medium transition",
            value === o.value
              ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between first:mt-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{children}</p>
      {aside}
    </div>
  );
}

export function Search() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const typeParam = Number(params.get("type") ?? 0);
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [draft, setDraft] = useState<Filters>(DEFAULTS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const types = useApi(() => patientApi.get<any[]>("/consultation-types"), []);
  const roots = types.data ?? [];
  // `?type=` may point at a category (root) or a specialty (leaf).
  const activeRoot = roots.find((r) => r.id === typeParam || r.children.some((c: any) => c.id === typeParam));
  const activeLeaf = activeRoot?.children.find((c: any) => c.id === typeParam);
  const typeIds: number[] = activeLeaf ? [activeLeaf.id] : activeRoot ? (activeRoot.children.length ? activeRoot.children.map((c: any) => c.id) : [activeRoot.id]) : [];

  const results = useApi(
    () => patientApi.post<{ data: any[] }>("/providers/search", { consultationTypeId: typeIds, date: date || undefined, radiusKm: 20, limit: 60 }),
    [typeIds.join(","), date]
  );
  const rows = useMemo(() => applyFilters(results.data?.data ?? [], filters, query), [results.data, filters, query]);
  const draftCount = useMemo(() => applyFilters(results.data?.data ?? [], draft, query).length, [results.data, draft, query]);
  const active = countActive(filters);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
  const openRequestUrl = `/app/patient/open-request${activeLeaf ? `?type=${activeLeaf.id}` : ""}`;

  const pills: Array<{ label: string; clear: Partial<Filters> }> = [
    filters.timeOfDay && { label: TIMES.find((t) => t.value === filters.timeOfDay)!.label, clear: { timeOfDay: "" as TimeOfDay } },
    filters.gender && { label: filters.gender === "FEMALE" ? "Female" : "Male", clear: { gender: "" as Filters["gender"] } },
    filters.minRating > 0 && { label: `${filters.minRating}+ rating`, clear: { minRating: 0 } },
    filters.radius !== DEFAULTS.radius && { label: `Within ${filters.radius} km`, clear: { radius: DEFAULTS.radius } },
    filters.onlineOnly && { label: "Online now", clear: { onlineOnly: false } },
  ].filter(Boolean) as Array<{ label: string; clear: Partial<Filters> }>;

  return (
    <Screen title="Find a provider" back="/app/patient" subtitle="Near Dhanmondi, Dhaka">
      {/* search + filter button */}
      <div className="mb-4 flex gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900">
          <SearchIcon size={17} className="shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or specialty"
            aria-label="Search providers"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => {
            setDraft(filters);
            setSheetOpen(true);
          }}
          aria-label={`Filters${active ? `, ${active} active` : ""}`}
          className={clsx(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition",
            active ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          )}
        >
          <SlidersHorizontal size={18} />
          {active > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-gray-950">
              {active}
            </span>
          )}
        </button>
      </div>

      {/* category tabs */}
      <div className="-mx-4 mb-3 flex gap-5 overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-800" role="tablist" aria-label="Category">
        {[{ id: 0, code: "ALL", name: "All" }, ...roots].map((r: any) => {
          const selected = r.id === 0 ? !activeRoot : activeRoot?.id === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setParams(r.id ? { type: String(r.id) } : {})}
              className={clsx(
                "-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-semibold transition",
                selected ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              )}
            >
              {CATEGORY_LABEL[r.code] ?? r.name}
            </button>
          );
        })}
      </div>

      {/* specialties of the selected category */}
      {activeRoot && activeRoot.children.length > 0 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: activeRoot.id, name: `All ${CATEGORY_LABEL[activeRoot.code] ?? activeRoot.name}` }, ...activeRoot.children].map((c: any) => {
            const selected = c.id === activeRoot.id ? !activeLeaf : activeLeaf?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setParams({ type: String(c.id) })}
                className={clsx(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  selected ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* availability day strip */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {["", ...days].map((d, i) => {
          const selected = date === d;
          return (
            <button
              key={d || "any"}
              type="button"
              aria-pressed={selected}
              onClick={() => setDate(d)}
              className={clsx(
                "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border text-center transition",
                selected ? "border-brand-500 bg-brand-500 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              )}
            >
              {d ? (
                <>
                  <span className={clsx("text-[10px] font-medium uppercase", selected ? "text-white/80" : "text-gray-400")}>
                    {i === 1 ? "Today" : fmtDate(d, { weekday: "short" })}
                  </span>
                  <span className="text-base font-semibold leading-tight">{fmtDate(d, { day: "numeric" })}</span>
                </>
              ) : (
                <span className="text-xs font-semibold leading-tight">
                  Any
                  <br />
                  day
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* result summary + active filter pills */}
      {results.data && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {rows.length} {rows.length === 1 ? "provider" : "providers"}
              {date ? ` free on ${fmtDate(date)}` : ""}
            </p>
            <label className="flex items-center gap-1 text-gray-500">
              Sort
              <select
                value={filters.sort}
                onChange={(e) => setFilters({ ...filters, sort: e.target.value as Sort })}
                className="rounded-md bg-transparent font-semibold text-gray-900 outline-none dark:text-white"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {pills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pills.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setFilters({ ...filters, ...p.clear })}
                  className="flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                >
                  {p.label} <X size={12} />
                </button>
              ))}
              <button type="button" onClick={() => setFilters({ ...DEFAULTS, sort: filters.sort })} className="px-1.5 text-[11px] font-medium text-gray-500 underline">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {results.loading && !results.data ? (
        <Loading />
      ) : results.error ? (
        <ErrorBox message={results.error} onRetry={results.reload} />
      ) : !rows.length ? (
        <Empty
          icon={<SearchX size={40} />}
          title="No providers match"
          text={active || query ? "Try removing a filter, or send an open request to every nearby provider." : "Try another day or service, or send an open request to nearby providers."}
          action={
            <div className="flex flex-col gap-2">
              {(active > 0 || query) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilters({ ...DEFAULTS, sort: filters.sort });
                    setQuery("");
                  }}
                >
                  Clear filters
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate(openRequestUrl)}>
                Send open request
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((p) => (
            <Card key={p.id} onClick={() => navigate(`/app/patient/providers/${p.id}${date ? `?date=${date}` : ""}`)}>
              <div className="flex gap-3">
                <div className="relative">
                  <Avatar name={p.providerName} />
                  {p.isOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-brand-500 dark:border-gray-900" title="Online" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{p.providerName}</p>
                    {p.isLiked && <Heart size={15} className="shrink-0 fill-red-500 text-red-500" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {p.consultationTypeName} · {p.experience} yrs exp
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <Stars value={p.averageRating} count={p.totalReviews} />
                    <span className="flex items-center gap-0.5 text-xs text-gray-500">
                      <MapPin size={12} /> {p.distance} km
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{taka(p.currentFee)}</p>
                  <p className="text-[11px] text-gray-400">{FEE_UNIT[p.feeType] ?? ""}</p>
                </div>
              </div>
              {p.matchingSlots.length > 0 && (
                <div className="mt-3 flex gap-1.5 overflow-hidden">
                  {p.matchingSlots.slice(0, 3).map((s: any) => (
                    <span key={s.id} className="shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      {fmtDate(s.date, { weekday: "short", day: "numeric" })} {fmtTime(s.startTime)}
                    </span>
                  ))}
                  {p.matchingSlots.length > 3 && <span className="shrink-0 px-1 py-1 text-[11px] text-gray-400">+{p.matchingSlots.length - 3} more</span>}
                </div>
              )}
            </Card>
          ))}
          <Button variant="ghost" onClick={() => navigate(openRequestUrl)}>
            <Radio size={16} /> Or send an open request to nearby providers
          </Button>
        </div>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters">
        <FilterLabel>Sort by</FilterLabel>
        <OptionGroup value={draft.sort} onChange={(sort) => setDraft({ ...draft, sort })} options={SORTS} />

        <FilterLabel aside={<span className="text-sm font-semibold text-gray-900 dark:text-white">{draft.radius} km</span>}>Distance</FilterLabel>
        <input
          type="range"
          min={2}
          max={20}
          step={1}
          value={draft.radius}
          onChange={(e) => setDraft({ ...draft, radius: Number(e.target.value) })}
          aria-label="Maximum distance in km"
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>2 km</span>
          <span>20 km</span>
        </div>

        <FilterLabel>Time of day</FilterLabel>
        <div className="grid grid-cols-3 gap-2">
          {TIMES.map((t) => {
            const selected = draft.timeOfDay === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setDraft({ ...draft, timeOfDay: selected ? "" : t.value })}
                className={clsx(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition",
                  selected ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200"
                )}
              >
                {t.icon}
                <span className="text-xs font-semibold">{t.label}</span>
                <span className="text-[10px] text-gray-400">{t.hint}</span>
              </button>
            );
          })}
        </div>

        <FilterLabel>Provider gender</FilterLabel>
        <OptionGroup
          value={draft.gender}
          onChange={(gender) => setDraft({ ...draft, gender })}
          options={[
            { value: "", label: "Any" },
            { value: "FEMALE", label: "Female" },
            { value: "MALE", label: "Male" },
          ]}
        />

        <FilterLabel>Rating</FilterLabel>
        <OptionGroup
          value={draft.minRating}
          onChange={(minRating) => setDraft({ ...draft, minRating })}
          options={[
            { value: 0, label: "Any" },
            { value: 4, label: "4.0+ ★" },
            { value: 4.5, label: "4.5+ ★" },
          ]}
        />

        <label className="mt-5 flex items-center justify-between rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-700">
          <span>
            <span className="block text-sm font-semibold text-gray-900 dark:text-white">Online now</span>
            <span className="block text-xs text-gray-500">Providers active in the app right now</span>
          </span>
          <input type="checkbox" checked={draft.onlineOnly} onChange={(e) => setDraft({ ...draft, onlineOnly: e.target.checked })} className="h-5 w-5 accent-brand-500" />
        </label>

        <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" onClick={() => setDraft({ ...DEFAULTS })}>
            Reset
          </Button>
          <Button
            onClick={() => {
              setFilters(draft);
              setSheetOpen(false);
            }}
          >
            Show {draftCount} {draftCount === 1 ? "provider" : "providers"}
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
