/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * In-memory demo database. Generated once from a fixed seed, so every reload
 * shows the same data; edits made in the UI live until the page is refreshed.
 */
import {
  AREAS,
  FIRST_NAMES_F,
  FIRST_NAMES_M,
  LAST_NAMES,
  createRng,
  dayOffset,
  eachDay,
  hhmm,
  iso,
  money,
  ymd,
} from "./utils";

export type Row = Record<string, any>;

const rng = createRng(20261015);

// ---------------------------------------------------------------- users

export const ADMIN_USER: Row = {
  id: 1,
  email: "admin@hope.demo",
  username: "admin",
  firstName: "Ashiful",
  lastName: "Islam",
  role: "ADMIN",
  isActive: true,
  createdAt: iso(dayOffset(-400)),
  updatedAt: iso(dayOffset(-5)),
};

const SUPERVISOR_SEED = [
  ["Nadia", "Rahman", "F", "Dhaka North"],
  ["Kamrul", "Hasan", "M", "Dhaka South"],
  ["Sharmin", "Akter", "F", "Gulshan & Banani"],
  ["Tanvir", "Ahmed", "M", "Uttara"],
  ["Rokeya", "Begum", "F", "Mirpur"],
] as const;

export const supervisors: Row[] = SUPERVISOR_SEED.map(([firstName, lastName, , region], i) => {
  const id = 10 + i;
  return {
    id,
    userId: id,
    firstName,
    lastName,
    email: i === 0 ? "supervisor@hope.demo" : `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hope.demo`,
    username: `01711${String(200000 + id).padStart(6, "0")}`,
    phone: `+880 1711-${String(200000 + id).slice(0, 3)}${String(id).padStart(3, "0")}`,
    region,
    teamSize: 0,
    status: i === 4 ? "ON_LEAVE" : "ACTIVE",
    isActive: true,
    joinedAt: ymd(dayOffset(-300 + i * 40)),
    createdAt: iso(dayOffset(-300 + i * 40)),
  };
});

// ---------------------------------------------------------------- consultation types

export const consultationTypes: Row[] = [
  { id: 1, name: "Doctor Consultation", nameBn: "ডাক্তার পরামর্শ", code: "DOCTOR", parentId: null, employmentType: "FREELANCE", platformCommissionPercent: 15, description: "Home visit and video consultation with registered doctors" },
  { id: 2, name: "General Physician", nameBn: "সাধারণ চিকিৎসক", code: "GENERAL_PHYSICIAN", parentId: 1, employmentType: "FREELANCE", platformCommissionPercent: 15, description: "Primary care and common illnesses" },
  { id: 3, name: "Pediatrician", nameBn: "শিশু বিশেষজ্ঞ", code: "PEDIATRICIAN", parentId: 1, employmentType: "FREELANCE", platformCommissionPercent: 15, description: "Care for infants and children" },
  { id: 4, name: "Cardiologist", nameBn: "হৃদরোগ বিশেষজ্ঞ", code: "CARDIOLOGIST", parentId: 1, employmentType: "FREELANCE", platformCommissionPercent: 18, description: "Heart and blood pressure care" },
  { id: 5, name: "Gynecologist", nameBn: "স্ত্রীরোগ বিশেষজ্ঞ", code: "GYNECOLOGIST", parentId: 1, employmentType: "FREELANCE", platformCommissionPercent: 15, description: "Women's health and maternity care" },
  { id: 6, name: "Nursing Care", nameBn: "নার্সিং কেয়ার", code: "NURSING_CARE", parentId: null, employmentType: "FULL_TIME", platformCommissionPercent: 12, description: "Registered nurses for home care" },
  { id: 7, name: "Elderly Care Nurse", nameBn: "বয়স্ক সেবা নার্স", code: "ELDERLY_CARE", parentId: 6, employmentType: "FULL_TIME", platformCommissionPercent: 12, description: "Daily care for elderly patients" },
  { id: 8, name: "Post-Operative Care", nameBn: "অপারেশন পরবর্তী সেবা", code: "POST_OP_CARE", parentId: 6, employmentType: "FULL_TIME", platformCommissionPercent: 12, description: "Wound care and recovery support" },
  { id: 9, name: "ICU Nursing", nameBn: "আইসিইউ নার্সিং", code: "ICU_NURSING", parentId: 6, employmentType: "FULL_TIME", platformCommissionPercent: 14, description: "Critical care at home" },
  { id: 10, name: "Caregiver", nameBn: "কেয়ারগিভার", code: "CAREGIVER", parentId: null, employmentType: "FULL_TIME", platformCommissionPercent: 10, description: "Trained attendants for daily living support" },
  { id: 11, name: "Baby Care", nameBn: "শিশু যত্ন", code: "BABY_CARE", parentId: 10, employmentType: "FULL_TIME", platformCommissionPercent: 10, description: "Newborn and infant care" },
  { id: 12, name: "Patient Attendant", nameBn: "রোগী সহায়ক", code: "PATIENT_ATTENDANT", parentId: 10, employmentType: "FULL_TIME", platformCommissionPercent: 10, description: "Bedside assistance and mobility support" },
  { id: 13, name: "Physiotherapy", nameBn: "ফিজিওথেরাপি", code: "PHYSIOTHERAPY", parentId: null, employmentType: "FREELANCE", platformCommissionPercent: 15, description: "Rehabilitation sessions at home" },
].map((t, i) => ({
  ...t,
  priority: i,
  imageUrl: null,
  createdAt: iso(dayOffset(-380)),
  updatedAt: iso(dayOffset(-30)),
}));

export function consultationTypeName(id: unknown): string {
  return consultationTypes.find((t) => t.id === Number(id))?.name ?? "Consultation";
}

/** Top-level category used by levels, cancellation policies and reporting. */
export function categoryOfType(id: unknown): "DOCTOR" | "CAREGIVER" {
  const t = consultationTypes.find((x) => x.id === Number(id));
  const root = t?.parentId ? t.parentId : t?.id;
  return root === 1 ? "DOCTOR" : "CAREGIVER";
}

const DOCTOR_TYPES = [2, 3, 4, 5];
const NURSE_TYPES = [7, 8, 9];
const CAREGIVER_TYPES = [11, 12];

// ---------------------------------------------------------------- levels, groups, checklists

export const levels: Row[] = [
  { id: 1, name: "Junior Doctor", nameBn: "জুনিয়র ডাক্তার", levelNumber: 1, category: "DOCTOR", minSalary: 40000, maxSalary: 60000 },
  { id: 2, name: "Medical Officer", nameBn: "মেডিকেল অফিসার", levelNumber: 2, category: "DOCTOR", minSalary: 60000, maxSalary: 90000 },
  { id: 3, name: "Consultant", nameBn: "কনসালটেন্ট", levelNumber: 3, category: "DOCTOR", minSalary: 90000, maxSalary: 150000 },
  { id: 4, name: "Assistant Nurse", nameBn: "সহকারী নার্স", levelNumber: 1, category: "CAREGIVER", minSalary: 18000, maxSalary: 25000 },
  { id: 5, name: "Staff Nurse", nameBn: "স্টাফ নার্স", levelNumber: 2, category: "CAREGIVER", minSalary: 25000, maxSalary: 35000 },
  { id: 6, name: "Senior Staff Nurse", nameBn: "সিনিয়র স্টাফ নার্স", levelNumber: 3, category: "CAREGIVER", minSalary: 35000, maxSalary: 50000 },
];

export const checklistGroups: Row[] = [
  { id: 1, name: "Vital Signs", nameBn: "ভাইটাল সাইন", description: "Routine vital measurements", descriptionBn: "নিয়মিত ভাইটাল পরিমাপ" },
  { id: 2, name: "Personal Care", nameBn: "ব্যক্তিগত যত্ন", description: "Hygiene and comfort tasks", descriptionBn: "পরিচ্ছন্নতা ও আরাম" },
  { id: 3, name: "Medication", nameBn: "ওষুধ", description: "Medicine administration", descriptionBn: "ওষুধ প্রদান" },
  { id: 4, name: "Mobility", nameBn: "চলাচল", description: "Movement and exercise support", descriptionBn: "চলাচল ও ব্যায়াম সহায়তা" },
].map((g) => ({ ...g, createdAt: iso(dayOffset(-200)), updatedAt: iso(dayOffset(-20)) }));

const CHECKLIST_TEMPLATE: Array<[string, string, "CHECKLIST" | "VITALS", number]> = [
  ["Blood pressure", "রক্তচাপ", "VITALS", 1],
  ["Blood sugar", "রক্তে শর্করা", "VITALS", 1],
  ["Temperature", "তাপমাত্রা", "VITALS", 1],
  ["Bathing & hygiene", "গোসল ও পরিচ্ছন্নতা", "CHECKLIST", 2],
  ["Feeding assistance", "খাওয়ানোর সহায়তা", "CHECKLIST", 2],
  ["Oral medication", "মুখে খাওয়ার ওষুধ", "CHECKLIST", 3],
  ["Injection / IV", "ইনজেকশন / আইভি", "CHECKLIST", 3],
  ["Assisted walking", "হাঁটতে সহায়তা", "CHECKLIST", 4],
];

let checklistId = 1;
export const serviceChecklists: Row[] = consultationTypes
  .filter((t) => t.parentId != null || t.id === 13)
  .flatMap((t) =>
    CHECKLIST_TEMPLATE.slice(0, t.parentId === 1 ? 3 : 8).map(([name, nameBn, type, groupId], i) => ({
      id: checklistId++,
      consultationTypeId: t.id,
      name,
      nameBn,
      description: null,
      descriptionBn: null,
      type,
      isActive: true,
      displayOrder: i + 1,
      groupId,
    }))
  );

/** key = `${consultationTypeId}:${levelId}` */
export const levelChecklistMap = new Map<string, number[]>();

export const verificationDocTypes: Row[] = [
  ["NID", "National ID Card", "জাতীয় পরিচয়পত্র"],
  ["BMDC_CERTIFICATE", "BMDC Registration", "বিএমডিসি নিবন্ধন"],
  ["BNMC_CERTIFICATE", "BNMC Registration", "বিএনএমসি নিবন্ধন"],
  ["MBBS_CERTIFICATE", "MBBS Certificate", "এমবিবিএস সনদ"],
  ["NURSING_DIPLOMA", "Nursing Diploma", "নার্সিং ডিপ্লোমা"],
  ["POLICE_CLEARANCE", "Police Clearance", "পুলিশ ক্লিয়ারেন্স"],
  ["PHOTO", "Passport Size Photo", "পাসপোর্ট সাইজ ছবি"],
].map(([code, label, labelBn], i) => ({
  id: i + 1,
  code,
  label,
  labelBn,
  isActive: code !== "POLICE_CLEARANCE",
  displayOrder: i + 1,
  createdAt: iso(dayOffset(-250)),
  updatedAt: iso(dayOffset(-40)),
}));

export const certificationTypes: Row[] = [
  ["BLS", "Basic Life Support", "বেসিক লাইফ সাপোর্ট", "AHA/BLS certified"],
  ["ACLS", "Advanced Cardiac Life Support", "অ্যাডভান্সড কার্ডিয়াক লাইফ সাপোর্ট", "For ICU and cardiac care"],
  ["BNMC", "BNMC Nursing License", "বিএনএমসি নার্সিং লাইসেন্স", "Bangladesh Nursing & Midwifery Council"],
  ["FIRST_AID", "First Aid", "প্রাথমিক চিকিৎসা", "Red Crescent first aid"],
  ["ELDER_CARE", "Elderly Care Training", "বয়স্ক সেবা প্রশিক্ষণ", "Geriatric care course"],
].map(([code, name, nameBn, description], i) => ({
  id: i + 1,
  code,
  name,
  nameBn,
  description,
  descriptionBn: null,
  isActive: true,
  createdAt: iso(dayOffset(-250)),
  updatedAt: iso(dayOffset(-60)),
}));

let reqId = 1;
export const verificationRequirements: Row[] = consultationTypes
  .filter((t) => t.parentId != null || t.id === 13)
  .flatMap((t) => {
    const codes = categoryOfType(t.id) === "DOCTOR"
      ? ["NID", "BMDC_CERTIFICATE", "MBBS_CERTIFICATE", "PHOTO"]
      : ["NID", "BNMC_CERTIFICATE", "NURSING_DIPLOMA", "PHOTO"];
    return codes.map((documentType, i) => ({
      id: reqId++,
      consultationTypeId: t.id,
      documentType,
      isRequired: documentType !== "PHOTO",
      displayOrder: i + 1,
    }));
  });

let certReqId = 1;
export const certificationRequirements: Row[] = consultationTypes
  .filter((t) => t.parentId === 6 || t.parentId === 10)
  .flatMap((t) =>
    [3, 4].map((certificationTypeId) => ({
      id: certReqId++,
      consultationTypeId: t.id,
      certificationTypeId,
      isRequired: certificationTypeId === 3,
    }))
  );

// ---------------------------------------------------------------- providers

const PROVIDER_STATUSES = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "PENDING", "PENDING", "REJECTED", "ARCHIVED"];

export const providers: Row[] = Array.from({ length: 42 }, (_, i) => {
  const id = i + 1;
  const isDoctor = i < 14;
  const isNurse = i >= 14 && i < 34;
  const female = isDoctor ? rng.chance(0.45) : rng.chance(0.8);
  const firstName = rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
  const lastName = rng.pick(LAST_NAMES);
  const consultationTypeId = isDoctor ? rng.pick(DOCTOR_TYPES) : isNurse ? rng.pick(NURSE_TYPES) : rng.pick(CAREGIVER_TYPES);
  const status = i < 6 ? "ACTIVE" : rng.pick(PROVIDER_STATUSES);
  const createdAt = dayOffset(-rng.int(20, 360));
  const rateType = isDoctor ? "CONSULTATION" : rng.pick(["SHIFT_8H", "SHIFT_12H", "HOURLY"]);
  const rate = isDoctor ? rng.pick([800, 1000, 1200, 1500, 2000]) : rateType === "HOURLY" ? rng.pick([250, 300, 350]) : rng.pick([1800, 2200, 2500, 3000]);
  const [lat, lng] = [23.75 + rng.next() * 0.1, 90.36 + rng.next() * 0.08];
  return {
    id,
    userId: 100 + id,
    firstName: isDoctor ? `Dr. ${firstName}` : firstName,
    lastName,
    gender: female ? "FEMALE" : "MALE",
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${id}@hope.demo`,
    username: `017${String(10000000 + id * 7919).slice(0, 8)}`,
    bmdcNumber: isDoctor ? `A-${rng.int(30000, 99999)}` : `BNMC-${rng.int(10000, 99999)}`,
    experience: rng.int(1, 18),
    status,
    consultationTypeId,
    consultationTypeName: consultationTypeName(consultationTypeId),
    rate: money(rate),
    billingRateType: rateType,
    levelId: status === "ACTIVE" ? (isDoctor ? rng.pick([1, 2, 3]) : rng.pick([4, 5, 6])) : null,
    latitude: lat.toFixed(6),
    longitude: lng.toFixed(6),
    serviceRadiusKm: String(rng.pick([5, 8, 10, 15])),
    supervisorId: null as number | null,
    profilePicture: null,
    createdAt: iso(createdAt),
    updatedAt: iso(dayOffset(-rng.int(0, 20))),
  };
});

// Assign active nurses / caregivers to supervisors.
providers
  .filter((p) => categoryOfType(p.consultationTypeId) === "CAREGIVER" && p.status === "ACTIVE")
  .forEach((p, i) => {
    if (i % 6 !== 5) p.supervisorId = supervisors[i % supervisors.length].id;
  });
supervisors.forEach((s) => {
  s.teamSize = providers.filter((p) => p.supervisorId === s.id).length;
});

export function providerName(p: Row | undefined | null): string {
  return p ? `${p.firstName} ${p.lastName}` : "—";
}

export function findProvider(id: unknown): Row | undefined {
  return providers.find((p) => p.id === Number(id));
}

// ---------------------------------------------------------------- patients

export const patients: Row[] = Array.from({ length: 34 }, (_, i) => {
  const id = i + 1;
  const female = rng.chance(0.5);
  const firstName = rng.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
  const lastName = rng.pick(LAST_NAMES);
  return {
    id,
    userId: 500 + id,
    firstName,
    lastName,
    gender: female ? "FEMALE" : "MALE",
    email: rng.chance(0.6) ? `${firstName.toLowerCase()}${id}@gmail.com` : undefined,
    username: `018${String(20000000 + id * 104729).slice(0, 8)}`,
    nidNumber: String(rng.int(1000000000, 9999999999)),
    isFaceVerified: rng.chance(0.7),
    status: i % 9 === 8 ? "PENDING" : "ACTIVE",
    isActive: i % 13 !== 12,
    address: rng.pick(AREAS),
    createdAt: iso(dayOffset(-rng.int(5, 340))),
    updatedAt: iso(dayOffset(-rng.int(0, 5))),
  };
});

export function patientName(p: Row | undefined | null): string {
  return p ? `${p.firstName} ${p.lastName}` : "—";
}

export function findPatient(id: unknown): Row | undefined {
  return patients.find((p) => p.id === Number(id));
}

// ---------------------------------------------------------------- short-term service requests (appointments)

const activeProviders = providers.filter((p) => p.status === "ACTIVE");

export const serviceRequests: Row[] = Array.from({ length: 96 }, (_, i) => {
  const id = 5000 + i + 1;
  const offset = rng.int(-75, 12);
  const scheduled = dayOffset(offset, rng.int(8, 20), rng.pick([0, 30]));
  const provider = rng.pick(activeProviders);
  const patient = rng.pick(patients);
  let status: string;
  if (offset < -1) status = rng.pick(["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "CANCELLED", "REJECTED"]);
  else if (offset <= 0) status = rng.pick(["IN_PROGRESS", "COMPLETED", "ACCEPTED"]);
  else status = rng.pick(["PENDING", "PENDING", "ACCEPTED"]);
  const fee = num2(provider.rate) * (provider.billingRateType === "HOURLY" ? rng.pick([4, 6, 8]) : 1);
  const hasProvider = status !== "PENDING" || rng.chance(0.5);
  return {
    id,
    status,
    patientId: patient.id,
    patientName: patientName(patient),
    providerId: hasProvider ? provider.id : null,
    providerName: hasProvider ? providerName(provider) : null,
    consultationTypeId: provider.consultationTypeId,
    consultationTypeName: provider.consultationTypeName,
    amount: money(fee),
    fee: money(fee),
    paymentMethod: rng.chance(0.75) ? "ONLINE" : "CASH",
    scheduledAt: iso(scheduled),
    scheduledDate: ymd(scheduled),
    scheduledTime: hhmm(scheduled),
    latitude: provider.latitude,
    longitude: provider.longitude,
    address: patient.address,
    description: rng.pick(["Fever and cough for 3 days", "Routine check-up", "Blood pressure follow-up", "Post-surgery dressing", "Child vaccination advice", "Back pain physiotherapy", null]),
    startedAt: ["IN_PROGRESS", "COMPLETED"].includes(status) ? iso(scheduled) : null,
    completedAt: status === "COMPLETED" ? iso(new Date(scheduled.getTime() + 60 * 60 * 1000)) : null,
    createdAt: iso(dayOffset(offset - rng.int(1, 4), rng.int(8, 22))),
    longTermOpportunityId: null,
  };
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

function num2(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------- long-term opportunities

const LTO_STATUSES = [
  "REQUESTED", "REQUESTED", "SCHEDULE_PROPOSED", "CHANGE_REQUESTED", "PAYMENT_PENDING",
  "PAID", "IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS", "COMPLETED", "COMPLETED", "CANCELLED",
  "EXPIRED", "REQUESTED", "PAID", "IN_PROGRESS", "REJECTED", "SCHEDULE_PROPOSED",
];

const caregiverProviders = activeProviders.filter((p) => categoryOfType(p.consultationTypeId) === "CAREGIVER");

export const longTermOpportunities: Row[] = LTO_STATUSES.map((status, i) => {
  const id = 900 + i + 1;
  const patient = patients[(i * 5) % patients.length];
  const consultationTypeId = rng.pick([...NURSE_TYPES, ...CAREGIVER_TYPES]);
  let startOffset: number;
  if (status === "COMPLETED" || status === "EXPIRED") startOffset = -rng.int(30, 50);
  else if (status === "IN_PROGRESS") startOffset = -rng.int(3, 10);
  else startOffset = rng.int(2, 12);
  const days = rng.pick([7, 10, 14, 15, 30]);
  const start = dayOffset(startOffset);
  const end = dayOffset(startOffset + days - 1);
  const shiftDurationHours = rng.pick([8, 12, 12, 24]);
  const startHour = rng.pick([8, 9, 20]);
  const perShift = shiftDurationHours === 24 ? 4200 : shiftDurationHours === 12 ? 2600 : 1900;
  const supervisor = ["REQUESTED", "REJECTED"].includes(status) && i % 2 === 0 ? null : supervisors[i % supervisors.length];
  const nurses = ["REQUESTED", "REJECTED", "EXPIRED", "CANCELLED"].includes(status)
    ? []
    : [caregiverProviders[i % caregiverProviders.length], caregiverProviders[(i + 3) % caregiverProviders.length]];
  return {
    id,
    status,
    requestNo: `LTO-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: patientName(patient),
    patient: { id: patient.id, firstName: patient.firstName, lastName: patient.lastName },
    consultationTypeId,
    consultationTypeName: consultationTypeName(consultationTypeId),
    serviceAddressText: patient.address,
    fee: money(perShift * days),
    preferredStartTime: `${startHour > 12 ? startHour - 12 : startHour}:00 ${startHour >= 12 ? "PM" : "AM"}`,
    shiftDurationHours,
    startDate: ymd(start),
    endDate: ymd(end),
    assignedNurses: nurses.map((n) => ({ id: n.id, firstName: n.firstName, lastName: n.lastName })),
    supervisorId: supervisor?.id ?? null,
    supervisorName: supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : null,
    perShiftFee: perShift,
    startHour,
    notes: rng.pick(["Patient is bedridden, needs turning every 2 hours", "Diabetic, insulin twice daily", "Recovering from hip surgery", "Dementia, needs constant supervision", ""]),
    // Requests are always created in the past, even when the service starts later.
    createdAt: iso(dayOffset(Math.min(startOffset - rng.int(3, 8), -1), rng.int(9, 20))),
  };
});

/** Short (2–4 day) requests that just came in and still need a schedule. */
const SHORT_REQUESTED: Array<[days: number, startIn: number, typeId: number, shiftHours: number, startHour: number, supIdx: number | null, note: string]> = [
  [2, 1, 7, 12, 8, 0, "Needs help after cataract surgery, both eyes covered"],
  [3, 2, 8, 12, 9, 1, "Discharged from hospital after appendix surgery, wound dressing daily"],
  [4, 2, 12, 8, 9, null, "Family travelling for 4 days, elderly father needs an attendant"],
  [2, 3, 11, 12, 8, 2, "Newborn twins, mother recovering from C-section"],
  [3, 4, 9, 24, 8, null, "Ventilator support at home, needs ICU-trained nurse round the clock"],
];

SHORT_REQUESTED.forEach(([days, startIn, consultationTypeId, shiftDurationHours, startHour, supIdx, notes], i) => {
  const id = 900 + longTermOpportunities.length + 1;
  const patient = patients[(i * 7 + 3) % patients.length];
  const supervisor = supIdx == null ? null : supervisors[supIdx];
  const perShift = shiftDurationHours === 24 ? 4200 : shiftDurationHours === 12 ? 2600 : 1900;
  longTermOpportunities.push({
    id,
    status: "REQUESTED",
    requestNo: `LTO-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`,
    patientId: patient.id,
    patientName: patientName(patient),
    patient: { id: patient.id, firstName: patient.firstName, lastName: patient.lastName },
    consultationTypeId,
    consultationTypeName: consultationTypeName(consultationTypeId),
    serviceAddressText: patient.address,
    fee: money(perShift * days),
    preferredStartTime: `${startHour > 12 ? startHour - 12 : startHour}:00 ${startHour >= 12 ? "PM" : "AM"}`,
    shiftDurationHours,
    startDate: ymd(dayOffset(startIn)),
    endDate: ymd(dayOffset(startIn + days - 1)),
    assignedNurses: [],
    supervisorId: supervisor?.id ?? null,
    supervisorName: supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : null,
    perShiftFee: perShift,
    startHour,
    notes,
    createdAt: iso(new Date(Date.now() - (i + 1) * 47 * 60 * 1000)),
  });
});

longTermOpportunities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** Calendar slots per opportunity id. */
export const ltoSchedules = new Map<number, Row[]>();
let slotId = 30000;
for (const lto of longTermOpportunities) {
  const rows: Row[] = [];
  if (lto.assignedNurses.length > 0) {
    const days = eachDay(new Date(lto.startDate + "T00:00:00"), new Date(lto.endDate + "T00:00:00"));
    days.forEach((date, idx) => {
      const nurse = lto.assignedNurses[idx % lto.assignedNurses.length];
      const startTime = `${String(lto.startHour).padStart(2, "0")}:00`;
      const endH = (lto.startHour + lto.shiftDurationHours) % 24;
      const endDateObj = new Date(date + "T00:00:00");
      if (lto.startHour + lto.shiftDurationHours >= 24) endDateObj.setDate(endDateObj.getDate() + 1);
      const id = slotId++;
      const isPast = date < ymd(new Date());
      rows.push({
        providerSchedule: {
          id,
          providerId: nurse.id,
          providerName: `${nurse.firstName} ${nurse.lastName}`,
          date,
          startTime,
          endTime: `${String(endH).padStart(2, "0")}:00`,
          start: `${date}T${startTime}:00`,
          end: `${ymd(endDateObj)}T${String(endH).padStart(2, "0")}:00:00`,
          status: "BOOKED",
        },
        serviceRequest: {
          id: 70000 + id,
          status: lto.status === "COMPLETED" || (lto.status === "IN_PROGRESS" && isPast) ? "COMPLETED" : "ACCEPTED",
          fee: money(lto.perShiftFee),
          providerId: nurse.id,
          scheduleSlotId: id,
          longTermCalendarSlotId: id,
        },
      });
    });
  }
  ltoSchedules.set(lto.id, rows);
}

export function nextSlotId(): number {
  return slotId++;
}

// ---------------------------------------------------------------- notifications

const NOTIFICATION_TEMPLATES: Array<[string, string, string]> = [
  ["New provider registration", "Dr. Farhana Haque submitted documents for verification.", "PROVIDER_REGISTERED"],
  ["Withdrawal request", "A provider requested a withdrawal of ৳12,500.", "WITHDRAWAL_REQUESTED"],
  ["Long-term request", "New 15-day elderly care request from Dhanmondi.", "LONG_TERM_REQUESTED"],
  ["Provider cancelled a shift", "A nurse cancelled tomorrow's shift. Review needed.", "PROVIDER_CANCEL_REQUESTED"],
  ["Payment received", "Payment of ৳31,200 received for LTO-0903.", "PAYMENT_RECEIVED"],
  ["Upgrade request", "A staff nurse requested an upgrade to ICU Nursing.", "UPGRADE_REQUESTED"],
  ["Refund failed", "Gateway refund for transaction #8812 failed. Retry scheduled.", "REFUND_FAILED"],
  ["Certification uploaded", "New BLS certificate uploaded for verification.", "CERTIFICATION_UPLOADED"],
];

export const notifications: Row[] = Array.from({ length: 26 }, (_, i) => {
  const [title, body, type] = NOTIFICATION_TEMPLATES[i % NOTIFICATION_TEMPLATES.length];
  const created = new Date(Date.now() - (i * 7 + rng.int(0, 6)) * 60 * 60 * 1000);
  return {
    id: 1000 + i,
    title,
    body,
    type,
    status: i > 22 ? "ARCHIVED" : "ACTIVE",
    readAt: i < 5 ? null : iso(new Date(created.getTime() + 30 * 60 * 1000)),
    data: null,
    createdAt: iso(created),
  };
});

// ---------------------------------------------------------------- withdrawals

const WITHDRAWAL_STATUSES = ["PENDING", "PENDING", "PENDING", "APPROVED", "COMPLETED", "COMPLETED", "COMPLETED", "REJECTED", "CANCELLED"];

export const withdrawals: Row[] = Array.from({ length: 22 }, (_, i) => {
  const p = activeProviders[(i * 3) % activeProviders.length];
  const status = rng.pick(WITHDRAWAL_STATUSES);
  const created = dayOffset(-rng.int(0, 45), rng.int(9, 21));
  const method = rng.pick(["BKASH", "NAGAD", "BANK"]);
  return {
    id: 300 + i,
    providerId: p.id,
    userId: p.userId,
    providerName: providerName(p),
    amount: money(rng.pick([3000, 5000, 7500, 10000, 12500, 15000, 22000])),
    status,
    method,
    mobileNumber: method !== "BANK" ? p.username : null,
    bankName: method === "BANK" ? rng.pick(["BRAC Bank", "Dutch-Bangla Bank", "City Bank"]) : null,
    accountName: method === "BANK" ? providerName(p) : null,
    accountNumber: method === "BANK" ? String(rng.int(1000000000, 9999999999)) : null,
    reference: status === "COMPLETED" ? `TRX${rng.int(10000000, 99999999)}` : null,
    adminNote: status === "REJECTED" ? "Account details did not match provider profile." : null,
    proofUrl: null,
    createdAt: iso(created),
    requestedAt: iso(created),
    updatedAt: iso(created),
    approvedAt: ["APPROVED", "COMPLETED"].includes(status) ? iso(new Date(created.getTime() + 864e5)) : null,
    completedAt: status === "COMPLETED" ? iso(new Date(created.getTime() + 2 * 864e5)) : null,
  };
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// ---------------------------------------------------------------- provider cancel requests

const CANCEL_REASONS = ["PERSONAL_EMERGENCY", "ILLNESS", "TRANSPORT_ISSUE", "SCHEDULE_CONFLICT", "OTHER"];
const REASON_NOTES = [
  "Family emergency, need to travel to Chattogram.",
  "Down with fever since last night.",
  "Road blockade in the area, cannot reach on time.",
  "Double booked by mistake.",
  "Not feeling safe at the location.",
];

export const providerCancelRequests: Row[] = [];
const completedOrUpcoming = serviceRequests.filter((s) => s.providerId && ["ACCEPTED", "PENDING", "CANCELLED"].includes(s.status));
for (let i = 0; i < 9; i++) {
  const sr = completedOrUpcoming[i % completedOrUpcoming.length];
  const provider = findProvider(sr.providerId);
  const patient = findPatient(sr.patientId);
  const reviewStatus = i < 4 ? "PENDING" : rng.pick(["APPROVED", "REJECTED", "REASSIGNED"]);
  const r = rng.int(0, CANCEL_REASONS.length - 1);
  providerCancelRequests.push({
    id: 700 + i,
    scope: "SINGLE",
    batchId: null,
    reviewStatus,
    createdAt: iso(dayOffset(-rng.int(0, 10), rng.int(8, 22))),
    reasonCategory: CANCEL_REASONS[r],
    reasonNote: REASON_NOTES[r],
    stage: rng.pick(["PRE_SERVICE", "PRE_PAYMENT"]),
    provider: provider ? { id: provider.id, userId: provider.userId, name: providerName(provider) } : null,
    patient: { id: patient?.id ?? 0, userId: patient?.userId, name: patientName(patient) },
    serviceRequest: {
      id: sr.id,
      status: reviewStatus === "APPROVED" ? "CANCELLED" : sr.status,
      statusAtRequest: "ACCEPTED",
      scheduledDate: sr.scheduledDate,
      scheduledTime: sr.scheduledTime,
      consultationTypeId: sr.consultationTypeId,
      consultationTypeName: sr.consultationTypeName,
      serviceCategory: categoryOfType(sr.consultationTypeId),
      fee: sr.fee,
    },
  });
}

/** Multi-shift (long-term) cancellations. */
export const providerCancelBatches: Row[] = longTermOpportunities
  .filter((l) => ["IN_PROGRESS", "PAID"].includes(l.status) && l.assignedNurses.length > 0)
  .slice(0, 3)
  .map((lto, i) => {
    const nurse = lto.assignedNurses[0];
    const slots = (ltoSchedules.get(lto.id) ?? [])
      .filter((s) => s.providerSchedule.providerId === nurse.id && s.providerSchedule.date >= ymd(new Date()))
      .slice(0, 3);
    const batchId = `batch-${lto.id}-${nurse.id}`;
    const reviewStatus = i === 2 ? "APPROVED" : "PENDING";
    return {
      id: 800 + i,
      scope: "LONG_TERM",
      batchId,
      opportunityId: lto.id,
      reviewStatus,
      createdAt: iso(dayOffset(-i, 11)),
      reasonCategory: CANCEL_REASONS[i],
      reasonNote: REASON_NOTES[i],
      stage: "PRE_SERVICE",
      provider: { id: nurse.id, name: `${nurse.firstName} ${nurse.lastName}` },
      patient: { id: lto.patientId, name: lto.patientName },
      shiftCount: slots.length,
      earliestDate: slots[0]?.providerSchedule.date ?? null,
      latestDate: slots[slots.length - 1]?.providerSchedule.date ?? null,
      shifts: slots.map((s, k) => ({
        cancellationId: 8000 + i * 10 + k,
        shiftId: s.providerSchedule.id,
        scheduledDate: s.providerSchedule.date,
        scheduledTime: s.providerSchedule.startTime,
        fee: s.serviceRequest.fee,
        reasonCategory: CANCEL_REASONS[i],
        reasonNote: REASON_NOTES[i],
        reviewStatus,
        srStatus: "ACCEPTED",
        previousSrStatus: "ACCEPTED",
        refundPreview: { feeAmount: "0.00", refundAmount: s.serviceRequest.fee },
      })),
    };
  });

// ---------------------------------------------------------------- refunds

export const refunds: Row[] = Array.from({ length: 14 }, (_, i) => {
  const sr = serviceRequests.filter((s) => s.status === "CANCELLED" || s.status === "REJECTED")[i % 8] ?? serviceRequests[i];
  const status = rng.pick(["PENDING", "COMPLETED", "COMPLETED", "FAILED", "CANCELLED"]);
  const fee = num2(sr.fee);
  const feeAmount = rng.chance(0.4) ? fee * 0.1 : 0;
  const cancelledAt = dayOffset(-rng.int(0, 25), rng.int(8, 22));
  return {
    cancellation: {
      id: 600 + i,
      cancelledAt: iso(cancelledAt),
      scope: "SINGLE",
      serviceRequestId: sr.id,
      longTermOpportunityId: null,
      actor: rng.pick(["PATIENT", "PROVIDER", "SYSTEM"]),
      actorUserId: null,
      actorName: sr.patientName,
      stage: rng.pick(["PRE_SERVICE", "PRE_PAYMENT", "IN_PROGRESS"]),
      statusAtCancel: "ACCEPTED",
      reasonCategory: rng.pick(CANCEL_REASONS),
      reasonNote: rng.pick(REASON_NOTES),
      feeAmount: money(feeAmount),
      refundAmount: money(fee - feeAmount),
      refundMethod: sr.paymentMethod === "CASH" ? "WALLET" : "GATEWAY",
      adminNotes: null,
    },
    refundTransaction: {
      id: 8800 + i,
      status,
      amount: money(fee - feeAmount),
      paymentMethod: sr.paymentMethod,
      referenceId: String(sr.id),
      referenceType: "SERVICE_REQUEST",
      longTermOpportunityId: null,
      patientId: sr.patientId,
      providerId: sr.providerId,
      patientName: sr.patientName,
      providerName: sr.providerName,
      gatewayRefundRefId: status === "PENDING" ? null : `SSLR${rng.int(100000, 999999)}`,
      gatewayRefundStatus: status === "FAILED" ? "FAILED" : status === "COMPLETED" ? "REFUNDED" : "PROCESSING",
      purpose: "CANCELLATION_REFUND",
      adminEscalated: status === "FAILED",
      createdAt: iso(cancelledAt),
      updatedAt: iso(cancelledAt),
    },
  };
});

// ---------------------------------------------------------------- upgrade requests

export const upgradeRequests: Row[] = providers
  .filter((p) => p.status === "ACTIVE" && categoryOfType(p.consultationTypeId) === "CAREGIVER")
  .slice(0, 8)
  .map((p, i) => {
    const target = p.consultationTypeId === 9 ? 8 : 9;
    const status = i < 4 ? "PENDING" : i % 2 ? "APPROVED" : "REJECTED";
    return {
      id: 400 + i,
      providerId: p.id,
      providerUserId: p.userId,
      providerName: providerName(p),
      currentConsultationTypeId: p.consultationTypeId,
      currentConsultationTypeName: p.consultationTypeName,
      targetConsultationTypeId: target,
      targetConsultationTypeName: consultationTypeName(target),
      status,
      createdAt: iso(dayOffset(-rng.int(1, 30))),
      reviewedBy: status === "PENDING" ? null : 1,
      reviewedAt: status === "PENDING" ? null : iso(dayOffset(-rng.int(0, 3))),
      adminComment: status === "REJECTED" ? "ICU certification not yet verified." : null,
    };
  });

// ---------------------------------------------------------------- documents & certifications

let docId = 2000;
/** userId -> documents */
export const userDocuments = new Map<number, Row[]>();
for (const p of providers) {
  const codes = categoryOfType(p.consultationTypeId) === "DOCTOR"
    ? ["NID", "BMDC_CERTIFICATE", "MBBS_CERTIFICATE", "PHOTO"]
    : ["NID", "BNMC_CERTIFICATE", "NURSING_DIPLOMA", "PHOTO"];
  userDocuments.set(
    p.userId,
    codes.map((type) => ({
      id: docId++,
      userId: p.userId,
      type,
      status: p.status === "ACTIVE" ? "APPROVED" : p.status === "REJECTED" ? "REJECTED" : "PENDING",
      createdAt: p.createdAt,
      filePath: null,
      path: null,
      viewUrl: null,
      adminComment: null,
    }))
  );
}
export function nextDocId(): number {
  return docId++;
}

let certId = 1;
/** providerId -> certifications */
export const providerCertifications = new Map<number, Row[]>();
for (const p of providers.filter((x) => categoryOfType(x.consultationTypeId) === "CAREGIVER")) {
  const types = [certificationTypes[2], certificationTypes[3]];
  providerCertifications.set(
    p.id,
    types.map((t) => ({
      id: certId++,
      providerId: p.id,
      certificationTypeCode: t.code,
      certificationTypeName: t.name,
      certificationNumber: `${t.code}-${rng.int(100000, 999999)}`,
      status: p.status === "ACTIVE" ? "APPROVED" : "PENDING",
      approvedAt: p.status === "ACTIVE" ? p.updatedAt : null,
      approvedByName: p.status === "ACTIVE" ? "Ashiful Islam" : null,
      adminComment: null,
      createdAt: p.createdAt,
      documentUrl: null,
    }))
  );
}

// ---------------------------------------------------------------- billing / salary

let rateId = 1;
/** providerId -> billing rate tiers (active + history) */
export const billingRates = new Map<number, Row[]>();
export const salaries = new Map<number, Row[]>();
for (const p of providers) {
  billingRates.set(p.id, [
    { id: rateId++, providerId: p.id, amount: p.rate, type: p.billingRateType, validFrom: p.createdAt, validTo: null, createdAt: p.createdAt },
  ]);
  salaries.set(p.id, categoryOfType(p.consultationTypeId) === "CAREGIVER" && p.status === "ACTIVE"
    ? [{ id: rateId++, providerId: p.id, amount: money(rng.pick([22000, 26000, 30000, 34000])), frequency: "MONTHLY", validFrom: p.createdAt, validTo: null, createdAt: p.createdAt }]
    : []);
}
export function nextRateId(): number {
  return rateId++;
}

// ---------------------------------------------------------------- settings

export const systemConfig: Row[] = [
  ["SMS_ENABLED", "true", "Send SMS notifications"],
  ["EMAIL_ENABLED", "true", "Send email notifications"],
  ["NEW_SERVICE_REQUESTS_ENABLED", "true", "Accept new service requests from patients"],
  ["DEMO_OTP", "123456", "Fixed OTP used in demo / staging"],
  ["DEFAULT_PATIENT_REGISTRATION_STATUS", "ACTIVE", "Status assigned to newly registered patients"],
  ["COMMISSION_FREE_APPOINTMENT_COUNT", "2", "First N appointments without platform commission"],
  ["SERVICE_TAX_PERCENT", "5", "VAT on service fee"],
  ["SERVICE_AIT_PERCENT", "2", "Advance income tax withheld from provider earnings"],
  ["COMMISSION_INCLUSIVE", "true", "Commission is included in the displayed fee"],
  ["TAX_INCLUSIVE", "true", "VAT is included in the displayed fee"],
  ["ARRIVAL_MAX_DISTANCE_METERS", "300", "Max distance from patient location to start service"],
  ["OTP_RESEND_COOLDOWN_SECONDS", "60", "Wait time before an OTP can be resent"],
].map(([key, value, description]) => ({ key, value, description, updatedAt: iso(dayOffset(-12)) }));

let policyId = 1;
export const cancellationPolicies: Row[] = (["DOCTOR", "CAREGIVER"] as const).flatMap((serviceCategory) =>
  (["SHORT_TERM", "LONG_TERM"] as const).flatMap((policyServiceType) => [
    { stage: "PRE_PAYMENT", title: "Before payment", feeType: "NONE", feeValue: "0.00", metadata: {}, hoursBeforeService: null },
    { stage: "PRE_SERVICE", title: "After payment, before service", feeType: "PERCENT", feeValue: "10.00", metadata: { window_minutes: 120, exceptions: [] }, hoursBeforeService: 2 },
    { stage: "IN_PROGRESS", title: "Service in progress", feeType: policyServiceType === "LONG_TERM" ? "USAGE_BASED" : "PERCENT", feeValue: policyServiceType === "LONG_TERM" ? "0.00" : "50.00", metadata: { exceptions: [] }, hoursBeforeService: null },
  ].map((p, i) => ({
    id: policyId++,
    serviceCategory,
    policyServiceType,
    ...p,
    name: p.title,
    description: null,
    policyKey: `${serviceCategory}_${policyServiceType}_${p.stage}`,
    isActive: true,
    sortOrder: i + 1,
    createdAt: iso(dayOffset(-120)),
    updatedAt: iso(dayOffset(-15)),
  })))
);

export const schedulerJobs: Row[] = [
  ["REFUND_RECONCILE", "Poll the payment gateway for pending refunds", 30, { batchSize: 50, escalationAfterDays: 7 }],
  ["PAYMENT_TIMEOUT", "Expire requests that were not paid in time", 5, { timeoutMinutes: 30, maxRowsPerRun: 200, eligibleStatuses: ["PAYMENT_PENDING", "SCHEDULE_PROPOSED"] }],
  ["PROVIDER_ACCEPT_TIMEOUT", "Expire requests no provider accepted", 10, { expiryAfterMinutes: 60, maxRowsPerRun: 200, eligibleStatuses: ["REQUESTED"] }],
  ["PROVIDER_ACCEPT_REMINDER", "Remind providers about pending requests", 5, { reminderBeforeMinutes: 15, expiryAfterMinutes: 60, maxRowsPerRun: 200, eligibleStatuses: ["REQUESTED"] }],
  ["PATIENT_PAYMENT_REMINDER", "Remind patients to complete payment", 5, { reminderBeforeMinutes: 10, timeoutMinutes: 30, maxRowsPerRun: 200 }],
  ["MEDICINE_REMINDER", "Push medicine reminders to patients", 15, { lookaheadMinutes: 60, maxRowsPerRun: 200 }],
].map(([jobKey, description, runEveryMinutes, metadata], i) => ({
  id: i + 1,
  jobKey,
  description,
  runEveryMinutes,
  isEnabled: jobKey !== "MEDICINE_REMINDER",
  metadata,
  lastRunAt: iso(new Date(Date.now() - (runEveryMinutes as number) * 30 * 1000)),
  nextRunAt: iso(new Date(Date.now() + (runEveryMinutes as number) * 30 * 1000)),
  createdAt: iso(dayOffset(-150)),
  updatedAt: iso(dayOffset(-3)),
}));

// ---------------------------------------------------------------- financial transactions

const VAT = 0.05;
const AIT = 0.02;
const SUP_COMMISSION = 0.02;

/** Split a fee into the platform's distribution (VAT and commission inclusive). */
export function feeBreakdown(totalFee: number, commissionPercent: number, withSupervisor: boolean) {
  const tax = totalFee * VAT;
  const commission = totalFee * (commissionPercent / 100);
  const supervisorCommission = withSupervisor ? totalFee * SUP_COMMISSION : 0;
  const ait = (totalFee - tax - commission - supervisorCommission) * AIT;
  const providerFee = totalFee - tax - commission - supervisorCommission - ait;
  return { totalFee, tax, commission, supervisorCommission, ait, providerFee };
}

let txId = 10000;
export const transactions: Row[] = [];

for (const sr of serviceRequests) {
  if (!["COMPLETED", "IN_PROGRESS", "ACCEPTED"].includes(sr.status) || !sr.providerId) continue;
  const commissionPercent = consultationTypes.find((t) => t.id === sr.consultationTypeId)?.platformCommissionPercent ?? 15;
  const b = feeBreakdown(num2(sr.fee), commissionPercent, false);
  transactions.push({
    transactionId: txId++,
    date: sr.scheduledAt,
    type: "CONSULTATION_PAYMENT",
    status: sr.status === "COMPLETED" ? "COMPLETED" : "PENDING",
    paymentMethod: sr.paymentMethod,
    serviceType: "SHORT_TERM",
    longTermOpportunityId: null,
    serviceRequestId: sr.id,
    serviceRequestStatus: sr.status,
    consultationTypeName: sr.consultationTypeName,
    scheduledDate: sr.scheduledDate,
    providerId: sr.providerId,
    providerName: sr.providerName,
    patientId: sr.patientId,
    patientName: sr.patientName,
    supervisorId: null,
    isEscrow: sr.status !== "COMPLETED" && sr.paymentMethod === "ONLINE",
    commissionPercent,
    ...b,
  });
}

for (const lto of longTermOpportunities) {
  for (const slot of ltoSchedules.get(lto.id) ?? []) {
    if (!["IN_PROGRESS", "COMPLETED", "PAID"].includes(lto.status)) continue;
    const commissionPercent = consultationTypes.find((t) => t.id === lto.consultationTypeId)?.platformCommissionPercent ?? 12;
    const b = feeBreakdown(lto.perShiftFee, commissionPercent, lto.supervisorId != null);
    const provider = findProvider(slot.providerSchedule.providerId);
    transactions.push({
      transactionId: txId++,
      date: `${slot.providerSchedule.date}T${slot.providerSchedule.startTime}:00`,
      type: "CONSULTATION_PAYMENT",
      status: slot.serviceRequest.status === "COMPLETED" ? "COMPLETED" : "PENDING",
      paymentMethod: "ONLINE",
      serviceType: "LONG_TERM",
      longTermOpportunityId: lto.id,
      serviceRequestId: slot.serviceRequest.id,
      serviceRequestStatus: slot.serviceRequest.status,
      consultationTypeName: lto.consultationTypeName,
      scheduledDate: slot.providerSchedule.date,
      providerId: provider?.id ?? null,
      providerName: providerName(provider),
      patientId: lto.patientId,
      patientName: lto.patientName,
      supervisorId: lto.supervisorId,
      isEscrow: slot.serviceRequest.status !== "COMPLETED",
      commissionPercent,
      ...b,
    });
  }
}

for (const w of withdrawals.filter((x) => x.status === "COMPLETED")) {
  transactions.push({
    transactionId: txId++,
    date: w.completedAt,
    type: "WITHDRAWAL",
    status: "COMPLETED",
    paymentMethod: null,
    serviceType: null,
    longTermOpportunityId: null,
    serviceRequestId: null,
    consultationTypeName: null,
    scheduledDate: null,
    providerId: w.providerId,
    providerName: w.providerName,
    patientId: null,
    patientName: null,
    supervisorId: findProvider(w.providerId)?.supervisorId ?? null,
    isEscrow: false,
    totalFee: num2(w.amount),
    tax: 0,
    commission: 0,
    supervisorCommission: 0,
    ait: 0,
    providerFee: num2(w.amount),
  });
}

transactions.sort((a, b) => String(b.date).localeCompare(String(a.date)));

/** Provider wallet figures derived from their transactions. */
export function providerWallet(providerId: number) {
  const mine = transactions.filter((t) => t.providerId === providerId);
  const earned = mine.filter((t) => t.type === "CONSULTATION_PAYMENT" && t.status === "COMPLETED");
  const totalEarned = earned.reduce((s, t) => s + t.providerFee, 0);
  const withdrawn = mine.filter((t) => t.type === "WITHDRAWAL").reduce((s, t) => s + t.totalFee, 0);
  const pending = withdrawals
    .filter((w) => w.providerId === providerId && ["PENDING", "APPROVED"].includes(w.status))
    .reduce((s, w) => s + num2(w.amount), 0);
  const cashShare = earned.filter((t) => t.paymentMethod === "CASH").reduce((s, t) => s + t.providerFee, 0);
  const claimable = Math.max(0, totalEarned - cashShare - withdrawn);
  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const inMonth = (key: string) => earned.filter((t) => monthKey(new Date(t.date)) === key).reduce((s, t) => s + t.providerFee, 0);
  const cur = inMonth(monthKey(now));
  const last = inMonth(monthKey(prev));
  return {
    walletBalance: money(cashShare + withdrawn),
    claimableBalance: money(claimable),
    totalBalance: money(cashShare + withdrawn + claimable),
    pendingWithdrawal: money(pending),
    availableToWithdraw: money(Math.max(0, claimable - pending)),
    nonClaimableBalance: money(cashShare),
    cashCommissionDue: money(earned.filter((t) => t.paymentMethod === "CASH").reduce((s, t) => s + t.commission, 0)),
    currency: "BDT",
    overview: {
      totalEarnedLifetime: money(totalEarned),
      totalServiceHoursLifetime: earned.length * 4,
      completedJobsCount: earned.length,
      avgEarningsPerCompletedJob: earned.length ? money(totalEarned / earned.length) : null,
      currentMonthEarnings: money(cur),
      previousMonthEarnings: money(last),
      monthOverMonthPercent: last > 0 ? Math.round(((cur - last) / last) * 1000) / 10 : null,
    },
    history: mine.slice(0, 15).map((t, i) => ({
      id: t.transactionId,
      transactionId: t.transactionId,
      amount: money(t.type === "WITHDRAWAL" ? -t.totalFee : t.providerFee),
      balanceAfter: money(Math.max(0, totalEarned - i * 500)),
      description: t.type === "WITHDRAWAL" ? "Withdrawal" : `${t.consultationTypeName} — ${t.patientName}`,
      createdAt: t.date,
      type: t.type === "WITHDRAWAL" ? "DEBIT" : "CREDIT",
    })),
  };
}
