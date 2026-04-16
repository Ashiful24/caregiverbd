/** Full supervisor row for list, view, and edit (dummy / local state until API exists). */
export type SupervisorFullDetails = {
  id: string;
  /** Set when the row was created via API — required for server-side update. */
  userId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  status: "ACTIVE" | "ON_LEAVE" | "INACTIVE";
  joinedAt: string;
  teamSize: number;
  dateOfBirth: string;
  gender: string;
  designation: string;
  department: string;
  yearsOfExperience: number;
  addressLine: string;
  city: string;
  areaLocation: string;
  nationalId: string;
  emergencyContact: string;
  notes: string;
};

/** Alias for table typing — same shape as full details. */
export type SupervisorRecord = SupervisorFullDetails;

const SUPERVISORS_FULL: SupervisorFullDetails[] = [
  {
    id: "sup-001",
    name: "Nadia Rahman",
    email: "nadia.rahman@hopehealth.demo",
    phone: "+880 1711 223344",
    region: "Dhaka North",
    status: "ACTIVE",
    joinedAt: "2024-03-01",
    teamSize: 12,
    dateOfBirth: "1988-04-12",
    gender: "female",
    designation: "Regional Supervisor",
    department: "Field operations",
    yearsOfExperience: 8,
    addressLine: "House 12, Road 4, Sector 3",
    city: "Dhaka",
    areaLocation: "Uttara",
    nationalId: "8812345678901",
    emergencyContact: "+880 1999 111222",
    notes: "Primary contact for north Dhaka coverage.",
  },
  {
    id: "sup-002",
    name: "Karim Hassan",
    email: "karim.hassan@hopehealth.demo",
    phone: "+880 1812 334455",
    region: "Dhaka South",
    status: "ACTIVE",
    joinedAt: "2023-11-15",
    teamSize: 9,
    dateOfBirth: "1990-07-22",
    gender: "male",
    designation: "Supervisor",
    department: "Field operations",
    yearsOfExperience: 6,
    addressLine: "Flat B2, Green View Apartments",
    city: "Dhaka",
    areaLocation: "Dhanmondi",
    nationalId: "9012345678902",
    emergencyContact: "+880 1888 333444",
    notes: "",
  },
  {
    id: "sup-003",
    name: "Samira Chowdhury",
    email: "samira.chowdhury@hopehealth.demo",
    phone: "+880 1913 445566",
    region: "Chattogram",
    status: "ON_LEAVE",
    joinedAt: "2024-01-20",
    teamSize: 7,
    dateOfBirth: "1992-11-03",
    gender: "female",
    designation: "Senior Supervisor",
    department: "Coastal region",
    yearsOfExperience: 10,
    addressLine: "Road 7, Nasirabad",
    city: "Chattogram",
    areaLocation: "Khulshi",
    nationalId: "9212345678903",
    emergencyContact: "+880 1777 555666",
    notes: "On extended leave until further notice.",
  },
  {
    id: "sup-004",
    name: "Tanvir Islam",
    email: "tanvir.islam@hopehealth.demo",
    phone: "+880 1614 556677",
    region: "Sylhet",
    status: "ACTIVE",
    joinedAt: "2022-08-10",
    teamSize: 15,
    dateOfBirth: "1985-01-30",
    gender: "male",
    designation: "Lead Supervisor",
    department: "North-east",
    yearsOfExperience: 12,
    addressLine: "Zindabazar main road",
    city: "Sylhet",
    areaLocation: "Zindabazar",
    nationalId: "8512345678904",
    emergencyContact: "+880 1666 777888",
    notes: "Handles training for new field staff.",
  },
  {
    id: "sup-005",
    name: "Farzana Akter",
    email: "farzana.akter@hopehealth.demo",
    phone: "+880 1515 667788",
    region: "Rajshahi",
    status: "ACTIVE",
    joinedAt: "2025-01-05",
    teamSize: 6,
    dateOfBirth: "1995-09-18",
    gender: "female",
    designation: "Supervisor",
    department: "Field operations",
    yearsOfExperience: 4,
    addressLine: "Padma residential area",
    city: "Rajshahi",
    areaLocation: "Motihar",
    nationalId: "9512345678905",
    emergencyContact: "+880 1555 888999",
    notes: "",
  },
  {
    id: "sup-006",
    name: "Rafiq Mahmud",
    email: "rafiq.mahmud@hopehealth.demo",
    phone: "+880 1316 778899",
    region: "Khulna",
    status: "INACTIVE",
    joinedAt: "2021-05-22",
    teamSize: 0,
    dateOfBirth: "1982-12-05",
    gender: "male",
    designation: "Supervisor",
    department: "Field operations",
    yearsOfExperience: 14,
    addressLine: "Sonadanga housing",
    city: "Khulna",
    areaLocation: "Sonadanga",
    nationalId: "8212345678906",
    emergencyContact: "+880 1444 000111",
    notes: "Account deactivated — reference only.",
  },
];

export function getSupervisors(): SupervisorFullDetails[] {
  return SUPERVISORS_FULL.map((s) => ({ ...s }));
}

export function getSupervisorById(id: string): SupervisorFullDetails | undefined {
  const row = SUPERVISORS_FULL.find((s) => s.id === id);
  return row ? { ...row } : undefined;
}
